# Epic 3 — Membership Discount Engine + LinkGame Join (Design Spec)

**Date:** 2026-06-09
**Branch:** `epic3-proxy-billing`
**Status:** Approved by user (design review 2026-06-09)

## Context

Korts.lt is migrating to the facility+sport "group" booking model
(`/facility/:id?sport=…`), where a group is the derived tuple
`(facilityId, sport)` and the system auto-allocates a court. Epic 2 elevated
membership plans to group level and exposed them in the group payload, but
**no membership logic exists anywhere in the booking/payment flow** — honoring
memberships is greenfield. Epic 3 builds that engine and adds a join-existing-
game (LinkGame) path to the group widget.

## Scope decisions (locked)

| Question | Decision |
|---|---|
| Membership mechanic | Flat `discountPercent` applied to server-computed price; free-slots model rejected (concurrency) |
| `weeklySlots` semantics | Cap on **discounted** bookings per ISO week (Mon–Sun, **Europe/Vilnius**) of the **play date**, not purchase date. `null`/`0` = unlimited. Cap reached → full price, never blocked |
| Recurring bookings | Discount wiring only — no overhaul of the existing client-side week-loop. Each recurring week counts against its own play-week cap |
| Discount visibility | Shown in the booking widget **before** checkout (caller-aware preview in group payload) |
| LinkGame scope | Split games only (public, open, future, with a linked split booking). Joining routes through the existing share-checkout |
| Reserved recurring slot (`dayOfWeek`/`startTime` on `user_memberships`) | Deferred indefinitely — old-model relic incompatible with the auto-allocator. Columns become nullable |
| €0 after discount | Routes through the existing confirm-free flow |
| Guests | Never receive discounts (no `userId`) |
| Multiple active plans for same (facility, sport) | Highest `discountPercent` **with remaining weekly cap** wins |
| `discountPercent` null/0 on a plan | No price change (plan may exist for other perks) |

## Architecture: two application points

Applying discounts at payment time everywhere was rejected: `booking.totalPrice`
would disagree with the charged amount, corrupting owner revenue stats.

### A. Whole-booking discounts — at booking creation

Wired **once** into `POST /search/groups/:facilityId/:sport/book`
(`artifacts/api-server/src/routes/search-groups.ts`). The booking row stores
the already-discounted `totalPrice` plus `appliedMembershipId`. This single
point automatically covers:

- **Standard booking** — `POST /payments/create-checkout` charges
  `booking.totalPrice` unchanged.
- **Recurring** — the widget's week-loop (`group-booking-widget.tsx`
  `doRecurring`) calls this same `/book` endpoint per week, so each week gets
  its own play-week discount; `POST /payments/create-recurring-checkout` just
  sums the stored totals.
- **€0 routing** — the widget already sends `totalPrice === 0` bookings to
  `POST /payments/confirm-free`. A 100% discount needs no new code.

### B. Per-share discounts — at payment time (split flows)

A split booking's `totalPrice`/`pricePerSlot` belong to all participants, so
the discount cannot be baked into the booking row. Each participant's **own**
membership discounts their **own share**, applied where the share is charged:

- Host share: `POST /search/groups/:facilityId/:sport/checkout-split`
  (`split-payments.ts`, after `pricePerSlot` is computed inside the booking
  transaction).
- Invitee share: `POST /bookings/share/:token/checkout` (`split-payments.ts`).

Tracked via new `game_participants.appliedMembershipId`. A €0 share routes
through the existing mock/confirm-free split transition (extracted into a
shared helper rather than duplicated from the Stripe-fallback catch block).

## Data model changes

Schema is pushed directly (`cd lib/db && pnpm push-force`), no migration files.

| Table | Change |
|---|---|
| `user_memberships` | `dayOfWeek`, `startTime` → **nullable** (reserved-slot relics). Subscribe endpoints stop requiring them |
| `bookings` | `appliedMembershipId integer` nullable, FK → `user_memberships.id`, `onDelete: set null` |
| `game_participants` | `appliedMembershipId integer` nullable, FK → `user_memberships.id`, `onDelete: set null` |

## Engine: `artifacts/api-server/src/lib/membership-pricing.ts` (new)

```
applyMembershipDiscount(tx, { userId, facilityId, sport, playDate, amountEur })
  → { discounted: number, membershipId: number | null, capReached: boolean }
```

1. Find the caller's active memberships for `(facilityId, sport)`:
   `user_memberships.status='active'`, `expiresAt > now()`, joined plan
   `isActive=true`. Sport matched with the existing
   `REPLACE(sport,'-','_')` normalization (see `search-groups.ts`).
2. Lock the candidate membership row(s) `SELECT … FOR UPDATE` — serializes
   concurrent checkouts; this is the only locking the engine needs.
3. **Cap count** for the play-date's ISO week (Mon–Sun, Europe/Vilnius):
   - `bookings` with this `appliedMembershipId`, `date` in week, status in
     `confirmed | awaiting_players`, **or** `pending` created `< 15 min` ago
     (same freshness convention as the slot-conflict checks).
   - **plus** `game_participants` with this `appliedMembershipId` whose game's
     `datetime` falls in the week, `paymentStatus = 'paid'` or pending
     `< 15 min`.
4. If `weeklySlots` set and count ≥ cap → `capReached: true`, full price.
5. Else `discounted = round(amountEur × (1 − discountPercent/100), 2)`.
6. No qualifying membership → amount unchanged, `membershipId: null`.

Also exported: a read-only
`getMembershipDiscountState(userId, facilityId, sport, date)` for the preview
(no locks): `{ percent, weeklySlots, usedThisWeek } | null`.

## Preview (widget visibility)

The group detail/availability response (`GET /search/groups/:facilityId/:sport`)
gains a **caller-aware** `membershipDiscount` field (null for anonymous users
and non-members), computed for the requested date's play week. The widget
renders:

- "Nario kaina: €X.XX" with strikethrough original price when a discount
  applies;
- "Šios savaitės narystės nuolaida išnaudota" when `usedThisWeek ≥ weeklySlots`.

All user-facing strings in Lithuanian. Explicit field lists only — never spread
raw DB rows.

## LinkGame join

**Backend** — group detail payload gains `openGames[]`: games at this
`(facilityId, sport)` that are `visibility='public'`, `status='open'`,
`datetime` in the future, and have a linked split booking
(`bookingId` set, booking `isSplit=true`, status `awaiting_players`).
Explicit fields: `id`, `datetime`, `durationMinutes`, `joinedCount`,
`playersNeeded`, `pricePerSlot`, `splitInviteToken`, `minSkillLevel`,
`maxSkillLevel`, `creatorName`.

**Frontend** — `group-booking-widget.tsx` gets a
"Prisijungti prie esamo žaidimo" section listing `openGames[]`. Selecting one
routes into the **existing** share-checkout
(`POST /bookings/share/:token/checkout`), which now applies the joiner's
membership discount to their share. The court is already concrete (the host's
allocation); no new allocation, no `facilitySportGroupId` abstraction.

## Security invariants (non-negotiable, from CLAUDE.md)

- Bind to the verified session principal (`getCurrentUserId` / `getAuth`);
  never trust client-supplied user IDs or prices.
- Prices always computed server-side; the discount engine takes the
  server-computed amount as input.
- Object-level authorization on every mutation; explicit response field lists.
- High-risk files touched: `payments.ts`, `split-payments.ts`,
  `search-groups.ts`, `memberships.ts` — review carefully.

## Testing / validation

Live end-to-end on a throwaway port (established pattern: build, `PORT=8095`,
agent-bypass headers, seed → exercise → clean up):

1. Member standard booking → discounted `totalPrice` + `appliedMembershipId`.
2. 4-week recurring → each week discounted against its own play-week cap.
3. (N+1)th booking in one play week → full price, `capReached` surfaced.
4. Split: host share and a second member's invitee share each discounted
   per-person; guest invitee pays full share.
5. 100%-discount member → €0 → confirm-free path, booking confirmed.
6. LinkGame: `openGames[]` lists the seeded split game; joining via share
   token charges the joiner's discounted share.
7. Concurrency sanity: two parallel checkouts against a `weeklySlots=1`
   membership → exactly one discounted.
8. `pnpm typecheck` green after every task.

## Out of scope

- Server-side atomic recurring (all-or-nothing weeks) — possible Epic 4.
- Reserved recurring slot honoring.
- Membership purchase payments (subscribing is still free/manual; Stripe for
  membership fees is a future epic).
- Admin UI for editing plans.
