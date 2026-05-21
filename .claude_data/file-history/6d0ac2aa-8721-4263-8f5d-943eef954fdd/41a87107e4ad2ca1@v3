# Independent Cancellations & Reversals

## Purpose

When a booking with an attached coach is cancelled, the court owner's refund and the coach's refund are computed **independently** against their own policies. The player receives the exact sum back; the platform retains its 5% court margin to cover Stripe's non-refundable processing fees.

## Policy tiers

### Court policy (`facilities.cancellationPolicy`)
Existing pre-Strike-3 behavior, unchanged.

| Policy | ≥ 48 h | 24–48 h | < 24 h |
|--------|--------|---------|--------|
| `standard` | 80% | 50% | 0% |
| `strict`   | 0%  | 0%   | 0% |

### Coach policy (`coaches.cancellationPolicy`, new in Strike 3)
| Policy | ≥ 48 h | 24–48 h | < 24 h |
|--------|--------|---------|--------|
| `flexible` | 100% | 100% | 0% |
| `standard` | 80%  | 50%  | 0% |
| `strict`   | 0%   | 0%   | 0% |

Set by the coach in `/coach/settings`. Default is `standard`.

## Math invariant (integer cents)

```
totalCents       = booking.totalPrice * 100
coachAttachedCents = booking.coachAmountCents ?? 0
courtCents       = totalCents − coachAttachedCents

courtRefundCents = computeCourtRefundCents(courtCents, hours, courtPolicy)
coachRefundCents = computeCoachRefundCents(coachAttachedCents, hours, coachPolicy)

PLAYER_REFUND  = courtRefundCents + coachRefundCents     ← exact, never approximated
```

Defined in `routes/bookings.ts` as `computeCourtRefundCents` and `computeCoachRefundCents`. Both return integers; no floats touch money math.

## Stripe call sequence (coach-attached)

For a coach-attached cancellation the order matters: we abandon Stripe's proportional `reverse_transfer: true` because the math doesn't yield exact integer cents on partial refunds. We explicitly call out each leg:

```
1. CAS bookings.status: pending|confirmed|awaiting_players|blocked → 'cancelling'
2. stripe.paymentIntents.retrieve(piId, {expand: ['latest_charge']})
3. const ownerTransferId = latest_charge.transfer
4. if courtRefundCents > 0:
     stripe.transfers.createReversal(ownerTransferId, {amount: courtRefundCents}, {idempotencyKey: cancel-court-<id>})
5. if coachRefundCents > 0 and booking.coachTransferId:
     stripe.transfers.createReversal(booking.coachTransferId, {amount: coachRefundCents}, {idempotencyKey: cancel-coach-<id>})
6. stripe.refunds.create({charge: chargeId, amount: courtRefundCents + coachRefundCents, refund_application_fee: false}, {idempotencyKey: cancel-refund-<id>})
7. CAS bookings.status 'cancelling' → 'cancelled' with refundAmount + stripeRefundId
```

If any Stripe call throws between steps 4-6, the booking is left at status `cancelling` (the lock holds) and the caller receives 502. Retrying replays the same idempotency keys — Stripe dedupes and returns the prior result, so the retry only completes what's missing.

## Platform balance accounting

For a 5000-cent booking (court 2000 + coach 3000) cancelled at the 80% tier:

| Account       | Pre-cancel | Δ from reversals/refund | Post-cancel |
|---------------|-----------|-------------------------|-------------|
| Player paid   | −5000     | refund +4000            | net −1000   |
| Owner         | +1900     | reversal −1600          | +300        |
| Coach         | +3000     | reversal −2400          | +600        |
| Platform      | +100      | reversal +1600+2400, refund −4000 | +100 (unchanged) |

Platform retains its 5% court margin (100 cents) regardless of cancellation timing. That margin covers Stripe's non-refundable per-transaction processing fee.

## Production guards (Strike 3.1)

Three preconditions wrap the Stripe leg so a degenerate cancellation can't get the booking stuck in the `cancelling` lock.

1. **Unpaid bypass.** If `booking.stripePaymentIntentId` is null/mock or `booking.status === 'pending'`, the booking was never charged. We skip the entire Stripe block and CAS straight to `cancelled` with `refundAmount = 0.00`. Without this guard, `paymentIntents.retrieve(null!)` would throw a TypeError and the booking would lock forever.
2. **Zero-dollar guard.** Stripe rejects `transfers.createReversal` and `refunds.create` calls with `amount: 0` (`invalid_request_error`). Each call carries an explicit `amount > 0` precondition:
   - Owner reversal: `if (courtRefundCents > 0 && ownerTransferId)`
   - Coach reversal: `if (coachRefundCents > 0 && booking.coachTransferId)`
   - Player refund: `if (totalRefundCents > 0)`
   Triggers when policy resolves to 0% (e.g. coach `strict`, court `strict`, or `< 24 h` on `standard`). Booking still finalises cleanly to `cancelled` with `refundAmount = 0.00`.
3. **Null charge guard.** `paymentIntents.retrieve(piId, {expand:['latest_charge']})` can return a PI with no charge (fully-discounted promo, future feature). The handler asserts `chargeId != null` before attempting reversals or refunds; on null it logs a warning and treats the cancellation as "no money to move". `actualRefundCents` stays 0 and the booking finalises.

`actualRefundCents` is tracked separately from `totalRefundCents` so the persisted `bookings.refundAmount` reflects what actually moved through Stripe — not what the policy would have refunded had money been there. Emails and in-app notifications quote `actualRefundCents`, so an unpaid bypass shows "Booking cancelled" without a misleading refund line.

The legacy single-payer paths (`guest-bookings.ts`, `games.ts`, `owner-bookings.ts`) already gate on `tier.refundable && tier.refundAmount > 0 && stripePaymentIntentId && !mock`, so these three guards aren't duplicated there.

## Transient `cancelling` status

A booking enters `cancelling` for the duration of the Stripe API leg. Properties:

- Acts as a single-flight lock — parallel calls see status=`cancelling` and yield to the in-flight one (idempotency keys still protect against duplicate Stripe operations).
- A failed cancellation **stays** in `cancelling` so the caller (or an admin) can retry. Status never reverts to `pending`/`confirmed`.
- Downstream consumers should treat `cancelling` as "still held" (slot is not yet released). Slot release happens on the final CAS to `cancelled`.

## Single-payer (non-coach) cancellations

The legacy paths (`bookings.ts` main DELETE for non-coach, `guest-bookings.ts`, `games.ts`, `owner-bookings.ts`) now explicitly pass:

```ts
{
  reverse_transfer: true,
  refund_application_fee: false,
  ...
}
```

`reverse_transfer: true` pulls the owner's share back proportionally from the destination. `refund_application_fee: false` ensures the platform retains its margin to cover Stripe processing fees. Same invariant as the coach-attached path; the only difference is the legacy path lets Stripe handle the proportional reversal automatically (no coach to complicate the math).

## API surface changes

- `coaches.cancellationPolicy` text default 'standard' (allowed: `flexible | standard | strict`). Wired through `CoachUpsertBody`, `formatCoach`, `formatPublicCoach`, `POST /coaches`, `PUT /coaches/:id`, `PUT /coaches/me`, and the `GET /courts/:id/available-coaches` response.
- `bookings.status` text now accepts the transient value `cancelling` in addition to the pre-existing values.
- `GET /bookings/:id/refund-preview` returns the same top-level fields as before plus: `courtRefundCents`, `coachRefundCents`, `totalRefundCents`, `courtCancellationPolicy`, `coachCancellationPolicy` (null when no coach), `hasCoach`.

## Frontend

- `pages/coach/settings.tsx` — new `<fieldset>` with three radio options for the coach's cancellation policy.
- `components/court-detail-coach-picker.tsx` — exports `coachPolicyLabel` and renders the selected coach's policy below the picker.
- `pages/court-detail.tsx` — when a coach is attached, the booking summary swaps the `<CancellationTimeline>` for a labeled two-row block ("Aikštelės: …" / "Trenerio: …"). When no coach is attached, the existing court-only timeline is unchanged.

## Security

- The cancellation route is unchanged in its authorization: only booker / court owner / admin can cancel.
- Coach policy comes from the joined `coaches` row, not from any request input. The booker can't force a more generous policy by tampering with payload.
- All refund amounts are computed server-side from `coachAmountCents` (recorded at checkout) and the joined policies. Client never supplies refund math.
- Stripe idempotency keys (`cancel-court-<id>`, `cancel-coach-<id>`, `cancel-refund-<id>`) prevent duplicate operations even if the route is called multiple times during the `cancelling` window.

## Follow-up gaps

- The coach-pays-court model is still out of scope (filtered out of `/available-coaches`).
- No partial-cancel by the player to drop only the coach while keeping the court. If shipped, the math would slot in cleanly as a refund of `coachRefundCents` only.
