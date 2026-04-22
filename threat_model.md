# Threat Model

## Project Overview

CourtBook is a Lithuanian sports court booking platform built as a pnpm monorepo. The production application consists of a React/Vite frontend in `artifacts/courtbook` and an Express 5 API in `artifacts/api-server`, with PostgreSQL/Drizzle in `lib/db`, Clerk for authentication, Stripe for payments and Connect onboarding, and Resend for transactional email.

Primary users are unauthenticated visitors browsing courts, authenticated players booking courts and joining games, owners managing facilities/courts and payouts, coaches maintaining profiles, and admins reviewing approvals and platform data.

Production scope assumptions for this scan:
- `artifacts/courtbook` and `artifacts/api-server` are production code.
- `lib/db`, `lib/api-zod`, `lib/api-spec`, and `lib/api-client-react` are shared production dependencies.
- `artifacts/mockup-sandbox` is dev-only and should be ignored unless production reachability is demonstrated.
- Replit deployment TLS is assumed to be handled by the platform.
- `NODE_ENV=production` in production, so dev-only Vite plugins and banners are out of scope unless server reachability shows otherwise.

## Assets

- **User identities and sessions** — Clerk-backed user identities, session cookies/tokens, and role mappings in `user_roles`. Compromise allows impersonation or privilege abuse.
- **Booking and calendar data** — booking records, customer names, emails, phones, booking history, and related ICS exports. This is personal data and directly tied to court access.
- **Private user communications** — court-owner messages, direct messages, notifications, game chats, and related recipient metadata. Exposure can leak PII and conversation history.
- **Owner and admin capabilities** — facility ownership records, approval queues, status-change endpoints, manual booking powers, and admin seed/review actions. These boundaries control real business objects and privileged workflows.
- **Payment and payout configuration** — Stripe checkout session state, Stripe Connect account IDs/status, onboarding links, webhook processing, and payment confirmation flows. Abuse can redirect funds or fraudulently confirm bookings.
- **Uploaded media and verification documents** — court images and amenity photos are served from a public upload path on the application origin, while ownership documents and related metadata remain sensitive records that may be stored adjacent to frontend source paths. These assets can contain untrusted or private content and must not be assumed safe just because they originate from platform workflows.
- **Application secrets and integrations** — Clerk secret handling, Stripe keys, Replit connector access, Resend credentials, database URL, and any configured admin override user IDs.

## Trust Boundaries

- **Browser to API** — all request parameters, bodies, query strings, uploaded files, and headers from the frontend are untrusted and must be authenticated, authorized, and validated server-side.
- **Anonymous to authenticated users** — court browsing is public, but bookings, favorites, notifications, private messages, user profiles, game participation, and owner/admin actions must be scoped to the active authenticated principal.
- **Authenticated player to owner/admin** — owner dashboards, coach moderation, court/facility mutation, admin queues, and seeding endpoints require strict server-side role checks independent of frontend guards.
- **API to PostgreSQL** — the API can read and mutate all protected business data; injection, IDOR, or logic flaws at the API layer directly impact the full dataset.
- **API to Stripe/Resend/Clerk** — outbound calls use high-value secrets and create externally trusted side effects such as charges, payout onboarding, and email delivery.
- **API to filesystem/public static content** — uploaded content crosses from untrusted user input into files served from `/courts/uploads` on the application origin. Runtime writes under frontend source directories should not be assumed publicly reachable in production unless the deployment artifact explicitly serves them.
- **Production to dev-only code** — `artifacts/mockup-sandbox` and non-production Vite plugins are not part of the production attack surface unless explicitly exposed.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/courtbook/src/main.tsx`, `artifacts/courtbook/src/App.tsx`.
- **Highest-risk code areas**: `artifacts/api-server/src/routes/` (especially `payments.ts`, `bookings.ts`, `messages.ts`, `notifications.ts`, `favorites.ts`, `upload.ts`, `roles.ts`, `admin.ts`, `courts.ts`, `court-photos.ts`), `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts`.
- **Public surfaces**: court listings/details, sitemap, public coach/trainer/tournament pages, selected booking/payment initiation paths, public uploads/static paths.
- **Authenticated surfaces**: favorites, notifications, messages, bookings, games, user profiles, role requests.
- **Owner/admin surfaces**: facilities, courts, photos, blocked slots, trainers, tournaments, onboarding, payouts, admin approvals and seed endpoints.
- **Usually ignore**: `artifacts/mockup-sandbox`, dev-only Vite plugin behavior gated on non-production conditions.

## Threat Categories

### Spoofing

The application relies on Clerk for identity but many business actions are keyed by `userId`, `ownerUserId`, email, or booking identifiers carried in request parameters and bodies. The system must treat Clerk-authenticated identity as authoritative and MUST NOT let callers impersonate another user by supplying a different identifier in the request.

All privileged actions MUST bind authorization to `getAuth(req).userId` or an equivalent verified session principal. Admin overrides via `ADMIN_USER_IDS` MUST remain tightly controlled as secrets because compromise of that configuration grants full platform privilege.

### Tampering

Players, owners, and admins can create or mutate bookings, courts, photos, facilities, messages, payout setup, and role workflows. The server MUST recalculate sensitive business values server-side, validate uploaded content, and ensure that only the authorized owner/admin for a resource can change it.

Payment confirmation, free booking confirmation, Connect onboarding, and file upload flows are especially sensitive because they create irreversible side effects. They MUST verify both the actor and the resource ownership before mutating state or calling third-party APIs.

### Information Disclosure

The platform stores booking details, notification feeds, private messages, coach favorites, ownership documents, and other personal data. Endpoints returning this information MUST scope results to the authenticated user or authorized owner/admin, and public/static file serving MUST NOT expose non-public verification documents or private media inadvertently. For this deployment model, `/courts/uploads` is confirmed public in production, while ownership-document web reachability must be demonstrated rather than assumed from source-path naming alone.

Logs, error messages, and integration responses MUST avoid leaking secrets, internal identifiers, or sensitive third-party configuration. Booking IDs, message thread identifiers, and notification IDs should not be sufficient by themselves to read another user’s data.

### Denial of Service

Public and lightly protected endpoints handle file uploads, booking creation, messaging, search, and external API work. The application SHOULD bound request sizes, expensive queries, and upload types, and SHOULD apply rate limiting or similar protections to endpoints that can be abused anonymously or at low cost.

External service calls to Stripe, Clerk proxying, and email delivery SHOULD fail safely with timeouts and constrained retry behavior so attackers cannot easily amplify backend work.

### Elevation of Privilege

This codebase has clear player, coach, owner, and admin boundaries, but many routes work with direct numeric IDs or user identifiers. Every route that reads or mutates user-owned data MUST enforce object-level authorization on the server. Frontend route guards such as owner/admin pages are not security controls.

Admin-only and owner-only actions — including moderation, seeding, payout onboarding, manual bookings, court status changes, photo management, and private registration data — MUST check both authentication and the caller’s role/resource ownership server-side. Any public route that can change another user’s state, read their data, or influence payments is a high-severity risk in this project.
