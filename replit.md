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

A Lithuanian sports court booking platform (CourtBook) supporting 6 sport types.

### Artifacts
- `artifacts/courtbook` — React + Vite frontend (served at `/`)
- `artifacts/api-server` — Express 5 API backend (served at `/api`)

### Features
- Interactive Leaflet/OpenStreetMap map centered on Lithuania, satellite/street view toggle, courts color-coded by rating (5 tiers: lime→green→yellow→orange→gray)
- 40 real Lithuanian courts across 6 sport types and 6 cities seeded in DB
  - Tennis 🎾 (#84cc16), Basketball 🏀 (#f97316), Padel 🏓 (#3b82f6), Football ⚽ (#22c55e), Badminton 🏸 (#a855f7), Squash 🎯 (#06b6d4)
  - Cities: Vilnius, Kaunas, Klaipėda, Druskininkai, Šiauliai, Panevėžys
- Court browsing with full filters: sport type, city, surface type, condition, indoor/outdoor, max price (€)
- List view + interactive map view toggle; map legend shows sport emojis + rating color tiers
- Court detail page with 30-min slot booking grid, duration picker (30min–3h), per-slot pricing, and booking summary
- Location & contact section on each court: Google Maps embed with pin, "Get Directions" button, clickable phone number, and opening hours (all 40 courts populated with real/researched data)
- Owner dashboard to list and manage courts (all 6 sport types supported) with per-slot pricing editor (day-of-week × 30-min grid)
- Booking history for customers with "Rate" button for confirmed bookings
- Star rating system (1–5): users submit reviews from the bookings page, ratings aggregate on court cards and detail pages
- Reviews section on court detail page showing all reviews with star display
- Payment checkout (mock mode — auto-confirmed)
- Clerk authentication (sign in / register)

### Court images
- Existing tennis/basketball courts: `artifacts/courtbook/public/courts/*.png` (AI generated)
- New sport courts: `artifacts/courtbook/public/courts/{padel,football,badminton,squash}/*.jpg` (stock photos)

### Role-Based Access Control (RBAC)
- **Three roles**: `admin`, `owner`, `player` (stored in `user_roles` table, keyed by Clerk userId)
- **admin** — full access: approve/reject courts, manage all users' roles, modify any court
- **owner** — can list/manage their own courts, block time slots; can only modify courts where `owner_user_id` matches their Clerk userId
- **player** — default role; can browse, book, and review courts
- Role lookup: `GET /api/me/role` auto-creates a `player` row on first sign-in
- Admin role management: `GET /api/admin/users`, `PUT /api/admin/users/:userId/role`
- Route guards: `/admin` redirects non-admins; `/owner` redirects non-owners (players)
- Nav links (Owner Dashboard, Administravimas) only shown to users with the correct role
- **Admin user**: seeded in `user_roles` table; `ADMIN_USER_IDS` env var no longer needed for auth (kept for legacy, but DB role is the source of truth)

### Database Tables
- `courts` — court listings with: type, city, lat/lng, price (€), surface, condition, isIndoor, amenities, rating
- `bookings` — customer bookings with status (pending/confirmed/cancelled)
- `reviews` — court reviews linked to bookings: rating (1–5), optional text, reviewer name; auto-updates `courts.rating` on insert
- `court_pricing` — per-slot dynamic pricing: courtId, dayOfWeek (0=Sun), startTime (30-min slot), price (€); overrides default price per slot
- `court_blocked_slots` — owner-blocked time ranges per court (date, startTime, endTime, reason)
- `user_roles` — maps Clerk userId → role ('admin'|'owner'|'player'); auto-upserts on first login
- `courts.phone` — real phone numbers for each venue (TEXT, nullable)
- `courts.openingHours` — opening hours as TEXT[] e.g. ["Pirm–Penkt: 07:00–23:00", "Šeštadienis–Sekmadienis: 08:00–22:00"]

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

### Email (Resend)
- Confirmation emails sent via Resend after `POST /api/payments/confirm`.
- `RESEND_API_KEY` is set as a secret.
- Email logic is in `artifacts/api-server/src/lib/email.ts`.
- Currently uses `onboarding@resend.dev` as the sender. To send from `@korts.lt`, verify the domain at https://resend.com/domains and update the `from` field in `email.ts`.
- Email is sent non-blocking (never fails the API response).

### Slot Availability
- `GET /api/courts/:id/availability` blocks slots with **both** `pending` and `confirmed` bookings.
- This prevents double-booking — once a user creates a booking (even before payment), the slot is unavailable to others.

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
