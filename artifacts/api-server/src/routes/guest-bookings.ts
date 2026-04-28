// Public endpoints (no Clerk auth) for guests to view & cancel their booking.
// All actions are authorized purely by knowledge of the opaque, cryptographically
// random `management_token` that was generated when the guest's booking was created.
//
// Refund logic, money math, Stripe calls, idempotency keys, and email/notification
// side-effects mirror the authenticated DELETE /bookings/:id route exactly so guests
// and authed users get identical cancellation behavior.

import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, bookingsTable, courtsTable } from "@workspace/db";
import { computeRefund, hoursBeforeStart } from "./bookings";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { sendCustomerCancellationEmail, sendOwnerCancellationEmail } from "../lib/email";
import { sendNotification } from "../lib/notify";
import { timingSafeEqualToken, isPlausibleToken } from "../lib/guestToken";

const router: IRouter = Router();

function formatGuestBooking(
  booking: typeof bookingsTable.$inferSelect,
  court: { name?: string | null; address?: string | null; city?: string | null; phone?: string | null; imageUrl?: string | null; ownerEmail?: string | null } | null,
) {
  return {
    id: booking.id,
    courtId: booking.courtId,
    courtName: court?.name ?? undefined,
    courtAddress: court?.address ?? undefined,
    courtCity: court?.city ?? undefined,
    courtPhone: court?.phone ?? undefined,
    courtImageUrl: court?.imageUrl ?? undefined,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone ?? undefined,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    totalPrice: Number(booking.totalPrice),
    status: booking.status,
    refundAmount: Number(booking.refundAmount ?? 0),
    rentedItems: booking.rentedItems ?? undefined,
    createdAt: booking.createdAt,
  };
}

// ─── GET /api/guest/bookings/:token ──────────────────────────────────────────
// Fetches the booking + minimal court info, authorized solely by the token.
router.get("/guest/bookings/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!isPlausibleToken(token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
      courtPhone: courtsTable.phone,
      courtImageUrl: courtsTable.imageUrl,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.managementToken, token));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const r = rows[0];
  res.json(formatGuestBooking(r.booking, {
    name: r.courtName,
    address: r.courtAddress,
    city: r.courtCity,
    phone: r.courtPhone,
    imageUrl: r.courtImageUrl,
  }));
});

// ─── GET /api/guest/bookings/:token/refund-preview ───────────────────────────
// Mirrors GET /bookings/:id/refund-preview but token-authorized.
router.get("/guest/bookings/:token/refund-preview", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!isPlausibleToken(token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.managementToken, token));

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const totalPriceEur = Number(booking.totalPrice);
  const hours = hoursBeforeStart(booking.date, booking.startTime);
  const tier = computeRefund(totalPriceEur, hours);

  const canCancel = booking.status !== "cancelled" && hours > 0;
  let reason: string | undefined;
  if (booking.status === "cancelled") reason = "Booking is already cancelled.";
  else if (hours <= 0) reason = "Booking has already started or ended.";

  res.json({
    bookingId: booking.id,
    totalPrice: totalPriceEur,
    hoursBeforeStart: Math.round(hours * 10) / 10,
    refundPercent: tier.refundPercent,
    refundAmount: tier.refundAmount,
    refundable: tier.refundable,
    canCancel,
    reason,
  });
});

// ─── POST /api/guest/bookings/:token/cancel ──────────────────────────────────
// Mirrors DELETE /bookings/:id (atomic CAS + Stripe refund + emails) but
// authorized via the management token instead of a Clerk session.
router.post("/guest/bookings/:token/cancel", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!isPlausibleToken(token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtOwnerUserId: courtsTable.ownerUserId,
      ownerName: courtsTable.ownerName,
      ownerEmail: courtsTable.ownerEmail,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.managementToken, token));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const { booking, courtName, courtOwnerUserId, ownerName, ownerEmail } = rows[0];

  // Idempotent: if it was already cancelled, just return current state.
  if (booking.status === "cancelled") {
    res.json({
      ...booking,
      totalPrice: Number(booking.totalPrice),
      refundAmount: Number(booking.refundAmount ?? 0),
    });
    return;
  }

  const totalPriceEur = Number(booking.totalPrice);
  const hours = hoursBeforeStart(booking.date, booking.startTime);
  const tier = computeRefund(totalPriceEur, hours);

  if (hours <= 0) {
    res.status(400).json({ error: "Booking has already started or ended", code: "CANCEL_TOO_LATE" });
    return;
  }

  // Atomic compare-and-set on status to prevent double-refund races.
  const claimed = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(and(eq(bookingsTable.id, booking.id), ne(bookingsTable.status, "cancelled")))
    .returning();

  if (claimed.length === 0) {
    const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    res.json({
      ...current,
      totalPrice: Number(current.totalPrice),
      refundAmount: Number(current.refundAmount ?? 0),
    });
    return;
  }

  let stripeRefundId: string | null = null;
  if (
    tier.refundable &&
    tier.refundAmount > 0 &&
    booking.stripePaymentIntentId &&
    !booking.stripePaymentIntentId.startsWith("mock_")
  ) {
    try {
      const stripe = await getUncachableStripeClient();
      const refund = await stripe.refunds.create(
        {
          payment_intent: booking.stripePaymentIntentId,
          amount: Math.round(tier.refundAmount * 100),
          reason: "requested_by_customer",
        },
        // Same idempotency key as the authed path so retries from any surface dedupe.
        { idempotencyKey: `cancel-booking-${booking.id}` },
      );
      stripeRefundId = refund.id;
      logger.info(
        { bookingId: booking.id, refundId: refund.id, amount: tier.refundAmount, source: "guest" },
        "Stripe refund issued (guest cancel)",
      );
    } catch (err) {
      logger.error({ err, bookingId: booking.id, source: "guest" }, "Stripe refund failed (guest cancel)");
      // Roll back the status transition so support can retry.
      await db
        .update(bookingsTable)
        .set({ status: booking.status })
        .where(eq(bookingsTable.id, booking.id));
      res.status(502).json({ error: "Refund failed at payment provider" });
      return;
    }
  }

  const [cancelled] = await db
    .update(bookingsTable)
    .set({
      refundAmount: String(tier.refundAmount),
      stripeRefundId,
    })
    .where(eq(bookingsTable.id, booking.id))
    .returning();

  // ─── Notifications (fire-and-forget) ─────────────────────────────────────
  const displayCourtName = courtName ?? "Kortas";
  const dateStr = String(booking.date);

  if (courtOwnerUserId) {
    sendNotification(
      courtOwnerUserId,
      "booking_cancelled",
      `Atšaukta rezervacija — ${displayCourtName}`,
      `${booking.customerName} (svečias) atšaukė ${dateStr} ${booking.startTime}–${booking.endTime}.${
        tier.refundAmount > 0 ? ` Grąžinta klientui: ${tier.refundAmount.toFixed(2)} €.` : ""
      }`,
      "/owner",
    ).catch((err) => logger.error({ err, bookingId: booking.id }, "owner cancel notification failed (guest)"));
  }

  if (booking.customerEmail) {
    sendCustomerCancellationEmail({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      courtName: displayCourtName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: totalPriceEur,
      refundAmount: tier.refundAmount,
      bookingId: booking.id,
    }).catch((err) => logger.error({ err, bookingId: booking.id }, "sendCustomerCancellationEmail failed (guest)"));
  }

  if (ownerEmail) {
    sendOwnerCancellationEmail({
      ownerName: ownerName ?? "Savininkas",
      ownerEmail,
      customerName: booking.customerName,
      courtName: displayCourtName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: totalPriceEur,
      refundAmount: tier.refundAmount,
      bookingId: booking.id,
    }).catch((err) => logger.error({ err, bookingId: booking.id }, "sendOwnerCancellationEmail failed (guest)"));
  }

  res.json({
    ...cancelled,
    totalPrice: Number(cancelled.totalPrice),
    refundAmount: Number(cancelled.refundAmount ?? 0),
    refundPercent: tier.refundPercent,
  });
});

// ─── GET /api/guest/bookings/:token/ics ──────────────────────────────────────
// Public ICS download for guest bookings, mirrors GET /bookings/:id/ics.
router.get("/guest/bookings/:token/ics", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!isPlausibleToken(token)) {
    res.status(404).send("Booking not found");
    return;
  }

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.managementToken, token));

  if (!rows[0]) {
    res.status(404).send("Booking not found");
    return;
  }

  const { booking, courtName, courtId, courtAddress, courtCity } = rows[0];
  const siteUrl = process.env.SITE_URL || "https://korts.lt";

  const icsDateTime = (date: string, time: string): string =>
    date.replace(/-/g, "") + "T" + time.slice(0, 5).replace(":", "") + "00";

  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//korts.lt//Court Booking//LT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@korts.lt`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Vilnius:${icsDateTime(booking.date, booking.startTime)}`,
    `DTEND;TZID=Europe/Vilnius:${icsDateTime(booking.date, booking.endTime)}`,
    `SUMMARY:Korto rezervacija – ${courtName ?? "Kortas"}`,
    `DESCRIPTION:Rezervacija #${booking.id} per korts.lt\\n${siteUrl}/courts/${courtId}`,
    `LOCATION:${courtAddress ?? ""}, ${courtCity ?? ""}, Lietuva`,
    `URL:${siteUrl}/courts/${courtId}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="booking-${booking.id}.ics"`);
  res.send(ics);
});

export default router;
