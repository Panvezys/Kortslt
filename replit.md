# 
 CourtBook App

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
    - **Admin Panel**: Tabbed interface at `/admin` with four tabs in order: Objektai (Facilities), Aikštelės (Courts), Treneriai (Coaches), Vartotojai (Users). All approval tabs (facilities, courts, coaches) use the same standardized layout: filter bar + table + click-to-open review dialog with approve/reject actions. Coach approval uses `status` and `rejectionReason` columns on the `coaches` table, managed via `/api/admin/coaches` endpoints. Admin panel dispatches notifications on approval/rejection.
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
    - **Coaches System**: Users can create coach profiles (`/coach/me`), public coach pages (`/coach/:id`), and owners can assign coaches to courts. Coach dashboard (`/coach/me`) is gated behind the `coach` role. Coaches have a `status` field (`pending`/`approved`/`rejected`) and `rejectionReason` — admin approval is handled in the admin panel Treneriai tab.
    - **Coach Favorites**: `coach_favorites` table stores user–coach favorite relationships. Endpoints: `GET /api/favorites/coaches`, `POST /api/favorites/coaches/:coachId`, `DELETE /api/favorites/coaches/:coachId`. `FavoritesContext` exposes both court and coach favorites. The profile Favorites tab has sub-tabs for courts and coaches.
    - **Slot Availability**: `GET /api/courts/:id/availability` blocks both `pending` and `confirmed` bookings to prevent double-booking.
    - **Admin Notifications**: When a court is submitted for review or a role request is made, an in-app admin notification is created (stored with `userId = "__ADMIN__"` in notifications table). Admins see these via `GET /api/admin/notifications` (auth-protected). The notification bell component fetches admin notifications in addition to personal ones when the user is an admin.
    - **Court-Specific Coaches**: `court_coaches` table links coaches to specific courts. Backend endpoints: `GET/POST/DELETE /api/courts/:id/coaches`. Frontend: `CoachAssignModal` in owner-facility-detail.tsx; public court pages display assigned coaches.
    - **Owner Court Controls**: Court cards in owner-facility-detail.tsx have: (1) online/offline toggle (active↔hidden via `PATCH /api/courts/:id/status`), (2) preview button (ExternalLink to /courts/:id), (3) "Nemokama" free booking button (opens FreeBookingDialog for creating manual $0 bookings via `POST /api/owner/bookings/manual`).
    - **Free/Manual Bookings**: `POST /api/owner/bookings/manual` allows court owners to create confirmed bookings with totalPrice=0 directly, bypassing Stripe.
    - **Bookings Page Overhaul**: `/bookings` shows upcoming/past tabs with mobile-friendly BookingCard components. Clicking a booking navigates to `/bookings/:id` (booking-detail.tsx) showing full details with calendar download. `RateDialog` supports up to 3 photo uploads stored as JSON in `reviews.photos`.
    - **Facility Navigation**: Owner facility detail page includes a Google Maps navigation link (uses lat/lng or address fallback).
    - **Production Seeding**: Admin endpoint `POST /api/admin/seed-courts` for one-time seeding of production databases.
    - **Sports Activity & User Profiles**: Two new DB tables (`user_profiles`, `user_sport_profiles`). Each user can add sport profiles with level (beginner/intermediate/advanced/pro), toggle visibility (activityPublic), and stats (gamesPlayed, hoursPlayed) are auto-computed from game_participants + games tables. Image URL is synced from Clerk on profile page load so real avatars appear everywhere.
    - **UserProfileCard component**: Reusable modal that shows when clicking any avatar in messaging (chat bubble, messages page) or game participants — displays sport profiles, levels, stats, and "Rašyti žinutę" button.
    - **Real avatars everywhere**: DM thread list, chat bubble, messages page, and game detail participants all show real Clerk profile pictures. The `/api/dm/threads` endpoint now returns `otherUserImageUrl`. A batch endpoint `/api/user-profiles/batch` allows fetching multiple user avatars at once.
    - **Competitive Ecosystem (ELO System)**: Four new DB tables: `sportsTable` (15 pre-seeded Lithuanian sports), `userRatingsTable` (per-user/per-sport ELO starting at 1200 with W/L/D tracking), `gameResultsTable` (score reporting + 24h auto-confirm verification), `matchInvitesTable` (email invitation tracking). `gamesTable` has `matchType` (rated/casual), `gameParticipantsTable` has `team` (A/B). ELO uses K=32, team games use average ELO split.
    - **ELO Tiers**: Bronze (0–1199), Silver (1200–1399), Gold (1400–1599), Diamond (1600+). Displayed on game cards and in Skill Cards.
    - **Game Result Reporting**: Creator reports final score via `POST /games/:id/result`. Participants get notified and can confirm or dispute via `POST /games/:id/verify`. On confirmation, if `matchType=rated`, ELO ratings update. Auto-confirm timestamp is 24h after reporting.
    - **Skill Card component**: `skill-card.tsx` shows per-sport ELO with tier badges, win/loss/draw stats, and an ELO progress bar. Displayed prominently at the top of the "Sporto veikla" tab on the profile page.
    - **Match Type on Games**: Games can be created as "Laisvas" (casual, no ELO change) or "Reitinginis" (rated, ELO updates on result confirmation). Displayed via badge on all game cards.
    - **Email Invitations**: `POST /games/:id/invite` sends a styled HTML email via Resend with a join link. Non-registered users receive `sendMatchInviteEmail`. Invites tracked in `matchInvitesTable`.
    - **Sports auto-seed**: `/api/sports` auto-seeds the sportsTable on first call if empty. 15 Lithuanian sports pre-defined.

## External Dependencies

- **PostgreSQL**: Primary database for all application data, managed with Drizzle ORM.
- **Clerk**: Authentication service for user sign-in and registration, integrated with RBAC.
- **Stripe**: Payment gateway for handling bookings.
    - **Stripe Sandbox**: Connected for testing payment flows.
    - **Stripe Connect**: Facilitates direct payments to court owners, with a 5% platform fee applied. Account status and onboarding managed through API.
- **Resend**: Email service for sending booking confirmations and owner notifications. `RESEND_API_KEY` is a secret.
- **Google Maps API**: Used for location picking in the owner dashboard and displaying court locations on detail pages.
- **Leaflet/OpenStreetMap**: Interactive map display on the frontend.