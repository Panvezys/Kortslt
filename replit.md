# CourtBook App

## Overview

CourtBook is a pnpm workspace monorepo using TypeScript, designed as a Lithuanian sports court booking platform. It supports booking for six different sports across numerous real Lithuanian sports courts. The platform aims to provide a comprehensive solution for both players to book courts and facility owners to manage their venues, integrating features like interactive maps, detailed court information, a robust booking system, and owner-specific dashboards. The project includes a React-based frontend and an Express 5 API backend, with a focus on modern web technologies and a scalable architecture.

## User Preferences

I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `artifacts/courtbook/public/courts/`.

## System Architecture

**Monorepo Structure**: pnpm workspaces manage multiple packages, each with its own dependencies, under a unified monorepo.
**Technology Stack**:
    - **Backend**: Node.js 24, Express 5, PostgreSQL with Drizzle ORM, Zod for validation, Orval for API codegen.
    - **Frontend**: React with Vite.
    - **Build**: esbuild for CJS bundles.
**UI/UX Decisions**:
    - **Mapping**: Interactive Leaflet/OpenStreetMap centered on Lithuania, with satellite/street view toggle. Courts are color-coded by rating (5 tiers).
    - **Court Display**: Toggle between list view and interactive map view. Map legend includes sport emojis and rating colors.
    - **Facility Owner Dashboard**: Multi-page architecture with `OwnerRoute` authentication guard. Features include facility overview (card grid, CRUD for facilities), facility detail with court CRUD (tabbed form for details, schedule, amenities, media, contacts), pricing editor, blocked slots, and coach assignment.
    - **Admin Approvals Page**: Dedicated interface at `/admin/approvals` for managing `pending_review` courts, including approval/rejection with reasons.
    - **Owner Onboarding Wizard**: A 4-step guided process at `/owner/onboard` for new owners to set up company profiles, verification, facility details, and court creation.
**Core Features**:
    - **Court Management**: 385 real Lithuanian courts pre-seeded. Detailed court pages with 30-minute slot booking, duration picker (30min-3h), per-slot pricing, and booking summary.
    - **Location & Contact**: Google Maps embed, "Get Directions," clickable phone numbers, and opening hours for each court.
    - **Advanced Court Features**: Buffer minutes between bookings, 12 smart amenity toggles, rentable equipment.
    - **Booking & Review System**: Customer booking history, 1-5 star rating system for confirmed bookings, aggregated ratings, and a dedicated reviews section.
    - **Instant Booking & Court Status**: `instantBookingEnabled` per court (confirmed vs. pending approval). Court lifecycle includes `draft`, `pending_review`, `active`, and `hidden` states.
    - **Photo Gallery System**: `court_photos` DB table for managing court images, with upload, captioning, ordering, and deletion functionalities. Frontend displays full-width carousels.
    - **Role-Based Access Control (RBAC)**: Four roles (`admin`, `owner`, `coach`, `player`) stored in `user_roles` table. Route guards enforce access.
    - **Role Onboarding System**: New users register as `player`. From profile or `/welcome`, they can apply to upgrade to `coach` or `owner`. Upgrade requests set `status = 'pending_approval'` in `user_roles` and email the admin. Admin approves/rejects from `/admin/approvals`. Approved coaches get a `coaches` table row auto-created from their application data. Routes: `/welcome` (post-signup), `/become-coach` (3-step form), `/become-owner` (single-page form). `sign-up.tsx` redirects to `/welcome` after registration.
    - **Coaches System**: Users can create coach profiles (`/coach/me`), public coach pages (`/coach/:id`), and owners can assign coaches to courts. Coach dashboard (`/coach/me`) is gated behind the `coach` role.
    - **Slot Availability**: `GET /api/courts/:id/availability` blocks both `pending` and `confirmed` bookings to prevent double-booking.
    - **Production Seeding**: Admin endpoint `POST /api/admin/seed-courts` for one-time seeding of production databases.

## External Dependencies

- **PostgreSQL**: Primary database for all application data, managed with Drizzle ORM.
- **Clerk**: Authentication service for user sign-in and registration, integrated with RBAC.
- **Stripe**: Payment gateway for handling bookings.
    - **Stripe Sandbox**: Connected for testing payment flows.
    - **Stripe Connect**: Facilitates direct payments to court owners, with a 5% platform fee applied. Account status and onboarding managed through API.
- **Resend**: Email service for sending booking confirmations and owner notifications. `RESEND_API_KEY` is a secret.
- **Google Maps API**: Used for location picking in the owner dashboard and displaying court locations on detail pages.
- **Leaflet/OpenStreetMap**: Interactive map display on the frontend.