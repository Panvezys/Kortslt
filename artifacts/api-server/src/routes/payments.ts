import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, bookingsTable, courtsTable } from "@workspace/db";
import Stripe from "stripe";
import {
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
  ConfirmPaymentBody,
  ConfirmPaymentResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendBookingConfirmationEmail } from "../lib/email";

const router: IRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

router.post("/payments/create-checkout", async (req, res): Promise<void> => {
  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { bookingId, successUrl, cancelUrl } = parsed.data;

  const rows = await db
    .select({ booking: bookingsTable, court: courtsTable })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, bookingId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const { booking, court } = rows[0];

  const stripe = getStripe();
  if (!stripe) {
    logger.warn("Stripe not configured, using mock checkout");
    const mockSessionId = `mock_session_${bookingId}_${Date.now()}`;
    await db.update(bookingsTable).set({ stripeSessionId: mockSessionId }).where(eq(bookingsTable.id, bookingId));
    const mockSuccessUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id=${mockSessionId}`;
    res.json(CreateCheckoutSessionResponse.parse({ sessionId: mockSessionId, url: mockSuccessUrl }));
    return;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${court?.name ?? "Court"} booking`,
            description: `${booking.date} ${booking.startTime} - ${booking.endTime}`,
          },
          unit_amount: Math.round(Number(booking.totalPrice) * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      bookingId: String(bookingId),
    },
  });

  await db.update(bookingsTable).set({ stripeSessionId: session.id }).where(eq(bookingsTable.id, bookingId));

  res.json(CreateCheckoutSessionResponse.parse({ sessionId: session.id, url: session.url! }));
});

router.post("/payments/confirm", async (req, res): Promise<void> => {
  const parsed = ConfirmPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sessionId } = parsed.data;

  const rows = await db
    .select({ booking: bookingsTable, courtName: courtsTable.name })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.stripeSessionId, sessionId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found for session" });
    return;
  }

  const stripe = getStripe();
  if (stripe && !sessionId.startsWith("mock_")) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed" });
      return;
    }
  }

  const [booking] = await db
    .update(bookingsTable)
    .set({ status: "confirmed" })
    .where(eq(bookingsTable.stripeSessionId, sessionId))
    .returning();

  await db
    .update(courtsTable)
    .set({ totalBookings: sql`total_bookings + 1` })
    .where(eq(courtsTable.id, rows[0].booking.courtId));

  // Send confirmation email (non-blocking — don't fail the response if email fails)
  sendBookingConfirmationEmail({
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    courtName: rows[0].courtName ?? "Kortas",
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    totalPrice: Number(booking.totalPrice),
    bookingId: booking.id,
  }).catch(err => logger.error({ err }, "sendBookingConfirmationEmail failed"));

  res.json(ConfirmPaymentResponse.parse({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    courtName: rows[0].courtName ?? undefined,
  }));
});

router.post("/payments/confirm-free", async (req, res): Promise<void> => {
  const bookingId = Number(req.body?.bookingId);
  if (!bookingId || isNaN(bookingId)) {
    res.status(400).json({ error: "bookingId required" });
    return;
  }

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
      courtPhone: courtsTable.phone,
      courtImageUrl: courtsTable.imageUrl,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, bookingId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const [booking] = await db
    .update(bookingsTable)
    .set({ status: "confirmed" })
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  await db
    .update(courtsTable)
    .set({ totalBookings: sql`total_bookings + 1` })
    .where(eq(courtsTable.id, rows[0].booking.courtId));

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
  }).catch(err => logger.error({ err }, "sendBookingConfirmationEmail failed"));

  res.json({ ...booking, totalPrice: Number(booking.totalPrice), courtName: rows[0].courtName });
});

export default router;
