import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { db, bookingsTable, courtsTable, facilitiesTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import { sendNotification } from "../lib/notify";
import { sendCustomerCancellationEmail } from "../lib/email";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ForceCancelBody = z.object({
  refundAmountCents: z.number().int().min(0),
});

/**
 * POST /api/owner/bookings/:id/force-cancel
 *
 * Owner manual override. Bypasses the 24h/48h cancellation policy and accepts
 * a custom refund amount in cents (0..totalPriceCents). Requires the caller to
 * own the court (directly via courts.ownerUserId, or transitively via the
 * facility's ownerUserId).
 *
 * Mirrors DELETE /bookings/:id but with no time restriction and a caller-supplied
 * refund amount. Issues a Stripe refund (idempotent, distinct key from the regular
 * cancel) and frees the timeslot by transitioning status to "cancelled".
 */
router.post("/owner/bookings/:id/force-cancel", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid booking id" });
    return;
  }

  const parsed = ForceCancelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getCurrentUserId(req)!;

  const rows = await db
    .select({
      booking: bookingsTable,
      courtOwnerUserId: courtsTable.ownerUserId,
      courtFacilityId: courtsTable.facilityId,
      courtName: courtsTable.name,
      ownerName: courtsTable.ownerName,
      ownerEmail: courtsTable.ownerEmail,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, id));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const { booking, courtOwnerUserId, courtFacilityId, courtName, ownerName, ownerEmail } = rows[0];

  // Ownership check: caller must own the court directly OR own the facility.
  let isOwner = courtOwnerUserId === userId;
  if (!isOwner && courtFacilityId) {
    const [facility] = await db
      .select({ ownerUserId: facilitiesTable.ownerUserId })
      .from(facilitiesTable)
      .where(eq(facilitiesTable.id, courtFacilityId))
      .limit(1);
    isOwner = !!facility && facility.ownerUserId === userId;
  }
  if (!isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (booking.status === "cancelled") {
    res.status(409).json({ error: "Booking is already cancelled" });
    return;
  }

  // Validate refund amount: must not exceed the original totalPrice.
  const totalPriceEur = Number(booking.totalPrice);
  const totalPriceCents = Math.round(totalPriceEur * 100);
  const refundCents = parsed.data.refundAmountCents;
  if (refundCents > totalPriceCents) {
    res.status(400).json({
      error: `Refund amount (${(refundCents / 100).toFixed(2)} €) exceeds booking total (${totalPriceEur.toFixed(2)} €)`,
      code: "REFUND_EXCEEDS_TOTAL",
    });
    return;
  }
  const refundEur = refundCents / 100;

  // Atomic compare-and-set on status to prevent double-refund races with the
  // regular cancel route.
  const claimed = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(and(eq(bookingsTable.id, id), ne(bookingsTable.status, "cancelled")))
    .returning();

  if (claimed.length === 0) {
    const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
    res.json({
      id: current.id,
      status: current.status,
      refundAmount: Number(current.refundAmount ?? 0),
    });
    return;
  }

  // Issue Stripe refund if applicable. Use a distinct idempotency key from the
  // regular cancel route so an owner override after a customer self-cancel
  // doesn't get suppressed by Stripe's idempotency cache.
  let stripeRefundId: string | null = null;
  if (
    refundCents > 0 &&
    booking.stripePaymentIntentId &&
    !booking.stripePaymentIntentId.startsWith("mock_")
  ) {
    try {
      const stripe = await getUncachableStripeClient();
      const refund = await stripe.refunds.create(
        {
          payment_intent: booking.stripePaymentIntentId,
          amount: refundCents,
          reason: "requested_by_customer",
        },
        { idempotencyKey: `force-cancel-booking-${id}` },
      );
      stripeRefundId = refund.id;
      logger.info(
        { bookingId: id, refundId: refund.id, amount: refundEur, actor: userId },
        "Stripe force-cancel refund issued",
      );
    } catch (err) {
      logger.error({ err, bookingId: id }, "Stripe force-cancel refund failed");
      await db
        .update(bookingsTable)
        .set({ status: booking.status })
        .where(eq(bookingsTable.id, id));
      res.status(502).json({ error: "Refund failed at payment provider" });
      return;
    }
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({
      refundAmount: String(refundEur),
      stripeRefundId,
    })
    .where(eq(bookingsTable.id, id))
    .returning();

  // Notifications (fire-and-forget, never block the response).
  const displayCourtName = courtName ?? "Kortas";
  const dateStr = typeof booking.date === "string" ? booking.date : String(booking.date);

  // Notify the booker (unless the owner force-cancelled their own booking).
  if (booking.bookerUserId && booking.bookerUserId !== userId) {
    sendNotification(
      booking.bookerUserId,
      "booking_cancelled",
      `Rezervacija atšaukta — ${displayCourtName}`,
      refundEur > 0
        ? `Jūsų rezervacija ${dateStr} ${booking.startTime}–${booking.endTime} atšaukta savininko. Grąžinta: ${refundEur.toFixed(2)} €.`
        : `Jūsų rezervacija ${dateStr} ${booking.startTime}–${booking.endTime} atšaukta savininko.`,
      "/bookings",
    ).catch((err) => logger.error({ err, bookingId: id }, "force-cancel booker notification failed"));
  }

  // Email customer with refund details.
  if (booking.customerEmail) {
    sendCustomerCancellationEmail({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      courtName: displayCourtName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: totalPriceEur,
      refundAmount: refundEur,
      bookingId: id,
    }).catch((err) => logger.error({ err, bookingId: id }, "force-cancel customer email failed"));
  }

  // No notification/email to the owner — they triggered this themselves.
  // Reference ownerName/ownerEmail to satisfy noUnusedLocals while preserving
  // them in the join (also lets us log who the owner was for audit).
  void ownerName;
  void ownerEmail;

  res.json({
    id: updated.id,
    status: updated.status,
    refundAmount: Number(updated.refundAmount ?? 0),
    stripeRefundId: updated.stripeRefundId ?? null,
  });
});

export default router;
