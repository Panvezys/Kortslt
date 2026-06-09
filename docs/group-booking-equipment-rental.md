# Group Booking — Equipment Rental

Sport-dependent equipment rental for the **facility+sport group** booking flow
(`/facility/:id`). Lets a player add rentable gear (e.g. a tennis racket) to a
group booking. Equipment is inherently sport-scoped because every court has a
single sport `type`, so a tennis group only ever surfaces tennis equipment.

## Data model

- `courts.rentable_items` — JSON text column: `{ name, pricePerSlot, stock }[]`.
  Each court owns its own equipment list and stock. (Legacy rows may use
  `pricePerBooking`; both are read server-side.)
- `bookings.rented_items` — JSON text column: the **validated, server-priced**
  selection stored on the booking: `{ name, pricePerSlot, quantity }[]`.

Equipment cost is `pricePerSlot × quantity × slotCount` (slotCount = number of
30-min slots in the booking), added to the court price in `bookings.total_price`.

## API surface (`artifacts/api-server/src/routes/search-groups.ts`)

### `GET /search/groups/:facilityId/:sport/equipment`
Aggregates rentable equipment across the group's courts for a given slot.
Query: `date`, `startTime`, `endTime`, optional `courtId` (scope to one court).
Returns `{ name, pricePerSlot, available, stock }[]` sorted by name, where:
- `pricePerSlot` = **min** price across courts offering the item,
- `available` = **max** across courts of `(stock − overlapping booked qty)`,
- `stock` = **max** stock across courts.

`max` is correct because a single booking lands on exactly one court — if any
court can supply N units for the slot, the booking is satisfiable.

### `POST /search/groups/:facilityId/:sport/book`
Equipment-aware auto court allocation. Accepts `rentedItems` as a JSON string of
`{ name, quantity }[]` (only name + quantity are trusted; quantity clamped 1–20).
The endpoint iterates courts in wear-balanced order; for each candidate court it:
1. checks slot availability (advisory-locked per court+date),
2. validates each requested item against **that court's** stock minus overlapping
   booked quantity, throwing `EquipmentShortError` if the court doesn't offer the
   item or is short,
3. prices the equipment server-side and writes `total_price` + `rented_items`.

If a court is slot-free but equipment-short, allocation continues to the next
court. Final responses:
- `409 EQUIPMENT_UNAVAILABLE` — slot was bookable somewhere but no court could
  supply the requested equipment,
- `409 SLOT_UNAVAILABLE` — no court free for the slot at all.

Plain (equipment-free) bookings are never blocked by equipment shortages — they
fall through to any free court.

## Frontend

- **`group-booking-widget.tsx`** — fetches the aggregation endpoint for the
  selected slot (scoped to `courtId` when a specific court is chosen, otherwise
  the whole group). Renders a collapsible "Pridėti įrangą" selector (checkbox +
  quantity stepper + "Likę: N vnt.") only for **standard** single bookings —
  hidden when split or recurring is enabled (`equipmentApplies`). The price
  summary breaks out Aikštelė / Įranga and the reserve button shows the combined
  total. The booking POST sends `rentedItems` as `[{ name, quantity }]` on both
  the auto-allocation path and the specific-court `/api/bookings` path.
- **`owner/court-create.tsx`** — the "Nuomojama įranga" editor shows
  sport-aware suggestion chips (`SUGGESTED_EQUIPMENT` keyed by sport), so a
  tennis court suggests "Teniso raketė" / "Kamuoliukų rinkinys" and never a
  padel racket. Clicking a chip prefills the item-name input.

## Security

- Only item **name + quantity** are accepted from the client; price and stock
  are always read from `courts.rentable_items` server-side. A spoofed
  `pricePerSlot` in the payload is ignored.
- Stock is validated against overlapping bookings inside the same advisory-locked
  transaction that allocates the slot, preventing oversell races.

## Relevant files

- `artifacts/api-server/src/routes/search-groups.ts` — equipment endpoint + book validation
- `artifacts/api-server/src/routes/bookings.ts` — canonical per-court equipment validation (`POST /bookings`)
- `artifacts/courtbook/src/components/group-booking-widget.tsx` — selector UI, fetch, payload
- `artifacts/courtbook/src/pages/owner/court-create.tsx` — owner suggestion chips
- `lib/db/src/schema/courts.ts` / `bookings.ts` — `rentable_items` / `rented_items` columns
