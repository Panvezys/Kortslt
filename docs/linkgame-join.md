# LinkGame — Join an Existing Split Game

The public facility-sport page surfaces joinable public split games so a
visitor can pay for a free slot instead of creating a new booking. Implemented
in Epic 3 alongside the membership discount engine.

## Backend — `openGames[]` on group detail

`GET /api/search/groups/:facilityId/:sport` (public, unauthenticated) includes
`openGames: GroupOpenGame[]` — games at this facility+sport where ALL of:

- `games.visibility = 'public'` (the only gate keeping private tokens secret —
  the share token itself is the join credential, so never relax this),
- `games.status IN ('awaiting_players', 'open')`,
- linked booking `isSplit = true` AND `status = 'awaiting_players'`,
- `games.datetime` in the future (Vilnius wall-clock string comparison),
- free slots remain (`joinedCount < playersNeeded`, counting
  `game_participants.status = 'joined'` — same rule as the join transaction's
  capacity check).

Each entry is an explicit field list (no raw-row spread): `id, datetime,
durationMinutes, joinedCount, playersNeeded, pricePerSlot` (full share),
`splitInviteToken, minSkillLevel, maxSkillLevel, creatorName`. Implementation:
`artifacts/api-server/src/routes/search-groups.ts` (detail handler); client type
mirror in `artifacts/courtbook/src/lib/search-groups-types.ts`.

## Frontend

`group-booking-widget.tsx` accepts `openGames?: GroupOpenGame[]` (threaded from
`facility-sport.tsx`) and renders up to 3 entries ("Prisijungti prie esamo
žaidimo") between the extras toggles and the price summary — hidden while the
user has split or recurring mode enabled. Each row links to
`${BASE}/join/${splitInviteToken}`.

## Join flow

Joining reuses the existing share flow end-to-end: `/join/:token`
(`join-booking.tsx`) → `POST /api/bookings/share/:token/checkout`
(`split-payments.ts`). The join transaction re-validates capacity under a
booking-row `FOR UPDATE`, applies the joiner's own membership discount (see
`docs/membership-discount-engine.md`), and settles €0 shares without Stripe.
Stale widget data degrades gracefully — a filled game 409s with a clear
Lithuanian error on the join page.
