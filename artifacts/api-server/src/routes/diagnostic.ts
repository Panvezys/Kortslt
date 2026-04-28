import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bookingsTable, courtsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, getUserRole } from "../lib/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { computeRefund, hoursBeforeStart, vilniusLocalToUtcMs } from "./bookings";

const router: IRouter = Router();

// Convert a UTC instant to the Vilnius wall-clock representation that we store
// in `bookings.date` and `bookings.startTime`.
function utcMsToVilniusLocal(ms: number): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Vilnius",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  let hh = get("hour");
  if (hh === "24") hh = "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hh}:${get("minute")}`,
  };
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + mins + 24 * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// ─── GET /api/diagnostic/test-cancellations ─────────────────────────────────
// Hidden, admin-only diagnostic that creates 3 real Stripe Test PaymentIntents,
// 3 confirmed bookings (50h / 30h / 10h before start), then runs cancellation
// against each and prints a tabular summary.
router.get("/diagnostic/test-cancellations", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const role = await getUserRole(userId);
  if (role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  // Pick the first available court to attach test bookings to.
  const [court] = await db.select().from(courtsTable).limit(1);
  if (!court) {
    res.status(500).json({ error: "No courts in DB to attach test bookings to" });
    return;
  }

  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    res.status(503).json({ error: "Stripe client unavailable", detail: String(err) });
    return;
  }

  const NOW = Date.now();
  const cases = [
    { name: "Booking A (+50h)", offsetH: 50, expectedTier: 80 },
    { name: "Booking B (+30h)", offsetH: 30, expectedTier: 50 },
    { name: "Booking C (+10h)", offsetH: 10, expectedTier: 0 },
  ];

  type Result = {
    name: string;
    offsetH: number;
    storedDate: string;
    storedTime: string;
    measuredHoursBeforeStart: number;
    expectedRefundCents: number;
    actualRefundCents: number;
    stripePaymentIntentId: string;
    stripeRefundId: string | null;
    newDbStatus: string;
    error?: string;
  };

  const results: Result[] = [];
  const createdBookingIds: number[] = [];

  for (const c of cases) {
    const startUtcMs = NOW + c.offsetH * 60 * 60 * 1000;
    const { date, time } = utcMsToVilniusLocal(startUtcMs);
    const endTime = addMinutes(time, 60);

    // Sanity: round-trip the stored strings back to UTC; should equal startUtcMs.
    const roundTripUtc = vilniusLocalToUtcMs(date, time);
    const roundTripDriftMs = Math.abs(roundTripUtc - startUtcMs);

    let pi: { id: string } | null = null;
    let bookingId: number | null = null;
    const expectedRefundCents = computeRefund(20, c.offsetH).refundCents;

    try {
      // 1) Real Stripe Test PaymentIntent (€20.00 = 2000 cents).
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 2000,
        currency: "eur",
        payment_method: "pm_card_visa",
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      });
      pi = { id: paymentIntent.id };

      // 2) Insert a confirmed booking attached to this PaymentIntent.
      const [inserted] = await db
        .insert(bookingsTable)
        .values({
          courtId: court.id,
          bookerUserId: userId,
          customerName: "Diagnostic Test",
          customerEmail: "diagnostic@korts.lt",
          date,
          startTime: time,
          endTime,
          totalPrice: "20.00",
          status: "confirmed",
          stripePaymentIntentId: paymentIntent.id,
          notes: `[diagnostic] ${c.name} created at ${new Date(NOW).toISOString()}`,
        })
        .returning();
      bookingId = inserted.id;
      createdBookingIds.push(bookingId);

      // 3) Run the same cancellation logic that the route uses.
      const measuredHours = hoursBeforeStart(date, time);
      const tier = computeRefund(20, measuredHours);

      let stripeRefundId: string | null = null;
      let actualRefundCents = 0;

      if (tier.refundable && tier.refundCents > 0) {
        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntent.id,
            amount: tier.refundCents,
            reason: "requested_by_customer",
          },
          { idempotencyKey: `cancel-booking-${bookingId}` },
        );
        stripeRefundId = refund.id;
        actualRefundCents = refund.amount;
      }

      const [updated] = await db
        .update(bookingsTable)
        .set({
          status: "cancelled",
          refundAmount: String(tier.refundAmount),
          stripeRefundId,
        })
        .where(eq(bookingsTable.id, bookingId))
        .returning();

      results.push({
        name: c.name,
        offsetH: c.offsetH,
        storedDate: date,
        storedTime: time,
        measuredHoursBeforeStart: Math.round(measuredHours * 100) / 100,
        expectedRefundCents,
        actualRefundCents,
        stripePaymentIntentId: paymentIntent.id,
        stripeRefundId,
        newDbStatus: updated.status,
      });

      logger.info(
        {
          case: c.name,
          offsetH: c.offsetH,
          measuredHours,
          roundTripDriftMs,
          expectedRefundCents,
          actualRefundCents,
          stripePaymentIntentId: paymentIntent.id,
          stripeRefundId,
        },
        "[diagnostic] cancellation case complete",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        name: c.name,
        offsetH: c.offsetH,
        storedDate: date,
        storedTime: time,
        measuredHoursBeforeStart: hoursBeforeStart(date, time),
        expectedRefundCents,
        actualRefundCents: 0,
        stripePaymentIntentId: pi?.id ?? "",
        stripeRefundId: null,
        newDbStatus: "error",
        error: msg,
      });
      logger.error({ err, case: c.name }, "[diagnostic] case failed");
    }
  }

  // Pretty-print summary in server logs.
  // eslint-disable-next-line no-console
  console.log("\n========== /diagnostic/test-cancellations ==========");
  // eslint-disable-next-line no-console
  console.table(
    results.map(r => ({
      Case: r.name,
      "Hours Diff": r.measuredHoursBeforeStart,
      "Expected ¢": r.expectedRefundCents,
      "Actual ¢": r.actualRefundCents,
      "Match?": r.expectedRefundCents === r.actualRefundCents ? "YES" : "NO",
      "DB Status": r.newDbStatus,
      "PI": r.stripePaymentIntentId,
      "Refund": r.stripeRefundId ?? "—",
    })),
  );
  // eslint-disable-next-line no-console
  console.log("====================================================\n");

  res.json({
    ok: results.every(r => r.expectedRefundCents === r.actualRefundCents && r.newDbStatus === "cancelled"),
    courtId: court.id,
    createdBookingIds,
    results,
  });
});

export default router;
