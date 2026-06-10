# Membership Discount Engine

Members with an active facility+sport membership get `discountPercent` off their
own court cost, capped at `weeklySlots` uses per ISO week. Implemented in Epic 3
(branch `epic3-proxy-billing`); design spec at
`docs/superpowers/specs/2026-06-09-epic3-discount-engine-linkgame-design.md`.

## Data model

- `court_memberships` (plans): `discountPercent`, `weeklySlots` (null/0 = unlimited),
  facility+sport scoped (Epic 2 Option A; per-court relics still supported).
- `user_memberships`: active subscription rows; `dayOfWeek`/`startTime` are
  **nullable relics** (subscribe no longer requires them).
- `bookings.appliedMembershipId` → `user_memberships.id` (`SET NULL` on delete):
  set when a whole-booking discount was applied at creation.
- `game_participants.appliedMembershipId`: set when a participant's own split
  share was discounted at payment time.

## Engine — `artifacts/api-server/src/lib/membership-pricing.ts`

`applyMembershipDiscount(tx, { userId, facilityId, sport, playDate, amountEur })`
→ `{ discounted, membershipId, capReached, percent }`

- Guests (`userId: null`) pass through at full price.
- Candidate = active membership (status active, not expired, plan active) for
  the facility+sport (sport matched via `REPLACE(col,'-','_')`), highest
  `discountPercent` first; rows locked `FOR UPDATE` to serialize cap accounting.
- Weekly cap counts **the play-date's ISO week** (Mon–Sun, Vilnius wall-clock,
  noon-anchored date math), not the purchase week. Counted uses = bookings
  (confirmed/awaiting_players, or pending <15 min old) + game participant shares
  (paid, or pending <15 min old, via `SUBSTRING(games.datetime FROM 1 FOR 10)`).
- Cap reached → full price (`capReached: true`), never a hard block.
- Rounding is integer-cents: `Math.round(Math.round(eur*100)*(100-pct)/100)/100`.
- **LOCK ORDERING CONTRACT** (documented in the file): `user_memberships` rows
  must be the LAST lock a transaction acquires. All call sites comply — `/book`
  and `checkout-split` take a `pg_advisory_xact_lock` first, share-checkout takes
  the booking-row `FOR UPDATE` first, and all of them only INSERT afterward.

`getMembershipDiscountState(userId, facilityId, sport, date)` → read-only
`{ percent, weeklySlots, usedThisWeek } | null` for UI previews.

## Wiring points

| Where | What gets discounted |
|---|---|
| `POST /search/groups/:fid/:sport/book` (`search-groups.ts`) | Whole booking: court cost only (equipment full price); booking stores discounted `totalPrice` + `appliedMembershipId`. Covers standard, recurring (widget loops `/book` per week), and €0 → existing confirm-free path. |
| Availability `GET …/availability` (`search-groups.ts`) | No discount — returns `membershipDiscount` preview (degrades to `null` on error). |
| `POST /search/groups/:fid/:sport/checkout-split` (`split-payments.ts`) | Host's own share only. Booking keeps FULL `totalPrice`/`pricePerSlot`; discount tracked on the host's `game_participants` row. |
| `POST /bookings/share/:token/checkout` (`split-payments.ts`) | Joining invitee's own share only (guests never). |
| `POST /bookings` (`bookings.ts`) | Legacy `/courts/:id` flow — same semantics as group `/book`: court cost only, discounted `totalPrice` + `appliedMembershipId` on the booking. |
| `POST /games/checkout-split` (`split-payments.ts`) | Legacy split flow — host-share parity with the group checkout-split (booking keeps full price; host participant carries `appliedMembershipId`). Also wrapped in the same advisory-lock transaction. |
| `GET /courts/:id/availability` (`courts.ts`) | No discount — `membershipDiscount` preview appended after the OpenAPI schema parse (the schema would strip it). |

## €0 settle paths

A 100%-discounted split share is settled without Stripe via the same logic as
the mock fallback: session ids `free_split_<bookingId>_<ts>` (host) /
`free_split_join_<bookingId>_<ts>` (invitee). The guarantee sweep excludes
`free_split*` sessions from refunds and refund emails; refund emails state the
actual Stripe `amount_total`, not the nominal share.

## Frontend

`group-booking-widget.tsx` renders the preview: strikethrough full price +
"Nario kaina (−X%)" member price in the summary, total/button/recurring-estimate
use the discounted court price, and a "Šios savaitės narystės nuolaida
išnaudota" notice when capped. Split per-player labels stay full price (shares
are discounted per participant at payment time). `court-detail.tsx` (legacy
page) mirrors the same conventions for its standard and recurring summaries.

## Relevant files

`artifacts/api-server/src/lib/membership-pricing.ts`,
`artifacts/api-server/src/routes/search-groups.ts`,
`artifacts/api-server/src/routes/split-payments.ts`,
`artifacts/api-server/src/routes/memberships.ts`,
`lib/db/src/schema/{bookings,games,memberships}.ts`,
`artifacts/courtbook/src/components/group-booking-widget.tsx`.
