/**
 * Stripe webhook endpoint — POST /api/webhooks/stripe
 *
 * Receives the raw request body and verifies the Stripe-Signature header
 * using STRIPE_WEBHOOK_SECRET. Handles the events relevant to the marketplace:
 *   - checkout.session.completed       → mark booking as confirmed/pending
 *   - checkout.session.async_payment_succeeded
 *   - account.updated                  → keep our cached Connect status in sync
 *
 * This route is registered in app.ts BEFORE express.json() so the body stays
 * a Buffer (required by stripe.webhooks.constructEvent).
 */
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { eq, and, ne, sql } from "drizzle-orm";
import {
  db,
  bookingsTable,
  courtsTable,
  facilitiesTable,
  userProfilesTable,
  gamesTable,
} from "@workspace/db";
import { getStripe, getStripeWebhookSecret } from "../stripeClient";
import { logger } from "../lib/logger";
import {
  sendBookingConfirmationEmail,
  sendOwnerBookingNotificationEmail,
} from "../lib/email";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sigHeader = req.headers["stripe-signature"];
  if (!sigHeader) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  let stripe: Stripe;
  let webhookSecret: string;
  try {
    stripe = getStripe();
    webhookSecret = getStripeWebhookSecret();
  } catch (err: any) {
    logger.error({ err }, "Stripe not configured for webhook");
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    logger.error(
      "Stripe webhook body is not a Buffer — express.json() must run AFTER this route",
    );
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: `Webhook Error: ${err?.message}` });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(session);
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }
      default:
        logger.debug({ type: event.type }, "Stripe webhook received (unhandled)");
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Stripe webhook handler failed");
    // Still return 200 so Stripe doesn't retry indefinitely on our app errors;
    // bookings are already protected by /api/payments/confirm fallback.
  }

  res.status(200).json({ received: true });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
      courtPhone: courtsTable.phone,
      courtImageUrl: courtsTable.imageUrl,
      ownerName: courtsTable.ownerName,
      ownerEmail: courtsTable.ownerEmail,
      instantBookingEnabled: courtsTable.instantBookingEnabled,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.stripeSessionId, session.id));

  if (!rows[0]) {
    logger.warn({ sessionId: session.id }, "Webhook: no booking matched session");
    return;
  }

  // If the confirm endpoint already promoted the booking, do nothing else.
  if (rows[0].booking.status === "confirmed") return;

  // ─── CAS guard: only promote if booking is still pending. If the sweeper
  // (or anything else) already cancelled the hold, ignore this stale completion
  // so we never end up with a confirmed booking whose game was deleted. ──
  const updatedRows = await db
    .update(bookingsTable)
    .set({ status: "confirmed" })
    .where(and(
      eq(bookingsTable.stripeSessionId, session.id),
      eq(bookingsTable.status, "pending"),
    ))
    .returning();

  if (updatedRows.length === 0) {
    logger.warn(
      { sessionId: session.id, bookingId: rows[0].booking.id, currentStatus: rows[0].booking.status },
      "Webhook: stale checkout.session.completed — booking no longer pending, ignoring",
    );
    return;
  }
  const booking = updatedRows[0]!;

  await db
    .update(courtsTable)
    .set({ totalBookings: sql`total_bookings + 1` })
    .where(eq(courtsTable.id, rows[0].booking.courtId));

  {
    sendBookingConfirmationEmail({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      courtName: rows[0].courtName ?? "Kortas",
      courtId: rows[0].courtId ?? 0,
      courtAddress: rows[0].courtAddress ?? "",
      courtCity: rows[0].courtCity ?? "",
      courtPhone: rows[0].courtPhone ?? undefined,
      courtImageUrl: rows[0].courtImageUrl ?? undefined,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: Number(booking.totalPrice),
      bookingId: booking.id,
    }).catch((err) => logger.error({ err }, "sendBookingConfirmationEmail (webhook) failed"));
  }

  if (rows[0].ownerEmail) {
    sendOwnerBookingNotificationEmail({
      ownerName: rows[0].ownerName ?? "Savininkas",
      ownerEmail: rows[0].ownerEmail,
      customerName: booking.customerName,
      courtName: rows[0].courtName ?? "Kortas",
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: Number(booking.totalPrice),
      bookingId: booking.id,
    }).catch((err) => logger.error({ err }, "sendOwnerBookingNotificationEmail (webhook) failed"));
  }

  // Host-Pays-All: if a game is linked to this booking, flip it from pending_payment → open.
  await db
    .update(gamesTable)
    .set({ status: "open" })
    .where(and(eq(gamesTable.bookingId, booking.id), eq(gamesTable.status, "pending_payment")));
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  // Find the booking by stripeSessionId; if it's still pending, cancel it and delete any linked pending game.
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.stripeSessionId, session.id));
  if (!booking) return;

  // Only cancel if still pending — never disturb confirmed bookings.
  await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(and(eq(bookingsTable.id, booking.id), ne(bookingsTable.status, "confirmed")));

  await db
    .delete(gamesTable)
    .where(and(eq(gamesTable.bookingId, booking.id), eq(gamesTable.status, "pending_payment")));

  logger.info({ bookingId: booking.id, sessionId: session.id }, "stripe webhook: expired session — released hold");
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  console.log(`Received webhook for account: ${account.id}`);
  const newStatus = account.details_submitted ? "active" : "pending";

  // 1) User-level Connect (owner profile)
  await db
    .update(userProfilesTable)
    .set({ stripeAccountStatus: newStatus })
    .where(eq(userProfilesTable.stripeAccountId, account.id));

  // 2) Facility-level Connect (per-facility payout account)
  await db
    .update(facilitiesTable)
    .set({ stripeConnectStatus: newStatus })
    .where(eq(facilitiesTable.stripeConnectAccountId, account.id));

  // 3) Court-level Connect (per-court payout account)
  await db
    .update(courtsTable)
    .set({ stripeConnectStatus: newStatus })
    .where(eq(courtsTable.stripeConnectAccountId, account.id));
}
