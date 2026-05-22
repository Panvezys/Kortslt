# Coach Dashboard Calendar

## Purpose

Gives the coach a single-screen view of their day or week: working hours
backdrop, one-off blocks, and live bookings, with the ability to act on each
cell directly (block a free slot, reserve it manually for an off-platform
student, see booking details, or cancel a booking) without leaving the
dashboard.

Mounted on `/coach/dashboard` below the existing stat cards. The standalone
`/coach/schedule` editor is unchanged and remains the home for editing
recurring weekly working hours.

## API surface (`artifacts/api-server/src/routes/coach-schedule.ts`)

### `GET /coaches/me/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD`

One round-trip feed for the calendar. Range defaults to today through +7 days,
hard-capped at 14 days. Honors `?asCoach=<id>` for admin view-as.

Returns:

```ts
{
  range: { from, to, days: string[] },
  workingHours: Array<{ dayOfWeek: 0..6, startTime: "HH:MM", endTime: "HH:MM" }>,
  blocks: Array<{ id, startTime: ISO, endTime: ISO, reason: string | null }>,
  bookings: Array<{
    id, date, startTime, endTime, status,
    courtId, courtName, facilityName,
    serviceId, serviceName,
    customerName, customerEmail, customerPhone,
    totalPriceCents, isManual, isPaid,
  }>
}
```

The bookings query is `bookings WHERE coachId = caller's userId AND date IN range AND status != cancelled`,
joined to courts/facilities/coach_services for display context. Booker contact
fields are returned because the calendar is private to the coach and they
need a way to reach their students.

### `POST /coaches/me/manual-bookings`

Coach reserves a slot for an off-platform student. Mirrors the existing
`/owner/bookings/manual` pattern.

Body: `{ courtId, customerName, customerEmail?, customerPhone?, date, startTime, endTime, note? }`.

Authorization:
- `requireCoach` (admin allowed too).
- Coach must be approved at the chosen court (`courtCoachesTable.coachId = me AND courtCoachesTable.courtId = body.courtId`).

Behavior:
- Returns **409** if the new slot overlaps an existing live booking on the
  same coach for the same date.
- Inserts a `bookings` row with `status=confirmed`, `totalPrice=0`,
  `bookerUserId=null`, `coachId = caller's userId`, `notes = body.note`.
- Returns the created booking.

Off-platform billing is intentionally out of scope: the coach handles payment
externally; the booking just exists to occupy the slot so other systems treat
it as unavailable.

### `DELETE /bookings/:id` (extended)

The existing cancellation flow was extended to authorize one more principal:
the booking's attached coach (`bookings.coachId === userId`). The refund math,
Stripe lock acquisition, and notification fan-out are unchanged — this is
purely an auth-list addition.

## Frontend (`artifacts/courtbook`)

### Component

`src/components/coach-schedule-calendar.tsx` — single self-contained component
that owns:

- **Day / Week toggle** — `Tabs` with two values. Day default.
- **Date nav** — prev/next button + "Šiandien" jump. Day mode advances 1 day;
  week mode advances 7 days and snaps to Monday.
- **Day grid** — vertical list of 30-min slots from the working-hours
  envelope for that weekday. Each row is a button.
- **Week grid** — 7 columns × N rows (union of all slot starts that appear
  in any of the 7 days). Each cell is a compact button.
- **Cell color coding**:
  - Free (working hours, no block, no booking) → muted hover.
  - Blocked → amber tint, `Lock` icon, reason or "Užbl.".
  - Booked → primary tint, `User` icon, customer name, "Rankinis" badge for
    manual reservations.
- **Action sheets** — each cell kind opens a different modal:
  - Free → `SlotActionDialog` with two tabs: **Blokuoti** (writes a 30-min
    `coach_blocked_slot`) and **Rezervuoti** (writes a `manual-bookings`
    row; requires picking an affiliated court).
  - Booked → `BookingDetailsDialog` with student contact, court, service,
    status, price, and a destructive **Atšaukti rezervaciją** button that
    routes through the shared `DELETE /bookings/:id` flow.
  - Blocked → `RemoveBlockDialog` with a destructive **Pašalinti bloką**
    button that uses the existing `DELETE /coaches/me/blocked-slots/:id`.

### Data flow

```
GET /coaches/me/schedule    → buildCellMap(workingHours, blocks, bookings)
                            → { [date]: { [slot]: Cell } }
                            → DayGrid | WeekGrid
                            → click → ActionDialog | DetailsDialog | RemoveBlockDialog
                            → mutation → invalidate ["coach-schedule"]
```

### Cell map building

`buildCellMap(days, workingHours, blocks, bookings)` is a pure helper:

1. Seed every working-hour 30-min start in range as `{ kind: "free" }`.
2. Overlay every block: walk every 30-min step within `[block.start, block.end)`
   on the block's date and mark each as `{ kind: "blocked", block }`. Blocks
   outside the working-hours envelope are silently dropped — they don't have
   a visual home anyway.
3. Overlay every booking the same way.

Cells outside working hours are simply absent from the map; the renderer
shows a muted dead cell for those.

### View-as integration

Calendar respects admin view-as just like the other coach pages:
- Schedule query key includes `asCoachId`, URL goes through `withCoachViewAs`.
- In view-as mode all mutation buttons (block, reserve, cancel, remove
  block) are disabled with an explanatory `title`.

## Known scope cuts

- **No drag-to-block.** Each block created from the calendar is exactly one
  30-min slot. Multi-slot blocks live on `/coach/schedule` (which writes
  ranged `coach_blocked_slots`).
- **Manual reservations don't trigger payment.** They're treated as
  off-platform agreements — the booking row carries `totalPrice = 0` and no
  Stripe references.
- **No conflict check at booking time.** The overlap check only looks at the
  same coach's other bookings, not at the court's broader calendar. If the
  court is double-booked through another channel, the coach's slot still
  saves. This matches the off-platform-agreement intent but is something to
  revisit if manual reservations grow into a primary booking path.
- **Booker contact in view-as.** Admins inspecting another coach's dashboard
  see the booker contact details (email/phone), which is sensitive. Today's
  trust model treats admins as fully trusted; if that changes, redact
  contact fields when the request carries `?asCoach=`.
