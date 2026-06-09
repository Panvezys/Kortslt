# Per-sport Court Icons

Sport-specific, top-down **court-diagram** icons (tennis court, basketball
court, football pitch, snooker table, etc.) used in court/venue contexts such as
the court-count badge. The per-sport metadata (which icon, color, label,
ordering, enabled) is stored in an editable DB table so it can be changed later
without a redeploy; the SVG art itself stays in code.

These are distinct from the existing **ball/equipment glyphs** (`SportIcon`),
which remain in use for sport pills, chips, games, and ELO — court icons are
scoped to court-count / venue contexts only.

## Data model

`sport_icons` table (`lib/db/src/schema/sport-icons.ts`):

| column      | type      | notes                                          |
|-------------|-----------|------------------------------------------------|
| `sport`     | text (PK) | canonical slug (e.g. `tennis`, `table_tennis`) |
| `icon_key`  | text      | references a code-defined court component      |
| `color`     | text      | hex brand color                                |
| `label`     | text      | Lithuanian label                               |
| `sort_order`| int       | display ordering                               |
| `enabled`   | bool      | excluded from the API when false               |
| `updated_at`| timestamptz |                                              |

The table never stores SVG markup — only a key + metadata — so there is no
arbitrary-HTML / XSS surface. The art lives in `sport-icon.tsx`, keyed by
`icon_key`.

## API surface (`artifacts/api-server/src/routes/sport-icons.ts`)

- `GET /api/sport-icons` — public. Auto-seeds from `INITIAL_SPORT_ICONS` if the
  table is empty, then returns enabled rows (`sport, iconKey, color, label,
  sortOrder`) ordered by `sortOrder`. Explicit field list (no raw row spread).
  `Cache-Control: public, max-age=300`.
- `POST /admin/sport-icons/seed` — admin-only; inserts any missing default rows.

## Court SVG art (`artifacts/courtbook/src/components/sport-icon.tsx`)

A family of top-down court components — `TennisCourtIcon`, `PadelCourtIcon`,
`BadmintonCourtIcon`, `SquashCourtIcon`, `TableTennisCourtIcon`,
`VolleyballCourtIcon`, `BeachVolleyballCourtIcon`, `BasketballCourtIcon`,
`FootballCourtIcon`, `HockeyCourtIcon`, `FloorballCourtIcon`,
`PickleballCourtIcon`, `SnookerCourtIcon`, `BowlingCourtIcon`, `GolfCourtIcon`
(plus the existing `FutsalIcon`). All share the `<Svg>` wrapper and a
`courtThin()` helper for inner-line weight.

`SportCourtIcon({ sport, ...svgProps })` dispatches by sport/icon key (with
`table-tennis` alias), falling back to the generic `CourtIcon` for unknown
sports.

## Frontend config layer (`artifacts/courtbook/src/lib/sport-icons.tsx`)

- `useSportIcons()` — TanStack Query hook (`queryKey: ["sport-icons"]`) that
  fetches `/api/sport-icons` and **merges DB rows over code defaults**. Code
  defaults are derived from the in-code `getSportColor`/`getSportLabel` maps, so
  if the fetch is pending or fails, callers get the defaults — icons never
  flicker or disappear. 5-min `staleTime`, `retry: false`.
- `useSportIconConfig(sport)` — resolved `{ sport, iconKey, color, label }` for
  one sport (DB override → code default → generic fallback).

The code remains the visual source of truth; the DB is an override/config layer.

## Where used

- **Facility-card court-count badge** (`facility-sport-card.tsx`) — replaced the
  generic `RectangleHorizontal` with `<SportCourtIcon>` tinted with the sport
  color.
- **Facility detail header** (`facility-sport.tsx`) — court-count line now leads
  with the sport's court icon.

`<SportCourtIcon>` + `useSportIconConfig` are exported for any future
court/venue context.

## Changing config later

Edit the `sport_icons` row (SQL today; an admin UI can be layered on later since
the table + API already exist). Example:

```sql
UPDATE sport_icons SET color = '#1d4ed8' WHERE sport = 'padel';
UPDATE sport_icons SET enabled = false WHERE sport = 'snooker';
```

Changes appear after the 5-min client cache expires (or on reload).

## Relevant files

- `lib/db/src/schema/sport-icons.ts` — table
- `artifacts/api-server/src/routes/sport-icons.ts` — API + seed
- `artifacts/courtbook/src/components/sport-icon.tsx` — court SVG art + `SportCourtIcon`
- `artifacts/courtbook/src/lib/sport-icons.tsx` — config hooks (DB-over-defaults merge)
- `artifacts/courtbook/src/components/facility-sport-card.tsx` / `src/pages/facility-sport.tsx` — consumers
