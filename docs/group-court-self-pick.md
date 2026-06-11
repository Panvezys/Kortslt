# Group booking: court self-pick

Players booking a facility+sport group (e.g. 3 tennis courts at one facility)
either let the system auto-allocate a court or pick a specific one in the
booking widget. This doc covers how the pick is honored end-to-end.

## Behavior

- **Auto (default)**: the allocator tries courts cheapest-for-the-requested-range
  first, then least 7-day usage (wear balancing), then id. The grid shows a slot
  as available if *any* court is free; its price is the cheapest free court's.
- **Self-pick**: the availability grid, slot prices, allocation, equipment
  availability, recurring pre-check, and split checkout are all scoped to the
  chosen court. A conflict on the picked court is a hard 409 — it never silently
  falls back to a different court.
- The booking row stores the concrete allocated `courtId` either way, so
  /bookings, the booking detail/receipt, and emails always show the specific
  court (name + photo).

## API surface

- `GET /search/groups/:facilityId/:sport/availability?date=…&courtId=…` —
  optional `courtId` restricts slot availability + per-slot prices to that
  court. The `courts` array in the response always lists the whole group (it
  feeds the picker). Foreign/unknown courtId → 404.
- `POST /search/groups/:facilityId/:sport/book` — optional `courtId` in the
  body pins allocation to that court (still advisory-locked + conflict-checked,
  equipment validated against that court's stock, membership discount applied).
- `POST /search/groups/:facilityId/:sport/checkout-split` — optional `courtId`
  (Zod-validated) pins the split booking's court the same way.
- `GET /search/groups/:facilityId/:sport/equipment?courtId=…` — already
  supported court scoping; unchanged.

In all three new spots the court list query is already scoped to
facility+sport+active status, so filtering by id doubles as the
"court belongs to this group" check.

## Frontend

`group-booking-widget.tsx`:
- The court `Select` (auto + per-court options) drives `selectedCourtId`.
- Availability query includes `selectedCourtId` in the queryKey and URL.
- `doBook` always calls the group `/book` endpoint (the legacy
  `POST /api/bookings` call was removed from the widget), passing `courtId`
  when picked.
- `doSplit` and `doRecurring` (including the per-week availability pre-check)
  pass `courtId` when picked.
- Waitlist entries use the picked court instead of the group's first court.

## Legacy /courts retirement (complete)

The `/courts` listing and `/courts/:id` detail pages have been **deleted**
(`courts.tsx`, `court-detail.tsx`, `related-courts-carousel.tsx`, plus the
backend `/courts/:id/related` route). Old links survive via redirect routes in
`App.tsx`: `/courts` → `/explore`, and `/courts/:id` resolves the court's
facility+sport (public API) and lands on the group page — this keeps printed
QR codes and previously sent emails working.

The **linkGame upgrade flow** ("Užsakyti aikštelę šiam žaidimui" on a casual
game) was ported off the legacy pages: game-detail → `/explore?linkGameId=…`
(banner + threading via `buildDetailHref`) → facility-sport fetches the game →
`GroupBookingWidget` gets `linkGame={id, playersNeeded}`, presets split mode +
player count, and sends `linkGameId` to the group `checkout-split` (now
Zod-accepted: creator-only 403 check, reuses the existing game instead of
creating one, attaches booking/court on settle — mock, €0, and Stripe-metadata
paths all covered) or to `payments/create-checkout` for a standard booking.

All references point at group pages:

- `src/lib/email.ts` — `courtPageUrl(courtId)` resolves facility+sport and
  links emails to `/facility/:id?sport=…`, falling back to `/courts/:id` if the
  lookup fails. Used by booking confirmation, waitlist, and both split emails.
- Legacy split checkout `cancel_url` → group page (fallback legacy).
- `artifacts/courtbook/src/lib/court-links.ts` — shared `courtGroupHref()`
  helper (group URL with legacy fallback); used by home (cards + map
  info-windows), favorites. `facility.tsx` venue page links its court cards to
  group pages directly.

All remaining player/owner/admin surfaces now link to group pages too:
my-matches, open-matches, game-detail, join-booking, tournament-detail, chat
context links (`chat-bubble.tsx`, `messages.tsx` — facility contexts go to
`/facilities/:id`), owner reviews, admin review moderation + approved-court
preview, owner QR codes, owner court previews (`owner-facility-detail.tsx`,
`court-dashboard.tsx`, `court-create.tsx`), and the shared `CourtCard`
(active/approved courts only — pending courts in admin approvals keep
`/courts/:id`, since group pages only surface active courts). Backend payloads
gained `courtType`/`facilityId` where missing: `/games/my`, `/matches/open`,
`/owner/court-reviews`, `/court-reviews` (admin feed).

`courtGroupHref` (and every other fallback — back-button, email links, split
cancel URLs, booking surfaces) now degrades to `/explore` when facility data is
missing; no code path emits a `/courts` URL anymore.
