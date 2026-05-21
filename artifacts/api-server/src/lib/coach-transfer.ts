import { eq } from "drizzle-orm";
import { db, bookingsTable, userProfilesTable } from "@workspace/db";
import { logger } from "./logger";

interface BookingForTransfer {
  id: number;
  coachId: string | null;
  coachAmountCents: number | null;
  coachTransferId: string | null;
  stripePaymentIntentId: string | null;
  stripeSessionId: string | null;
}

/**
 * Fire stripe.transfers.create to send the coach their share of a confirmed
 * booking. Called from both /payments/confirm and the checkout-completed
 * webhook — both paths can race after a successful payment, so this function
 * is idempotent at three levels:
 *
 *  1. Short-circuits if booking.coachTransferId is already set.
 *  2. Uses a deterministic Stripe idempotency_key tied to the booking id.
 *  3. The CAS update on bookings.coachTransferId only succeeds the first time.
 *
 * If the booking has no coach attached, this is a no-op.
 */
export async function maybeIssueCoachTransfer(
  booking: BookingForTransfer,
  stripe: any,
): Promise<void> {
  if (!booking.coachId || !booking.coachAmountCents || booking.coachAmountCents <= 0) return;
  if (booking.coachTransferId) return;

  const [coachProfile] = await db
    .select({
      stripeAccountId: userProfilesTable.stripeAccountId,
      status: userProfilesTable.stripeAccountStatus,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, booking.coachId));

  if (!coachProfile?.stripeAccountId || coachProfile.status !== "active") {
    logger.error(
      { bookingId: booking.id, coachUserId: booking.coachId },
      "Coach Stripe account not active at transfer time — leaving funds on platform balance for manual reconciliation",
    );
    return;
  }

  // source_transaction links the transfer to the original charge so Stripe
  // reporting groups them and refunds can reverse the transfer cleanly.
  // We need the charge id from the PaymentIntent.
  let sourceTransaction: string | null = null;
  if (booking.stripePaymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge;
      sourceTransaction = typeof charge === "string" ? charge : charge?.id ?? null;
    } catch (err) {
      logger.warn({ err, bookingId: booking.id }, "Failed to retrieve PaymentIntent for coach transfer source_transaction");
    }
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: booking.coachAmountCents,
        currency: "eur",
        destination: coachProfile.stripeAccountId,
        transfer_group: `booking_${booking.id}`,
        ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
        metadata: {
          bookingId: String(booking.id),
          coachUserId: booking.coachId,
        },
      },
      {
        // Same key across both callers guarantees Stripe deduplicates if the
        // confirm endpoint and webhook fire in parallel.
        idempotencyKey: `coach_transfer_booking_${booking.id}`,
      },
    );

    // CAS so the SECOND caller's update is a no-op even if Stripe returned
    // a deduped success to both racers.
    await db
      .update(bookingsTable)
      .set({ coachTransferId: transfer.id })
      .where(eq(bookingsTable.id, booking.id));

    logger.info(
      { bookingId: booking.id, transferId: transfer.id, coachUserId: booking.coachId, amountCents: booking.coachAmountCents },
      "Coach transfer issued",
    );
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "stripe.transfers.create failed for coach payout");
  }
}
