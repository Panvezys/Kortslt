# Coach Bookings Inbox

## Purpose

Single screen where a coach reviews every lesson they've been attached to —
past, present, future — with the student contact information they need to
follow up, and the payment state for each row.

Lives at `/coach/bookings` in the sidebar between Paslaugos and Mokiniai.

## API surface

### `GET /coaches/me/bookings` (`coach-dashboard.ts:261`)

`requireCoach` + view-as-aware. Query params (all optional):

| Param | Values | Default | Notes |
|---|---|---|---|
| `scope` | `all` \| `upcoming` \| `past` | `all` | Compared against today (Vilnius local). |
| `status` | `all` \| `confirmed` \| `awaiting_players` \| `pending` \| `cancelled` | `all` | `blocked` is always excluded — those rows are owner court-blocks, not lessons. |
| `from`, `to` | `YYYY-MM-DD` | none | Inclusive bounds layered on top of `scope`. |
| `search` | string (1–120 chars) | none | ILIKE substring match against `customerName`, `customerEmail`, `customerPhone`. |
| `sort` | `date` \| `price` | `date` | Falls back to date/start time when prices tie. |
| `order` | `asc` \| `desc` | `asc` for upcoming, `desc` for past, `asc` otherwise | Explicit `order` always wins. |
| `limit` | 1–100 | 20 | |
| `offset` | ≥ 0 | 0 | |

Returns `{ items, total, hasMore, limit, offset }`. Per-item shape:

```ts
{
  id, date, startTime, endTime, durationMin, status,
  courtId, courtName, facilityName,
  serviceId, serviceName,
  customerName, customerEmail, customerPhone,
  bookerUserId,                    // null for guest / manual bookings
  isManual,                        // bookerUserId == null && totalPrice == 0
  totalPriceCents,                 // what the student paid (full price)
  coachAmountCents,                // coach share captured at checkout, or null
  coachTransferId,                 // set once the transfer to coach fires
  refundCents,                     // 0 unless a refund was issued
  notes, createdAt,
}
```

The total count uses the same `WHERE` predicate as the list query, so the
"X rezervacijos" caption stays in sync with what the user actually sees.

## Frontend (`pages/coach/bookings.tsx`)

- Scope segmented control (`Visi | Būsimi | Praėję`) drives the default sort.
- Search input is debounced 300ms before re-querying.
- TanStack `useInfiniteQuery` — "Daugiau" button loads the next page; the
  query key includes `asCoachId`, scope, status, search, sort, order so any
  filter change is a fresh query (not a refetch on top of stale rows).
- Each card surfaces:
  - Date + start time on the left rail (the eye lands on "when").
  - Student name + status badge + payment badge + "Rankinis" badge when manual.
  - Full date, time range + duration, facility · court, service name.
  - Student email/phone (clickable `mailto:` / `tel:`).
  - Free-text `notes` rendered in muted italics when present.
  - Headline price = `coachAmountCents` when available, falling back to
    `totalPriceCents`. Refund line appears under the price when present.
  - "Žinutė" button → `/messages?u=<bookerUserId>` (hidden for guests).

## Payment badge logic

A small derivation done client-side so the badge stays close to the rendering
code:

| Condition | Badge | Variant |
|---|---|---|
| `status='cancelled' AND refundCents > 0` | `Grąžinta` | danger |
| `isManual` | `Be mokėjimo` | muted |
| `coachTransferId != null` | `Pervesta` | success |
| `status='confirmed' AND totalPriceCents > 0` | `Apmokėta` | success |
| `status='awaiting_players'` | `Laukia žaidėjų` | warning |
| `status='pending'` | `Laukia mokėjimo` | warning |
| otherwise | `—` | muted |

The DB-level status badge (`Patvirtinta` / `Atšaukta` / etc.) is shown
alongside, so a cancelled-and-refunded row reads cleanly as
`Atšaukta · Grąžinta`.

## View-as

Admins impersonating a coach see that coach's bookings via the
`?asCoach=<id>` query param threaded through `withCoachViewAs`. The endpoint
binds to `resolveCoachUserId(req)` for the underlying `eq(bookings.coachId, …)`
predicate, so impersonated views never leak across coaches.
