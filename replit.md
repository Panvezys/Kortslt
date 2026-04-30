# Korts.lt App

## Overview

Korts.lt is a TypeScript-based pnpm workspace monorepo designed as a comprehensive sports court booking platform for Lithuania. It facilitates booking for six different sports across numerous real Lithuanian sports courts. The platform aims to serve both players seeking to book courts and facility owners managing venues, offering features like interactive maps, detailed court information, a robust booking system, and owner-specific dashboards. The project utilizes a React-based frontend and an Express 5 API backend, emphasizing modern web technologies and a scalable architecture to provide a unified solution for sports enthusiasts and facility operators.

## User Preferences

I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `artifacts/courtbook/public/courts/`.

## System Architecture

**Monorepo Structure**: The project is organized as a pnpm workspace monorepo, managing multiple packages with isolated dependencies.

**Technology Stack**:
*   **Backend**: Node.js 24, Express 5, PostgreSQL with Drizzle ORM, Zod for validation, Orval for API codegen.
*   **Frontend**: React with Vite.
*   **Build**: esbuild for CJS bundles.

**UI/UX Decisions**:
*   **Mapping**: Interactive Leaflet/OpenStreetMap centered on Lithuania, with satellite/street view toggle and color-coded courts.
*   **Court Display**: Toggle between list view and interactive map, with a map legend for sport emojis and rating colors.
*   **Facility Owner Dashboard**: Multi-page architecture with `OwnerRoute` authentication. Includes a live schedule grid, financial summaries, booking history, facility settings (profile, rules, business hours), and sidebar navigation.
*   **Admin Panel**: Tabbed interface for managing facilities, courts, coaches, and users. Features approval workflows with standardized layouts and notification systems. Deep-linking to owner pages for editing.
*   **Owner Onboarding Wizard**: A 4-step guided process for new owners to set up their company, facility, and courts.
*   **Theme**: Migration to semantic Tailwind CSS tokens (e.g., `bg-primary`, `text-foreground`, `text-destructive`) for UI consistency, retaining specific decorative gradients and Recharts colors.
*   **Shared UI Primitives**: Standardized components like `back-button.tsx`, `empty-state.tsx`, and `loading-button.tsx` for consistent user experience across the application. `DialogFooter` adjusted for mobile-friendly button ordering.

**Core Features**:
*   **Court Management**: Detailed court pages with 30-minute slot booking, duration picker, per-slot pricing, and booking summary. Includes buffer minutes, amenity toggles, and rentable equipment.
*   **Booking & Review System**: Customer booking history, 1-5 star rating system for confirmed bookings, aggregated ratings, and dedicated reviews section.
*   **Instant Booking & Court Status**: `instantBookingEnabled` per court, with `draft`, `pending_review`, `active`, and `hidden` lifecycle states.
*   **Photo Gallery System**: Management of court images with upload, captioning, ordering, and deletion features, displayed in frontend carousels.
*   **Role-Based Access Control (RBAC)**: Four roles (`admin`, `owner`, `coach`, `player`) with route guards.
*   **Role Onboarding System**: Guided processes for users to upgrade roles (coach, owner) with admin approval.
*   **Coaches System**: Coach profiles, public coach pages, owner assignment of coaches to courts, and a coach dashboard.
*   **Coaches Marketplace**: Bidirectional approval system where coaches apply to facilities and owners review requests. Includes public coach profiles and a marketplace filterable by sport and city.
*   **Tournaments Marketplace**: Request-to-host system for coaches/owners, with admin/owner approval workflows, auto-blocking of court slots, and bracket generation (single-elimination, round-robin, hybrid). Public bracket viewing and result reporting.
*   **Coach Favorites**: Users can favorite coaches, with dedicated endpoints and UI integration in the profile's Favorites tab.
*   **Slot Availability**: `GET /api/courts/:id/availability` blocks both `pending` and `confirmed` bookings.
*   **Admin Notifications**: In-app notifications for admin actions, visible through a consolidated notification bell.
*   **Owner Court Controls**: Online/offline toggles, preview functionality, and manual free booking creation for court owners.
*   **Free/Manual Bookings**: Owners can create confirmed bookings with zero price, bypassing payment gateways.
*   **Bookings Page Overhaul**: Mobile-friendly booking cards, detailed booking pages, and photo upload for reviews.
*   **Production Seeding**: Admin endpoint for one-time seeding of production databases.
*   **Form Validation**: Shared Lithuanian-language email and phone validators in `lib/api-zod/src/validators.ts` (`EmailString`, `OptionalEmailString`, `PhoneString`, `OptionalPhoneString`). Phone format normalizes spaces, dashes, parens; accepts optional `+` and 7–15 digits. Frontend mirror in `artifacts/courtbook/src/lib/validators.ts` (`validateEmail`, `validatePhone`, `normalizePhone`). Applied across facility create/update, owner onboarding, coach create/upsert/invite/apply, court coach-invite/coach-apply, game invite, and tournament register flows on both server (Zod) and client (pre-submit checks).
*   **Sports Activity & User Profiles**: User profiles with sport-specific levels, visibility toggles, and auto-computed stats. Real avatars are synced from Clerk.
*   **Competitive Ecosystem (ELO System)**: ELO rating system for 15 Lithuanian sports, including `userRatingsTable`, `gameResultsTable`, and `matchInvitesTable`. Supports rated and casual games. ELO tiers (Bronze, Silver, Gold, Diamond) are displayed.
*   **Game Result Reporting**: Creator-reported scores with participant confirmation/dispute, ELO updates on confirmation, and a 24-hour auto-confirm mechanism. Hybrid confirmation requires all non-reporter participants to confirm.
*   **Host-Pays-All Court Booking (Stripe)**: Game creators can book Korts.lt courts during game creation, with Stripe Checkout for payment and a 15-minute slot hold.
*   **Reliability Score**: User reliability score based on game participation and early leaves.
*   **Result-Reporting Time Gate**: Enforcement of result reporting after the game's duration has passed.
*   **Test-only auth bypass**: An environment-variable-controlled mechanism to bypass Clerk authentication for testing purposes, allowing synthetic user identities and roles.
*   **Multi-Sport Scoring**: Configurable per-sport scoring rules (`SET_BASED` vs. `POINT_BASED`) with helpers for validation, winner derivation, and formatting.
*   **Tournament Generators**: Support for single-elimination, round-robin, and hybrid tournament formats with player seeding and group standings calculation (rank points, head-to-head, sets/points difference).
*   **Match-result race protection**: Transactional updates with `SELECT ... FOR UPDATE` row locks to prevent concurrent submission issues for tournament bracket data.
*   **Structured Score Reporting**: `sport-score-input.tsx` component for sport-aware score entry with validation and structured output.

## External Dependencies

*   **PostgreSQL**: Primary database for all application data, managed with Drizzle ORM.
*   **Clerk**: Authentication service for user sign-in and registration, integrated with RBAC.
*   **Stripe**: Payment gateway for handling bookings, including Stripe Connect for direct payments to court owners with a 5% platform fee.
*   **Resend**: Email service for sending booking confirmations and notifications.
*   **Google Maps API**: Used for location picking and displaying court locations.
*   **Leaflet/OpenStreetMap**: Interactive map display on the frontend.