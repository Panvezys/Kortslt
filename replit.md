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
- 385 real Lithuanian sports courts across 24+ Lithuanian cities seeded in DB
  - Tennis 🎾 (#84cc16), Basketball 🏀 (#f97316), Padel 🏓 (#3b82f6), Football ⚽ (#22c55e), Badminton 🏸 (#a855f7), Squash 🎯 (#06b6d4)
  - Table Tennis 🏓 (#f43f5e), Golf ⛳ (#ca8a04), Snooker 🎱 (#0d9488), Bowling 🎳 (#dc2626)
  - Cities: Vilnius, Kaunas, Klaipėda, Druskininkai, Šiauliai, Panevėžys
- Court browsing with full filters: sport type, city, surface type, condition, indoor/outdoor, max price (€)
- List view + interactive map view toggle; map legend shows sport emojis + rating color tiers
- Court detail page with 30-min slot booking grid, duration picker (30min–3h), per-slot pricing, and booking summary
- Location & contact section on each court: Google Maps embed with pin, "Get Directions" button, clickable phone number, and opening hours (all 40 courts populated with real/researched data)
- **Facility-centric owner dashboard** (multi-page architecture):
  - `/owner` → **Facility Overview** (`owner-facilities.tsx`): card grid of all owner's facilities with photos, verification badges, sport type pills, court counts (active/pending), stats summary row, create/edit/delete facility dialog with LocationPicker (Google Maps) + ownership doc upload, address/city required
  - `/owner/facility/:id` → **Facility Detail** (`owner-facility-detail.tsx`): facility header (hero photo, address, stats), court card grid within facility, full court CRUD with tabbed form (5 tabs: Pagrindai | Grafikas | Patogumai | Medija | Kontaktai), pricing editor, blocked slots, coach assignment, QR code, Stripe Connect. Courts inherit address/city/lat/lng/postcode from facility (server-side + client defaults).
  - Both routes wrapped in `OwnerRoute` auth guard (requires signed-in + owner role)
  - Facilities DB schema: latitude, longitude (doublePrecision), postcode (text), ownershipDocUrl (text) on `facilitiesTable`
  - Ownership doc upload secured with `requireAuth` middleware
  - Old monolithic `owner.tsx` preserved for reference but no longer routed
- Tabbed court form:
  - **Pagrindai** tab: name, sport type, description, Google Maps location picker, address/city/postcode, lat/lng
  - **Grafikas** tab: default price, buffer minutes, per-day working hours editor (open/close/closed toggle), per-slot 30-min pricing grid
  - **Patogumai** tab: max players, indoor toggle, 12-amenity smart buttons (parking, wifi, lockers, café, heating, A/C, first aid, etc.)
  - **Medija** tab: main image upload, photo gallery (on edit), ownership document upload (on create)
  - **Kontaktai** tab: owner name/email, social media links (Facebook, Instagram, WhatsApp, Website)
  - Wizard navigation: Back/Next buttons + direct tab click, Submit only visible on last tab
- Facilities system: `facilities` DB table; owner can create/select facilities; courts belong to facilities via `facilityId` FK
  - API: `GET/POST /api/facilities`, `GET/PUT/DELETE /api/facilities/:id`
  - `GET /facilities` returns `courtCount`, `sportTypes[]`, `courts[]` per facility
  - `GET /facilities/:id` returns full facility detail with all courts
- Advanced court features: buffer minutes between bookings, smart amenity toggle buttons (12 amenities), rentable equipment items (name + price per booking)
- Booking history for customers with "Rate" button for confirmed bookings
- Star rating system (1–5): users submit reviews from the bookings page, ratings aggregate on court cards and detail pages
- Reviews section on court detail page showing all reviews with star display
- Payment checkout (mock mode — auto-confirmed)
- Clerk authentication (sign in / register)

### Court images & photo gallery
- Existing tennis/basketball courts: `artifacts/courtbook/public/courts/*.png` (AI generated)
- New sport courts: `artifacts/courtbook/public/courts/{padel,football,badminton,squash}/*.jpg` (stock photos)
- **Photo gallery system**: `court_photos` DB table (`id`, `court_id`, `url`, `caption`, `display_order`, `uploaded_by`)
  - `GET/POST /api/courts/:id/photos` — list & upload gallery photos
  - `PATCH /api/courts/:id/photos/:photoId` — update caption/order (owner only)
  - `DELETE /api/courts/:id/photos/:photoId` — delete photo + file (owner only)
  - Owner dashboard: "Galerijos nuotraukos" section in court editor (3-column grid, multi-select upload, hover-to-delete)
  - Court detail page: full-width gallery carousel with left/right arrows, thumbnail strip, "N/M" counter; single photo shows normally; falls back to empty state with sport initial

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

### Coaches System
- **Coach profile** (`/coach/me`): any signed-in user can create/edit a coach profile (name, email, phone, bio, photo, YouTube video, price/hour, sports, availability description)
- **Coach public page** (`/coach/:id`): publicly visible coach profile with YouTube embed
- **Court coaches section**: court detail page shows coaches assigned to that court (sport badges, price, availability) — only renders if coaches are assigned
- **Owner assignment**: owner dashboard → "Treneriai" button per court → dialog to assign/unassign coaches; lists all registered coaches with option to add
- **Nav link**: "Trenerio profilis" in the signed-in user dropdown menu

### Database Tables
- `courts` — court listings with: type, city, lat/lng, price (€), surface, condition, isIndoor, amenities, rating
- `bookings` — customer bookings with status (pending/confirmed/cancelled)
- `reviews` — court reviews linked to bookings: rating (1–5), optional text, reviewer name; auto-updates `courts.rating` on insert
- `court_pricing` — per-slot dynamic pricing: courtId, dayOfWeek (0=Sun), startTime (30-min slot), price (€); overrides default price per slot
- `court_blocked_slots` — owner-blocked time ranges per court (date, startTime, endTime, reason)
- `user_roles` — maps Clerk userId → role ('admin'|'owner'|'player'); auto-upserts on first login
- `coaches` — coach profiles: userId, name, email, bio, photoUrl, videoUrl, pricePerHour, sports[], availabilityDescription, phone
- `court_coaches` — junction table: courtId ↔ coachId (many-to-many assignment)
- `courts.phone` — real phone numbers for each venue (TEXT, nullable)
- `courts.openingHours` — opening hours as TEXT[] e.g. ["Pirm–Penkt: 07:00–23:00", "Šeštadienis–Sekmadienis: 08:00–22:00"]

### Court Schema Fields
- `type`: 'tennis' | 'basketball'
- `surface`: 'clay' | 'hard' | 'carpet' | 'synthetic_grass' | 'parquet' | 'rubber'
- `condition`: 'excellent' | 'good' | 'fair'
- `isIndoor`: boolean
- Prices in euros (€)

### Payments (Stripe)
- **Stripe Sandbox connected** via Replit Stripe integration (connector ID: `ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y`).
- Keys fetched at runtime via `getUncachableStripeClient()` in `artifacts/api-server/src/stripeClient.ts`.
- `stripe` and `stripe-replit-sync` packages installed at workspace root (`-w`).
- **Player booking flow**: slot selection → `POST /payments/create-checkout` → Stripe Checkout → redirect back → `POST /payments/confirm` → booking confirmed. Uses `{CHECKOUT_SESSION_ID}` template in success_url.
- **Free bookings**: `POST /payments/confirm-free` (price = 0).
- **Stripe Connect (court-level)**: `POST /payments/connect/onboard` → Stripe onboarding URL. `GET /payments/connect/status/:courtId` checks account status.
- **Stripe Connect (facility-level)**: `POST /api/facilities/:id/connect/onboard` → Express account + onboarding link. `GET /api/facilities/:id/connect/status` — refreshes account status. Required before owner can add courts.
- When a court/facility has a `stripeConnectAccountId`, checkout session applies a 5% platform fee via `transfer_data.destination`.
- **Test card**: `4242 4242 4242 4242`, any future expiry, any CVC.
- `stripeConnectAccountId` and `stripeConnectStatus` columns on both `courts` and `facilities` tables.
- `stripe.accounts` table (from stripe-replit-sync webhook sync) creation is non-critical for sandbox testing — webhook sync may fail on first start but all checkout/connect flows work independently.
- `GET /payments/config` — returns publishable key for frontend (currently unused in UI; key is Stripe test key starting with `pk_test_`).

### Verified Facility Workflow (COMPLETE)
- **DB columns on `facilities`**: `verificationStatus` ('pending'|'verified'|'rejected'), `rejectionReason`, `stripeConnectAccountId`, `stripeConnectStatus` ('not_connected'|'pending'|'active').
- **Admin API**: `GET /api/admin/facilities` — list all facilities. `PUT /api/admin/facilities/:id/approve` — set verified. `PUT /api/admin/facilities/:id/reject` — set rejected + reason.
- **Admin UI**: "Objektai" tab in Admin Dashboard with approve/reject controls, Stripe Connect status, ownership doc link, reject reason dialog.
- **Public court filter**: `GET /api/courts` joins `facilities` and only returns courts from `verified` facilities (or legacy courts with no `facilityId`). Returns `facilityVerified: true` on each court.
- **Verified badge**: Blue "Patvirtinta" badge with shield icon on `CourtCard` and map InfoWindow when `court.facilityVerified === true`.
- **Facility cards (owner)**: Show Stripe Connect status badge (active=blue, pending=yellow) on facility card image overlay.
- **Stripe Connect gate (owner-facility-detail)**: Yellow banner shown when `stripeConnectStatus !== 'active'`; "Pridėti kortą" button disabled until Stripe Connect is active. Banner has CTA to start/resume onboarding.

### Email (Resend)
- Confirmation emails sent via Resend after `POST /api/payments/confirm`.
- `RESEND_API_KEY` is set as a secret.
- Email logic is in `artifacts/api-server/src/lib/email.ts`.
- Currently uses `onboarding@resend.dev` as the sender. To send from `@korts.lt`, verify the domain at https://resend.com/domains and update the `from` field in `email.ts`.
- Email is sent non-blocking (never fails the API response).

### Slot Availability
- `GET /api/courts/:id/availability` blocks slots with **both** `pending` and `confirmed` bookings.
- This prevents double-booking — once a user creates a booking (even before payment), the slot is unavailable to others.

### Production Database Seeding
- Production DB is separate from dev and starts empty after first publish.
- Court seed data: `artifacts/api-server/src/data/courts-seed.json` (385 courts, ~362KB).
- Build script (`build.mjs`) copies `src/data/` → `dist/data/` automatically.
- Admin endpoint: `POST /api/admin/seed-courts` — inserts seed courts if DB is empty; protected by `requireAdmin`.
- **One-time setup**: After deploying, log in as admin → Admin Dashboard → click "Seed duomenų bazę" button (only visible when 0 courts).

### Owner Onboarding Flow
- **4-step wizard** at `/owner/onboard` (requires Clerk auth, redirects unauthenticated → sign-in):
  1. **Company Profile**: companyName, registrationCode, address, city, phone, email
  2. **Verification**: upload business license/ID document (PDF or image)
  3. **Facility Setup**: name, description, photos, equipment
  4. **Court Creation**: add 1+ courts with sport type, surface, pricing, amenities; auto-populates address/city from facility
- Role promotion to `owner` happens only after step 4 completes (courts created) — prevents premature dashboard access
- Server-side step-order enforcement: each step validates prerequisites (e.g., step 3 requires verification doc from step 2)
- Courts created in onboarding get `status: "pending"` (require admin approval)
- `/list-your-court` CTA buttons use `handleJoin()`: unauthenticated → Clerk sign-in modal; player → `/owner/onboard`; owner → `/owner` dashboard
- `facilities` table enhanced: `companyName`, `registrationCode`, `address`, `city`, `phone`, `email`, `verificationStatus`, `verificationDocUrl`, `photos`, `equipment`
- API endpoints: `GET /api/owner/onboard/status`, `POST /api/owner/onboard/step1`–`step4`
- Upload endpoints: `/api/upload/ownership-doc` (PDF/image), `/api/upload/court-image` (photos)
- Lithuanian labels throughout the wizard

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
