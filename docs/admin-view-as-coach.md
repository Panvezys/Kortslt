# Admin view-as-coach

## Purpose

Lets an admin inspect a specific coach's private dashboard (overview, schedule,
reviews, settings, affiliations) read-only, so moderators can troubleshoot a
report or see exactly what a coach sees without having to log in as them.

## Trust model

- **Read-only.** Only GET endpoints honour the impersonation hint. Mutations
  always bind to the authenticated caller's `userId`, so an admin in view-as
  mode can never write data as the impersonated coach. UI mutation controls
  are additionally disabled / hidden in view-as mode for clarity.
- **Admin-gated.** The backend check is performed inside the helper; the
  `?asCoach=<id>` query param is silently ignored for any caller whose role is
  not `admin`. There is no separate route to lock down.
- **No audit log yet.** If we extend to mutations later, every view-as write
  should be logged with the admin's userId, the impersonated coach's userId,
  and the action — but read-only V1 doesn't need it.

## Backend (`artifacts/api-server`)

### Helper

`resolveCoachUserId(req)` in `src/lib/auth.ts`:

1. Reads the caller's userId via `getCurrentUserId`.
2. If `req.query.asCoach` is missing or non-numeric → returns caller's userId.
3. Looks up the caller's role; non-admins → returns caller's userId.
4. Looks up `coachesTable` by id → returns that coach's userId.
5. Coach id not found → returns caller's userId (silent fallback, never 404).

The silent-fallback design means a leaked `?asCoach=` query string can never
elevate a non-admin or break a normal coach's own request.

### Endpoints that honour `?asCoach=<id>`

Only the GET handlers that previously called `getCurrentUserId(req)!` are
opted in:

| Endpoint | File |
|---|---|
| `GET /coaches/me` | `routes/coaches.ts` |
| `GET /coaches/me/applications` | `routes/coaches.ts` |
| `GET /coaches/me/facilities` | `routes/coaches.ts` |
| `GET /coaches/me/availability` | `routes/coach-schedule.ts` |
| `GET /coaches/me/blocked-slots` | `routes/coach-schedule.ts` |
| `GET /coach/reviews/me` | `routes/coach-reviews.ts` |

All other `/coaches/me*` and `/coach/*` mutations (`PUT`, `POST`, `DELETE`)
remain bound to `getCurrentUserId(req)`.

## Frontend (`artifacts/courtbook`)

### State container

`src/lib/view-as-coach.tsx`:

- `useViewAsCoach()` → `{ asCoachId, asCoachName, enter(id, name), exit() }`.
  Backed by `sessionStorage` (key `view-as-coach`) so it persists across
  navigation in the tab but clears on tab close.
- `withCoachViewAs(url)` — pure helper that appends `?asCoach=<id>` (or
  `&asCoach=`) when view-as is active. Reads sessionStorage directly so it can
  be called from non-React contexts.
- A `useSyncExternalStore` snapshot + custom `view-as-coach-change` event keep
  every consumer on the page in sync after `enter` / `exit`.

### Entry point

`src/pages/coach.tsx` — on a public coach profile (`/coach/:id`), admins see a
"Žiūrėti kaip šis treneris" button next to the header. Clicking it calls
`enter(coach.id, coach.name)` and navigates to `/coach/dashboard`.

### Banner

`src/components/coach-layout.tsx` renders a `ViewAsBanner` inside the layout
chrome whenever sessionStorage has a value. It also surfaces on `/coach/me`
(which uses the public `Layout`, not `CoachLayout`) via an inline copy of the
same banner in `pages/coach.tsx`.

The banner shows "Žiūrite kaip treneris: <name> · tik skaitymo režimas" and an
"Išeiti" button that calls `exit()`.

### Query keys

All view-as-aware queries include `asCoachId` in their `queryKey`, e.g.
`["coach-me-profile", asCoachId]`. This keeps the per-coach cache separate so
switching from admin's own view → view-as a coach → exit doesn't show stale
data from a previous coach.

### Mutation gating

In view-as mode, the following UI controls are disabled or hidden:

- `/coach/settings` Save button (disabled).
- `/coach/schedule` Save button, "Pridėti bloką", and the per-row delete
  buttons (disabled).
- `/coach/reviews` "Atsakyti" / "Redaguoti" reply controls (hidden).
- `coach-affiliations.tsx` "Siųsti užklausą" buttons (disabled).
- `/coach/me` "Redaguoti" button (hidden); the auto-open-create-form branch
  also short-circuits.

## Known scope cuts

- `/coach/messages` uses `/dm/threads`, which is a user-scoped DM endpoint
  unrelated to the coach-userId mapping. View-as does not impersonate DMs;
  the messages tab will show the admin's own threads.
- `StripeOnboardingBanner` in the dashboard still calls the user-scoped Stripe
  status endpoint, so it reflects the admin's Stripe state, not the
  impersonated coach's. This is intentional — admins shouldn't be initiating
  Stripe onboarding for another user.
