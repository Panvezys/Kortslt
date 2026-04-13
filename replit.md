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
- Interactive Leaflet/OpenStreetMap map centered on Lithuania, auto-fits all courts, color-coded by type
- 19 real Lithuanian tennis and basketball courts seeded (Vilnius, Kaunas, Klaipėda, Druskininkai, Šiauliai, Panevėžys)
- Court browsing with full filters: sport type, city, surface type, condition, indoor/outdoor, max price (€)
- List view + interactive map view toggle on the courts browse page
- Court detail page with availability calendar and booking form
- Owner dashboard to list and manage courts
- Booking history for customers with "Rate" button for confirmed bookings
- Star rating system (1–5): users submit reviews from the bookings page, ratings aggregate on court cards and detail pages
- Reviews section on court detail page showing all reviews with star display
- Payment checkout (mock mode — auto-confirmed)

### Database Tables
- `courts` — court listings with: type, city, lat/lng, price (€), surface, condition, isIndoor, amenities, rating
- `bookings` — customer bookings with status (pending/confirmed/cancelled)
- `reviews` — court reviews linked to bookings: rating (1–5), optional text, reviewer name; auto-updates `courts.rating` on insert

### Court Schema Fields
- `type`: 'tennis' | 'basketball'
- `surface`: 'clay' | 'hard' | 'carpet' | 'synthetic_grass' | 'parquet' | 'rubber'
- `condition`: 'excellent' | 'good' | 'fair'
- `isIndoor`: boolean
- Prices in euros (€)

### Payments (Stripe)
- The backend supports Stripe Checkout via `STRIPE_SECRET_KEY` environment variable.
- **Currently running in mock mode** — the user dismissed the Stripe integration setup.
- When `STRIPE_SECRET_KEY` is not set, bookings are auto-confirmed without a real charge.
- To enable real payments: set `STRIPE_SECRET_KEY` as a secret, or connect Stripe via the integrations system.

### API Routes
- `GET /api/courts` — list courts (filter by type, city, surface, condition, isIndoor, minPrice, maxPrice)
- `POST /api/courts` — create court
- `GET /api/courts/cities` — list all cities with courts
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
