# Court Category Generator — Design Spec
Date: 2026-05-28

## Problem
Owners currently create courts one at a time through a heavily-tabbed form. A facility with 4 identical clay tennis courts requires filling the same form four times. This is the primary friction point in owner onboarding.

## Decisions Locked In
- **Single entry point** (full replacement of the existing form). `quantity=1` covers the single-court case via progressive disclosure.
- **Pricing is per-court, not category-locked.** The category form sets the default `pricePerHour` for all generated rows; individual courts can deviate freely via their edit screen afterward.
- **Photos are duplicated per court (Option A).** Each generated court gets its own independent rows in `court_photos`, sharing the same URL string. Courts are autonomous entities — deleting one does not affect siblings.
- **Backend approach: new `POST /courts/bulk` endpoint (Option A).** The existing `POST /courts` and its generated OpenAPI hook (`useCreateCourt`) are untouched.

## Architecture

### Backend — `POST /api/courts/bulk`

**File:** `artifacts/api-server/src/routes/courts.ts`

**Auth:** `requireAuth` + ownership check via `isOwner(req, facility.ownerUserId)`

**Request body:**
```ts
{
  facilityId: number;
  type: string;           // sport slug, e.g. "tennis"
  isIndoor: boolean;
  surface?: string;
  pricePerHour: number;   // min 1
  quantity: number;       // 1–20
  amenities?: string[];
  photoUrls?: string[];   // URLs from POST /upload/court-image (pre-uploaded before this call)
}
```

**Steps:**
1. Validate body (Zod inline schema — do NOT touch `CreateCourtBody` / OpenAPI spec)
2. Ownership check
3. Query existing courts for this `(facilityId, type)` to find the highest trailing number in names matching `"{SportLabel} - N"` — new batch starts from `maxN + 1` (avoids collision on second batch)
4. Build array of N insert values with auto-names: `${SPORT_LABELS[type]} - ${startIndex + i}`
5. `db.insert(courtsTable).values([...array]).returning()` — single atomic transaction
6. If `photoUrls` provided: for each `(courtId, photoUrl)` pair, batch-insert into `courtPhotosTable` — one more insert, all rows at once. Each court gets its own independent rows pointing to the same URL.
7. Respond `201 { courts: [{id, name}] }`

**Auto-naming regex for sequence detection:** `/^.+ - (\d+)$/` on existing court names for this facility+sport.

### Frontend — `court-create.tsx` (full replacement)

Single-page form, no tabs. Fields:

| Field | Component | Validation |
|---|---|---|
| Sporto šaka | `Select` using `SPORT_LABELS` | Required |
| Vieta | `Toggle` Vidaus / Lauko | Required |
| Danga | `Select` (clay, hard, grass, carpet, wood, rubber) | Optional |
| Kaina / val (€) | `Input[number]` | Required, min 1 |
| Kiekis | `Input[number]` 1–20 | Default 1 |
| Kategorijos nuotraukos | `<CourtImageUpload />` | Optional, max 3 |

Callout box below form: *"Išplėstiniai nustatymai (Smart Lock, darbo laikas, įranga) bus prieinami kiekvienai aikštelei atskirai po sukūrimo."*

**Submit flow:**
1. For each selected gallery file: `POST /upload/court-image` → collect returned `url` strings into `photoUrls[]`
2. `POST /api/courts/bulk` with form values + `photoUrls` — backend inserts photo rows for every generated court atomically
3. On 201: `navigate(\`/owner/facility/${facilityId}?generated=${courts.length}\`)`

### Frontend — Post-creation handoff (`owner-facility-detail.tsx`)

Read `?generated=N` query param on mount. If present, show a dismissible success banner:
*"N aikštelių sukurta sėkmingai. Spustelėkite 'Redaguoti' norėdami pridėti išplėstinius nustatymus."*

No other changes to the facility page — courts already render as cards with "Redaguoti" links to `/owner/facility/:id/court/:courtId/edit` (the full existing edit form with all advanced fields).

## Out of Scope (V1)
- "Numbers vs Letters" naming style toggle
- Bulk price update across a category after creation
- Category-level photo management UI (photos are managed per-court after generation)

## Files Changed
| File | Change |
|---|---|
| `artifacts/api-server/src/routes/courts.ts` | Add `POST /courts/bulk` handler |
| `artifacts/courtbook/src/pages/owner/court-create.tsx` | Full replacement with category form |
| `artifacts/courtbook/src/pages/owner-facility-detail.tsx` | Add `?generated=N` banner |
