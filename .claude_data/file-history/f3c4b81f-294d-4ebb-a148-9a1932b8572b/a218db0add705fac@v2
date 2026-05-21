# Coach Payments & Unified Booking

## Purpose

Lets a player book a court and attach a coach in one Stripe checkout. The platform splits the payment three ways: court owner gets the court fee (less platform skim), coach gets their lesson fee, platform retains a percentage of the court portion.

## Scope of Strike 2

- Only `courtPaymentModel = 'student_pays_court'` is wired. Coaches with `coach_pays_court` are filtered out of `/available-coaches` and rejected by the checkout endpoint.
- Refund/cancellation flow does **not** reverse the coach transfer yet — if a booking with a coach is cancelled, only the court refund happens. The coach transfer remains on the coach's Stripe balance. Tracked for a follow-up strike.

## Data model

- `coachesTable` (already in place): `pricePerHour` (integer cents), `travelPolicy`, `courtPaymentModel`.
- `user_profiles.stripeAccountId` + `stripeAccountStatus`: canonical Stripe Connect state. **Reused for coaches** — no separate mirror on `coachesTable`. A user who is both an owner and a coach has one Stripe account.
- `bookingsTable` (new columns this strike):
  - `coachId text NULL` — Clerk userId of the coach attached to the booking (mirrors the `bookerUserId` text-no-FK pattern). Already existed pre-strike; now populated.
  - `coachAmountCents integer NULL` — coach's share in cents, captured at checkout so the post-payment transfer doesn't recompute from a possibly-drifted `pricePerHour`.
  - `coachTransferId text NULL` — Stripe transfer id set after `stripe.transfers.create` succeeds. Idempotency marker.

## API surface

### Coach Stripe onboarding (`coach-stripe.ts`)

Coach-side wrappers around the same `user_profiles` Stripe state that owners use. Distinct routes so the return URL lands on `/coach/dashboard`.

- `POST /coaches/stripe/onboard` — creates the Express Connect account if missing, returns an Account Link URL.
- `GET /coaches/stripe/return` — re-checks the live Stripe account and syncs `user_profiles.stripeAccountStatus`.

The dashboard (`pages/coach/dashboard.tsx`) renders a `StripeOnboardingBanner` until status is `active`, with a CTA to `POST /coaches/stripe/onboard`.

### Coach matrix endpoint (`coach-schedule.ts`)

`GET /courts/:id/available-coaches?date=...&startTime=...&endTime=...` (`requireAuth`) returns the coaches a player can attach to a window at this court. Filters:

1. `status='approved'` and `isAcceptingStudents=true`.
2. `courtPaymentModel='student_pays_court'`.
3. `user_profile.stripeAccountStatus='active'`.
4. `travelPolicy='any_court'` OR an approved `courtCoachesTable` row for this `courtId`.
5. `getCoachAvailability` covers every 30-min slot in the window continuously.

Window must align to 30-minute boundaries.

### Checkout integration (`payments.ts`)

`POST /payments/create-checkout` accepts an optional `coachId` (numeric serial pk). When set, the route:

1. Re-authorizes via `authorizeAndPriceCoach` — same filters as `/available-coaches`, run server-side. Returns 422 on any failure (booker can't forge a coach attachment past the picker).
2. Requires the court owner's `user_profile.stripeAccountStatus='active'`. Without it, returns 422 (we can't destination-charge funds).
3. Computes `coachCents = round(coach.pricePerHour * minutes / 60)` from the booking's `startTime`/`endTime`.
4. Builds the Stripe Checkout session with `transfer_data.destination = owner` and `transfer_data.amount = courtCents − 5%` (owner net share). `application_fee_amount` is omitted — Stripe ignores it when `transfer_data.amount` is set. The remainder (`coachCents + 5% of court`) sits on the platform balance.
5. Persists `coachId` (text userId), `coachAmountCents`, and the updated `totalPrice` on the booking row only after the Stripe call succeeds — so a failed Stripe call doesn't leak coach data onto an unpaid booking.

When `coachId` is absent, the existing single-payer flow is preserved unchanged: `application_fee_amount = 5%` of total, `transfer_data.destination = owner`, no `transfer_data.amount`.

### Coach transfer (`lib/coach-transfer.ts`)

`maybeIssueCoachTransfer(booking, stripe)` fires `stripe.transfers.create` for the coach's share. Called from two places:

- `POST /payments/confirm` — after the success-page flips the booking to `confirmed`.
- `stripe-webhook` `checkout.session.completed` — the canonical event source.

Both paths race after a successful payment. Idempotency is enforced at three levels:

1. Early-return when `booking.coachTransferId` is already set.
2. Stripe `idempotency_key = "coach_transfer_booking_<id>"` — duplicate calls return the same transfer.
3. DB update of `coachTransferId` after success — second caller is a no-op.

The transfer carries `source_transaction = charge.id` (resolved by retrieving the PaymentIntent with expanded `latest_charge`) so Stripe reporting links the transfer to the original charge.

## Frontend

- `pages/court-detail.tsx` — after a slot is selected, renders `<CourtDetailCoachPicker>`. Selecting a coach attaches `selectedCoach` state and bumps the booking summary panel to show "Aikštelės nuoma / Treneris (Name) / Iš viso". Coach selection is dropped automatically when the slot or date changes.
- `components/court-detail-coach-picker.tsx` — fetches `/courts/:id/available-coaches`, renders each candidate with photo, price/hour, and a "Pasirinkti" toggle.
- `pages/coach/dashboard.tsx` — `<StripeOnboardingBanner>` reads `/coaches/stripe/return` for status and offers a CTA to `/coaches/stripe/onboard`. Auto-refreshes when the page is loaded with `?stripe_return=success`.

## Money math (all in integer cents)

```
courtCents       = booking.totalPrice * 100   (pre-coach)
coachCents       = round(coach.pricePerHour * minutes / 60)
totalCents       = courtCents + coachCents
platformFeeCourt = round(courtCents * 5 / 100)

Stripe session.unit_amount = totalCents
transfer_data.amount        = courtCents - platformFeeCourt    (owner net)
platform balance after pay  = coachCents + platformFeeCourt
transfers.create({amount: coachCents, destination: coach.stripeAccount})
platform retains            = platformFeeCourt
```

## Security

- Coach attachment is **always** re-authorized server-side at checkout. The frontend picker is a UI convenience; bypassing it (POSTing an arbitrary `coachId`) hits the same filters in `authorizeAndPriceCoach`.
- Coach pricing is computed server-side from `coachesTable.pricePerHour` and the booking's stored window. Client never supplies the amount.
- Booker authorization is unchanged: the existing principal binding on `/payments/create-checkout` (booker / court owner / admin / guest-token holder) still gates access. Coach attachment doesn't widen who can call the endpoint.
- The `availability matrix endpoint is `requireAuth` only — availability is intentionally semi-public so any logged-in user can pick a coach.

## Follow-up gaps (deferred)

- `coach_pays_court` payment model: coach books, bills student a combined rate, owes the court owner outside Stripe.
- Refund flow: reverse the coach transfer via `transfers.createReversal` when a booking with a coach is cancelled or refunded.
- `bookings.coachId` is read by the availability matrix; no UI yet shows coaches their own upcoming lessons (will come when the coach-lessons inbox lands).
