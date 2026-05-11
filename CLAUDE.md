# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Korts.lt** — a Lithuanian sports court booking platform. Users browse, book, and pay for tennis, basketball, padel, football, badminton, and other courts. Features include split-payment games, ELO-rated matches, tournaments, coaching, Stripe Connect payouts, and a real-time chat.

## Monorepo structure

```
workspace/
├── artifacts/
│   ├── api-server/       # Express 5 + Node.js backend
│   └── courtbook/        # React + Vite frontend (SPA)
├── lib/
│   ├── db/               # Drizzle ORM schema + DB client (@workspace/db)
│   ├── api-zod/          # Zod schemas generated from OpenAPI (@workspace/api-zod)
│   ├── api-client-react/ # TanStack Query hooks generated from OpenAPI (@workspace/api-client-react)
│   └── api-spec/         # openapi.yaml + orval code-gen config
└── scripts/              # One-off scripts
```

The monorepo uses **pnpm workspaces**. Package manager is `pnpm` only — `npm` and `yarn` are blocked by a preinstall hook.

## Key commands

### Running the app (development)
The Replit "Run" button starts both. To run manually:
```bash
# Frontend (Vite dev server, port set by $PORT env)
cd artifacts/courtbook && pnpm dev

# Backend (builds then starts on $PORT, default 8080)
cd artifacts/api-server && pnpm dev
```
The Vite dev server proxies `/api` requests to `localhost:8080`.

### Typechecking
```bash
# All packages
pnpm typecheck

# Just libs
pnpm typecheck:libs

# Single package
cd artifacts/api-server && pnpm typecheck
cd artifacts/courtbook && pnpm typecheck
```

### Building for production
```bash
pnpm build   # typechecks then builds all packages recursively
```

### Database schema changes
```bash
# Push schema to DB (uses DATABASE_URL env var)
cd lib/db && pnpm push

# Force push (drops and recreates — dev only)
cd lib/db && pnpm push-force
```
Schema files live in `lib/db/src/schema/`. After changing schema, run `push` to sync. There are no migration files — schema is pushed directly.

### Regenerating API client + Zod schemas from OpenAPI
```bash
cd lib/api-spec && pnpm generate   # runs orval against openapi.yaml
```
Only routes defined in `lib/api-spec/openapi.yaml` get generated clients. New routes that bypass the spec (most backend-only endpoints) are called directly with `customFetch` from `@workspace/api-client-react`.

## Architecture

### Backend (`artifacts/api-server`)

- **Entry**: `src/index.ts` → `src/app.ts`
- **Framework**: Express 5, ESM, built with esbuild (`build.mjs`)
- **Auth**: Clerk (`@clerk/express`). `clerkMiddleware()` runs globally but does NOT block requests. Per-route protection uses `requireAuth`, `requireOwner`, `requireAdmin`, `requireCoach`, or `requireCreator` from `src/lib/auth.ts`.
  - Agent bypass: Set `AGENT_BYPASS_KEY` env var; pass `x-replit-agent-auth: <key>` header to skip Clerk auth in tests. Also supports `x-replit-agent-userid` and `x-replit-agent-role` headers.
- **Database**: Drizzle ORM on PostgreSQL. Import from `@workspace/db` which re-exports `db`, all table objects, and `sports-config`.
- **Routes**: Each domain area is its own file in `src/routes/`, all mounted at `/api` in `src/routes/index.ts`.
- **Payments**: Two separate route files:
  - `payments.ts` — standard single-payer Stripe checkout
  - `split-payments.ts` — split-cost booking flow (host + invitees each pay their share)
- **Emails**: Resend via `src/lib/email.ts` (no-ops silently if `RESEND_API_KEY` is unset).
- **Cron**: `src/lib/cron.ts` runs every 60s — sweeps stale pending games and auto-confirms match results.
- **Static serving**: In production the server serves the Vite-built frontend from `../courtbook/dist/public` with SPA fallback. Court images are served from `../courtbook/public/courts`.

### Frontend (`artifacts/courtbook`)

- **Framework**: React 18 + Vite, TypeScript, Tailwind CSS v4
- **Routing**: `wouter` (not React Router). Routes are defined in `src/App.tsx`. Base path is configurable via `BASE_PATH` env var.
- **Auth**: Clerk (`@clerk/react`). `SafeShow` (from `src/lib/safeAuth.tsx`) is a Clerk-load-safe replacement for `<Show>` — use it instead of `<SignedIn>`/`<SignedOut>` to avoid blank screens when Clerk is slow.
- **State/data fetching**: TanStack Query. Generated hooks from `@workspace/api-client-react` for OpenAPI-spec'd routes; `customFetch` directly for everything else.
- **UI**: shadcn/ui components (Radix primitives + Tailwind). Component source is in `src/components/ui/`.
- **i18n**: Lithuanian is the primary locale. `useT()` from `src/lib/i18n.tsx` provides translations. Clerk UI uses `ltLT` localization from `src/lib/lt-localization.ts`.
- **Path alias**: `@/` resolves to `src/`.

### Shared libraries

- **`@workspace/db`**: Drizzle schema + `db` client. Import table objects directly (e.g. `bookingsTable`, `gamesTable`). All schema files are in `lib/db/src/schema/`.
- **`@workspace/api-zod`**: Zod request/response validators for OpenAPI-spec'd routes. Used server-side for input validation.
- **`@workspace/api-client-react`**: Generated TanStack Query hooks + `customFetch`. `customFetch` automatically attaches the Clerk JWT. Call `setAuthTokenGetter` once on mount (done in `App.tsx`).

## Important patterns

### Payments and split bookings
- `booking.isSplit = true` → split payment booking; `booking.totalSlots` and `booking.pricePerSlot` are set.
- `booking.status` flow: `pending` → `awaiting_players` → `confirmed`
- `game.status` flow: `pending_payment` → `awaiting_players` → `open` → `full` → `pending_verification` → `completed`
- A split booking creates a linked game (same `bookingId`). On confirm-split, the game transitions from `pending_payment` to `awaiting_players`.
- Mock Stripe: when `STRIPE_SECRET_KEY` is not set, `checkout-split` falls into a catch block that immediately marks bookings/games as confirmed. Look for `mock_split_` session IDs.

### Roles
Roles (`player`, `owner`, `coach`, `admin`) are stored in `user_roles` DB table. Admins can also be configured via `ADMIN_USER_IDS` or `ADMIN_EMAILS` env vars without a DB row.

### Guest bookings
`bookerUserId` is null for guest bookings. They are authorized via `managementToken` (opaque token stored on the booking, sent in email).

### Server-side price calculation
Slot prices are always computed server-side from `court_pricing` table (per-slot overrides) with fallback to `court.pricePerHour / 2` per 30-min slot. Never trust client-supplied total prices.

## Required environment variables

| Variable | Where used |
|---|---|
| `DATABASE_URL` | `@workspace/db` — required at startup |
| `PORT` | Both api-server and courtbook dev server |
| `CLERK_SECRET_KEY` | api-server — authenticated routes return 401 without it |
| `VITE_CLERK_PUBLISHABLE_KEY` | courtbook frontend |
| `STRIPE_SECRET_KEY` | api-server — Stripe routes return 503 without it; falls back to mock checkout |
| `RESEND_API_KEY` | api-server — emails silently no-op without it |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS` | api-server — comma-separated hardcoded admin identifiers |
| `AGENT_BYPASS_KEY` | api-server — enables auth bypass for automated testing |
