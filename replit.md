# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## CourtBook App

A court booking platform for tennis and basketball courts.

### Artifacts
- `artifacts/courtbook` — React + Vite frontend (served at `/`)
- `artifacts/api-server` — Express 5 API backend (served at `/api`)

### Features
- Interactive map (Leaflet + OpenStreetMap) showing court locations
- Court browsing with filters (type, price)
- Court detail page with availability calendar and booking form
- Owner dashboard to list and manage courts
- Booking history for customers
- Payment checkout via Stripe (see note below)

### Database Tables
- `courts` — tennis/basketball court listings
- `bookings` — customer bookings with status (pending/confirmed/cancelled)

### Payments (Stripe)
- The backend supports Stripe Checkout via `STRIPE_SECRET_KEY` environment variable.
- **Currently running in mock mode** — the user dismissed the Stripe integration setup.
- When `STRIPE_SECRET_KEY` is not set, bookings are auto-confirmed without a real charge.
- To enable real payments: set `STRIPE_SECRET_KEY` as a secret, or connect Stripe via the integrations system.

### API Routes
- `GET /api/courts` — list courts (filter by type, price)
- `POST /api/courts` — create court
- `GET /api/courts/:id` — court detail
- `PUT /api/courts/:id` — update court
- `DELETE /api/courts/:id` — delete court
- `GET /api/courts/:id/availability?date=YYYY-MM-DD` — available time slots
- `GET /api/bookings` — list bookings
- `POST /api/bookings` — create booking
- `DELETE /api/bookings/:id` — cancel booking
- `POST /api/payments/create-checkout` — create Stripe checkout session
- `POST /api/payments/confirm` — confirm payment and finalize booking
- `GET /api/stats/summary` — platform stats
- `GET /api/stats/popular-courts` — most booked courts
