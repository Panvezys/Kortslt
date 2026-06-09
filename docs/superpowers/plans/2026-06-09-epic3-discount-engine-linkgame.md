# Epic 3 — Membership Discount Engine + LinkGame Join: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make group bookings honor membership discounts (flat `discountPercent`, `weeklySlots` cap per play-date ISO week) across all four payment paths, and let users join existing public split games from the group booking widget.

**Architecture:** Discounts apply at **booking creation** for whole bookings (one wiring point in the group `/book` endpoint covers standard, recurring, and €0→confirm-free) and at **payment time per-share** for split flows (host + invitee), tracked via `appliedMembershipId` on `bookings` and `game_participants`. A caller-aware preview rides on the availability payload. LinkGame lists joinable split games in the group detail payload and routes joins through the existing `/join/:token` share-checkout page.

**Tech Stack:** Express 5 + Drizzle ORM (Postgres), React 18 + TanStack Query, no test framework — validation is `pnpm typecheck` + live curl against a throwaway server (project convention, overrides TDD).

**Spec:** `docs/superpowers/specs/2026-06-09-epic3-discount-engine-linkgame-design.md`
**Branch:** `epic3-proxy-billing`

---

## Project conventions the engineer must know

- **Typecheck after every task:** `pnpm typecheck` from repo root. Must be green before commit.
- **Schema push (no migrations):** `cd lib/db && pnpm push-force` (plain `push` hangs on an interactive prompt).
- **Never spread raw DB rows** into API responses — explicit field lists only.
- **Bind to session principal:** `getCurrentUserId(req)` / `getAuth(req).userId`. Never trust client-supplied userIds or prices.
- **Lithuanian-first UI** strings; semantic Tailwind tokens.
- **Live validation pattern** (used in Tasks 9–10): build then run a throwaway server, never disturb the user's port 8080:
  ```bash
  cd artifacts/api-server && pnpm build && PORT=8095 node ./dist/index.mjs &   # note the PID
  # auth-bypass headers for curl:
  #   -H "x-replit-agent-auth: $AGENT_BYPASS_KEY" -H "x-replit-agent-userid: <id>" -H "x-replit-agent-role: admin"
  # ... validate ... then: kill <PID>  and DELETE seeded rows.
  ```
- **Sport normalization:** sports are matched with `REPLACE(col, '-', '_') = ${sport}` everywhere; follow that pattern.
- `bookings.date` is a `YYYY-MM-DD` text column (Vilnius-local). `games.datetime` is text `YYYY-MM-DDTHH:MM:SS` (Vilnius-local). Week-bound comparisons are therefore **pure string comparisons** — no timezone math needed beyond computing the week's Monday/Sunday date strings.

---

### Task 1: Schema — nullable slot relics + `appliedMembershipId` columns

**Files:**
- Modify: `lib/db/src/schema/memberships.ts` (lines 31–32)
- Modify: `lib/db/src/schema/bookings.ts` (add column near line 36)
- Modify: `lib/db/src/schema/games.ts` (add column in `gameParticipantsTable`, near line 48)
- Modify: `artifacts/api-server/src/routes/memberships.ts` (both subscribe endpoints)

- [ ] **Step 1: Make `user_memberships.dayOfWeek`/`startTime` nullable**

In `lib/db/src/schema/memberships.ts` replace:

```ts
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
```

with:

```ts
  // Nullable relics of the old reserved-recurring-slot model. The discount
  // model has no fixed slot; kept for legacy rows only.
  dayOfWeek: integer("day_of_week"),
  startTime: text("start_time"),
```

- [ ] **Step 2: Add `appliedMembershipId` to bookings**

In `lib/db/src/schema/bookings.ts`, add the import at the top:

```ts
import { userMembershipsTable } from "./memberships";
```

and add this column after `recurringGroupId` (line 36):

```ts
  // Membership that discounted this booking's totalPrice (whole-booking
  // discounts only — split shares track theirs on game_participants).
  // Counted against the plan's weeklySlots cap for the play-date's ISO week.
  appliedMembershipId: integer("applied_membership_id").references(() => userMembershipsTable.id, { onDelete: "set null" }),
```

(No import cycle: `memberships.ts` imports only `courts.ts`/`facilities.ts`.)

- [ ] **Step 3: Add `appliedMembershipId` to game_participants**

In `lib/db/src/schema/games.ts`, add the import:

```ts
import { userMembershipsTable } from "./memberships";
```

and inside `gameParticipantsTable`, after `stripeSessionId` (line 48):

```ts
  // Membership that discounted THIS participant's split share.
  appliedMembershipId: integer("applied_membership_id").references(() => userMembershipsTable.id, { onDelete: "set null" }),
```

- [ ] **Step 4: Stop requiring dayOfWeek/startTime on subscribe**

In `artifacts/api-server/src/routes/memberships.ts` there are TWO subscribe endpoints (`POST /courts/:id/memberships/:planId/subscribe` ~line 80, and `POST /facilities/:facilityId/:sport/memberships/:planId/subscribe` ~line 139). In **both**, replace:

```ts
  const { dayOfWeek, startTime } = req.body as any;
  if (dayOfWeek === undefined || !startTime) { res.status(400).json({ error: "dayOfWeek and startTime required" }); return; }
```

with:

```ts
  // dayOfWeek/startTime are optional relics of the reserved-slot model.
  const { dayOfWeek, startTime } = req.body as any;
```

and in both inserts replace `dayOfWeek: Number(dayOfWeek), startTime,` with:

```ts
    dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
    startTime: startTime || null,
```

- [ ] **Step 5: Push schema and typecheck**

```bash
cd lib/db && pnpm push-force
cd /home/runner/workspace && pnpm typecheck
```
Expected: push completes; typecheck green.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/memberships.ts lib/db/src/schema/bookings.ts lib/db/src/schema/games.ts artifacts/api-server/src/routes/memberships.ts
git commit -m "feat(epic3): schema — appliedMembershipId tracking, nullable reserved-slot relics"
```

---

### Task 2: Discount engine — `membership-pricing.ts`

**Files:**
- Create: `artifacts/api-server/src/lib/membership-pricing.ts`

- [ ] **Step 1: Create the engine module**

```ts
import { and, eq, desc, sql } from "drizzle-orm";
import {
  db, userMembershipsTable, courtMembershipsTable,
  bookingsTable, gameParticipantsTable, gamesTable,
} from "@workspace/db";

/** Any Drizzle executor — the live `db` or a transaction handle. */
type DbOrTx = Pick<typeof db, "select">;

export interface DiscountResult {
  /** Amount after discount (EUR, 2dp). Equals input when no discount applies. */
  discounted: number;
  /** user_memberships.id consumed, or null when no discount applied. */
  membershipId: number | null;
  /** True when the caller HAS a discount membership but this week's cap is used up. */
  capReached: boolean;
  /** The percent that was applied (null when none). */
  percent: number | null;
}

export interface DiscountState {
  percent: number;
  weeklySlots: number | null; // null/0 = unlimited
  usedThisWeek: number;
}

/**
 * Monday-anchored ISO week bounds for a play date, as YYYY-MM-DD strings.
 * bookings.date and games.datetime are Vilnius-local text columns, so the
 * cap window is a pure string range — no timezone conversion needed.
 */
export function isoWeekBounds(playDate: string): { weekStart: string; weekEnd: string } {
  const d = new Date(`${playDate}T12:00:00`); // noon avoids UTC day-shift
  const mondayOffset = (d.getDay() + 6) % 7;  // Mon=0 … Sun=6
  const start = new Date(d); start.setDate(d.getDate() - mondayOffset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { weekStart: fmt(start), weekEnd: fmt(end) };
}

/**
 * Count discounted uses of one membership in [weekStart, weekEnd]:
 * whole bookings (by play date) + split shares (by the game's datetime date).
 * Pending rows count only while fresh (<15 min) — same convention as the
 * slot-conflict checks in search-groups.ts / split-payments.ts.
 */
async function countWeeklyUses(ex: DbOrTx, membershipId: number, weekStart: string, weekEnd: string): Promise<number> {
  const [bRow] = await ex.select({ n: sql<number>`COUNT(*)` })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.appliedMembershipId, membershipId),
      sql`${bookingsTable.date} >= ${weekStart} AND ${bookingsTable.date} <= ${weekEnd}`,
      sql`(${bookingsTable.status} IN ('confirmed', 'awaiting_players')
           OR (${bookingsTable.status} = 'pending' AND ${bookingsTable.createdAt} > NOW() - INTERVAL '15 minutes'))`,
    ));
  const [pRow] = await ex.select({ n: sql<number>`COUNT(*)` })
    .from(gameParticipantsTable)
    .innerJoin(gamesTable, eq(gameParticipantsTable.gameId, gamesTable.id))
    .where(and(
      eq(gameParticipantsTable.appliedMembershipId, membershipId),
      sql`SUBSTRING(${gamesTable.datetime} FROM 1 FOR 10) >= ${weekStart} AND SUBSTRING(${gamesTable.datetime} FROM 1 FOR 10) <= ${weekEnd}`,
      sql`(${gameParticipantsTable.paymentStatus} = 'paid'
           OR (${gameParticipantsTable.paymentStatus} = 'pending' AND ${gameParticipantsTable.joinedAt} > NOW() - INTERVAL '15 minutes'))`,
    ));
  return Number(bRow?.n ?? 0) + Number(pRow?.n ?? 0);
}

function activeMembershipFilter(userId: string, facilityId: number, sportNorm: string) {
  return and(
    eq(userMembershipsTable.userId, userId),
    eq(userMembershipsTable.status, "active"),
    sql`${userMembershipsTable.expiresAt} > NOW()`,
    eq(userMembershipsTable.facilityId, facilityId),
    sql`REPLACE(${userMembershipsTable.sport}, '-', '_') = ${sportNorm}`,
    eq(courtMembershipsTable.isActive, true),
  );
}

/**
 * Apply the caller's best membership discount to a server-computed amount.
 * MUST be called inside the checkout/booking transaction: it locks the
 * candidate user_memberships rows FOR UPDATE to serialize concurrent
 * checkouts against the weekly cap.
 *
 * Rules (from the Epic 3 spec):
 *  - highest discountPercent with remaining weekly cap wins
 *  - weeklySlots null/0 = unlimited; cap reached → full price, never blocked
 *  - guests (userId null) and zero amounts pass through unchanged
 */
export async function applyMembershipDiscount(
  tx: DbOrTx,
  opts: { userId: string | null | undefined; facilityId: number; sport: string; playDate: string; amountEur: number },
): Promise<DiscountResult> {
  const { userId, facilityId, sport, playDate, amountEur } = opts;
  const none: DiscountResult = { discounted: amountEur, membershipId: null, capReached: false, percent: null };
  if (!userId || amountEur <= 0) return none;

  const sportNorm = sport.replace(/-/g, "_");
  const candidates = await tx.select({
    membershipId: userMembershipsTable.id,
    discountPercent: courtMembershipsTable.discountPercent,
    weeklySlots: courtMembershipsTable.weeklySlots,
  })
    .from(userMembershipsTable)
    .innerJoin(courtMembershipsTable, eq(userMembershipsTable.membershipPlanId, courtMembershipsTable.id))
    .where(activeMembershipFilter(userId, facilityId, sportNorm))
    .orderBy(desc(courtMembershipsTable.discountPercent))
    .for("update", { of: userMembershipsTable });

  const { weekStart, weekEnd } = isoWeekBounds(playDate);
  let sawCapped = false;
  for (const c of candidates) {
    const pct = Number(c.discountPercent ?? 0);
    if (pct <= 0) continue; // plan exists for other perks — no price change
    if (c.weeklySlots != null && c.weeklySlots > 0) {
      const used = await countWeeklyUses(tx, c.membershipId, weekStart, weekEnd);
      if (used >= c.weeklySlots) { sawCapped = true; continue; }
    }
    const discounted = Math.round(amountEur * (100 - pct)) / 100;
    return { discounted, membershipId: c.membershipId, capReached: false, percent: pct };
  }
  return { ...none, capReached: sawCapped };
}

/**
 * Read-only preview for the booking widget (no locks). Returns the caller's
 * best discount membership state for the play-date's week, or null.
 */
export async function getMembershipDiscountState(
  userId: string | null | undefined, facilityId: number, sport: string, playDate: string,
): Promise<DiscountState | null> {
  if (!userId) return null;
  const sportNorm = sport.replace(/-/g, "_");
  const candidates = await db.select({
    membershipId: userMembershipsTable.id,
    discountPercent: courtMembershipsTable.discountPercent,
    weeklySlots: courtMembershipsTable.weeklySlots,
  })
    .from(userMembershipsTable)
    .innerJoin(courtMembershipsTable, eq(userMembershipsTable.membershipPlanId, courtMembershipsTable.id))
    .where(activeMembershipFilter(userId, facilityId, sportNorm))
    .orderBy(desc(courtMembershipsTable.discountPercent));

  const { weekStart, weekEnd } = isoWeekBounds(playDate);
  for (const c of candidates) {
    const pct = Number(c.discountPercent ?? 0);
    if (pct <= 0) continue;
    const used = await countWeeklyUses(db, c.membershipId, weekStart, weekEnd);
    return { percent: pct, weeklySlots: c.weeklySlots && c.weeklySlots > 0 ? c.weeklySlots : null, usedThisWeek: used };
  }
  return null;
}
```

Note on `Math.round(amountEur * (100 - pct)) / 100`: amount×(100−pct) is cents when amountEur has 2dp, so this rounds to whole cents in one step without float-chaining.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: green. (If `.for("update", { of: ... })` errors on the installed drizzle-orm version, fall back to `.for("update")` — both candidate-row locks are on the joined select.)

- [ ] **Step 3: Commit**

```bash
git add artifacts/api-server/src/lib/membership-pricing.ts
git commit -m "feat(epic3): membership discount engine (weekly-cap aware, FOR UPDATE serialized)"
```

---

### Task 3: Wire discount into group `/book` (covers standard + recurring + €0)

**Files:**
- Modify: `artifacts/api-server/src/routes/search-groups.ts` (the `POST /search/groups/:facilityId/:sport/book` handler, lines 558–777; insert at lines 731–748)

- [ ] **Step 1: Import the engine**

At the top of `search-groups.ts` add:

```ts
import { applyMembershipDiscount } from "../lib/membership-pricing";
```

- [ ] **Step 2: Apply discount inside the booking transaction**

In the `/book` handler, the insert currently reads (lines 731–746):

```ts
        const managementToken = bookerUserId ? null : generateManagementToken();

        const [inserted] = await tx.insert(bookingsTable).values({
          ...
          totalPrice: String(courtPrice + equipmentCost),
          ...
```

Replace with:

```ts
        const managementToken = bookerUserId ? null : generateManagementToken();

        // Membership discount applies to the COURT price only — equipment is
        // always full price. Must run inside this tx (FOR UPDATE cap check).
        const discount = await applyMembershipDiscount(tx, {
          userId: bookerUserId, facilityId, sport, playDate: date, amountEur: courtPrice,
        });

        const [inserted] = await tx.insert(bookingsTable).values({
          courtId: court.id,
          bookerUserId: bookerUserId ?? null,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerPhone: customerPhone?.trim() ?? null,
          date,
          startTime,
          endTime,
          totalPrice: String(discount.discounted + equipmentCost),
          rentedItems: validatedRentedItems,
          status: "pending",
          managementToken,
          appliedMembershipId: discount.membershipId,
        }).returning();

        return inserted;
```

No change to the 201 response shape — `totalPrice` now simply reflects the discounted value, and the widget already routes `totalPrice === 0` to `POST /payments/confirm-free` (the €0 path needs no new code).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/routes/search-groups.ts
git commit -m "feat(epic3): apply membership discount at group booking creation"
```

---

### Task 4: Caller-aware discount preview on the availability payload

**Files:**
- Modify: `artifacts/api-server/src/routes/search-groups.ts` (the `GET .../availability` handler, lines 469–553)

- [ ] **Step 1: Add the import** (skip if Task 3 already added the module import — extend it):

```ts
import { applyMembershipDiscount, getMembershipDiscountState } from "../lib/membership-pricing";
```

- [ ] **Step 2: Compute and return `membershipDiscount`**

In the availability handler, replace the final response (line 551–552):

```ts
  const courtList = courts.map(c => ({ id: c.id, name: c.name, surface: c.surface }));
  res.json({ facilityId, sport, date, slots, courts: courtList });
```

with:

```ts
  const courtList = courts.map(c => ({ id: c.id, name: c.name, surface: c.surface }));

  // Caller-aware membership discount preview for this play date's week.
  // customFetch attaches the Clerk JWT, so getCurrentUserId works here;
  // anonymous users and non-members get null.
  const membershipDiscount = await getMembershipDiscountState(getCurrentUserId(req), facilityId, sport, date);

  res.json({ facilityId, sport, date, slots, courts: courtList, membershipDiscount });
```

(`getCurrentUserId` is already imported in this file.)

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm typecheck
git add artifacts/api-server/src/routes/search-groups.ts
git commit -m "feat(epic3): membership discount preview in group availability payload"
```

---

### Task 5: Split host share — discount at checkout-split

**Files:**
- Modify: `artifacts/api-server/src/routes/split-payments.ts` (the `POST /search/groups/:facilityId/:sport/checkout-split` handler, lines 1038–1236)

- [ ] **Step 1: Import the engine**

At the top of `split-payments.ts` add:

```ts
import { applyMembershipDiscount } from "../lib/membership-pricing";
```

- [ ] **Step 2: Compute the host's discounted share inside the transaction**

After `pricePerSlot` is computed (line 1116: `const pricePerSlot = Math.round((courtPrice / totalSlots) * 100) / 100;`) and before the booking insert, add:

```ts
        // Host's own membership discounts the host's share only. Booking keeps
        // full totalPrice/pricePerSlot — other participants pay full shares.
        const hostDiscount = await applyMembershipDiscount(tx, {
          userId, facilityId, sport, playDate: date, amountEur: pricePerSlot,
        });
```

Set it on the host participant insert (line 1161, add one field):

```ts
        const [hostParticipant] = await tx.insert(gameParticipantsTable).values({
          gameId: game.id,
          userId,
          userName: customerName,
          userEmail: customerEmail,
          status: "joined",
          source: "join_request",
          paymentStatus: "pending",
          appliedMembershipId: hostDiscount.membershipId,
        }).returning();
```

And extend the transaction's return (line 1171):

```ts
        return { booking, game, hostParticipant, courtPrice, pricePerSlot, splitInviteToken, durationMinutes, hostShareEur: hostDiscount.discounted };
```

- [ ] **Step 3: Charge the discounted share; settle €0 without Stripe**

The Stripe block (lines 1180–1224) currently computes `const amountCents = Math.round(result.pricePerSlot * 100);` inside the `try`. Restructure: extract the existing mock-fallback body (lines 1213–1217) into a local helper, compute `amountCents` from the discounted share, and route €0 through the helper:

```ts
      let checkoutUrl: string;
      const amountCents = Math.round(result.hostShareEur * 100);

      // Shared by the €0-share path and the Stripe-not-configured fallback:
      // mark host paid, move booking + game to awaiting_players.
      async function settleHostShareWithoutStripe(sessionId: string): Promise<string> {
        await db.update(bookingsTable).set({ stripeSessionId: sessionId, status: "awaiting_players" }).where(eq(bookingsTable.id, result.booking.id));
        await db.update(gameParticipantsTable).set({ stripeSessionId: sessionId, paymentStatus: "paid" }).where(eq(gameParticipantsTable.id, result.hostParticipant.id));
        await db.update(gamesTable).set({ status: "awaiting_players" }).where(eq(gamesTable.id, result.game.id));
        return `${successUrl}&session_id=${sessionId}`;
      }

      if (amountCents === 0) {
        // Membership covered the host's entire share — no payment session needed.
        checkoutUrl = await settleHostShareWithoutStripe(`free_split_${result.booking.id}_${Date.now()}`);
      } else {
        try {
          // ... existing Stripe session code, UNCHANGED except that the
          // line `const amountCents = Math.round(result.pricePerSlot * 100);`
          // is DELETED (amountCents now comes from the discounted share above).
        } catch (err: any) {
          if (err?.message?.includes("Stripe not configured") || err?.type === "StripeAuthenticationError") {
            checkoutUrl = await settleHostShareWithoutStripe(`mock_split_${result.booking.id}_${Date.now()}`);
          } else {
            logger.error({ err }, "Group split: Stripe session failed");
            await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, result.booking.id));
            await db.delete(gamesTable).where(eq(gamesTable.id, result.game.id));
            res.status(500).json({ error: "Failed to create payment session" }); return;
          }
        }
      }
```

Keep the final 201 response unchanged, but report the host's actual share: change `pricePerSlot: result.pricePerSlot` to `pricePerSlot: result.hostShareEur`.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add artifacts/api-server/src/routes/split-payments.ts
git commit -m "feat(epic3): host membership discount on split checkout, free-share settle path"
```

---

### Task 6: Split invitee share — discount at share-checkout

**Files:**
- Modify: `artifacts/api-server/src/routes/split-payments.ts` (the `POST /bookings/share/:token/checkout` handler, lines 667–955)

- [ ] **Step 1: Apply the joiner's discount inside the join transaction**

The join transaction (lines 780–814) already serializes via `FOR UPDATE` on the booking row. Extend it: after the capacity check (line 801) and before the participant insert, add — note `game.sport`, `booking.date`, and the facility id come from rows already loaded in this handler:

```ts
      // Joiner's own membership discounts their share. Guests never qualify.
      const shareDiscount = await applyMembershipDiscount(tx, {
        userId: isGuest ? null : userId,
        facilityId: facility?.id ?? game.facilityId ?? 0,
        sport: game.sport,
        playDate: booking.date.split("T")[0],
        amountEur: pricePerSlot,
      });

      const [newParticipant] = await tx.insert(gameParticipantsTable).values({
        gameId: game.id,
        userId: isGuest ? null : userId,
        userName,
        userEmail: userEmail || null,
        status: "joined",
        source: "join_request",
        paymentStatus: "pending",
        appliedMembershipId: shareDiscount.membershipId,
      }).returning();

      return { participant: newParticipant, shareEur: shareDiscount.discounted };
```

Adjust the surrounding code: the transaction now returns `{ participant, shareEur }`, so change

```ts
  let participant: typeof gameParticipantsTable.$inferSelect;
  try {
    participant = await db.transaction(async (tx) => {
```

to

```ts
  let participant: typeof gameParticipantsTable.$inferSelect;
  let shareEur = pricePerSlot;
  try {
    ({ participant, shareEur } = await db.transaction(async (tx) => {
```

(close with `}));` and keep the existing catch mapping of `txCode` errors).

- [ ] **Step 2: Charge the discounted share; settle €0 without Stripe**

The handler's Stripe block (lines 831–952) computes `const amountCents = Math.round(pricePerSlot * 100);` (line 846). Extract the entire existing mock-fallback body (lines 890–946: mark paid, confirm-if-all-paid, host notification + emails, invitee email) into a local function and reuse it for €0:

```ts
  async function settleShareWithoutStripe(sessionId: string): Promise<string> {
    // ── body is the EXISTING lines 891–946 verbatim, with `mockId` renamed
    //    to `sessionId` and `pricePerSlot` in the invitee email replaced by
    //    `shareEur` ──
    return `${successUrl}&session_id=${sessionId}`;
  }

  let checkoutUrl: string;
  const amountCents = Math.round(shareEur * 100);

  if (amountCents === 0) {
    checkoutUrl = await settleShareWithoutStripe(`free_split_join_${booking.id}_${Date.now()}`);
  } else {
    try {
      // existing Stripe code unchanged, except DELETE the old
      // `const amountCents = Math.round(pricePerSlot * 100);` line
    } catch (err: any) {
      if (err?.message?.includes("Stripe not configured") || err?.type === "StripeAuthenticationError") {
        checkoutUrl = await settleShareWithoutStripe(`mock_split_join_${booking.id}_${Date.now()}`);
      } else {
        logger.error({ err }, "Failed to create Stripe session for split participant");
        res.status(500).json({ error: "Failed to create payment session" });
        return;
      }
    }
  }

  res.json({ url: checkoutUrl });
```

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm typecheck
git add artifacts/api-server/src/routes/split-payments.ts
git commit -m "feat(epic3): invitee membership discount on share checkout, free-share settle path"
```

---

### Task 7: Widget — show "Nario kaina" + capped notice

**Files:**
- Modify: `artifacts/courtbook/src/components/group-booking-widget.tsx` (type at line 25; price summary at lines 729–747; reserve button at line 777)

- [ ] **Step 1: Extend the availability response type** (line 25):

```ts
interface MembershipDiscountState { percent: number; weeklySlots: number | null; usedThisWeek: number; }
interface GroupAvailabilityResponse { facilityId: number; sport: string; date: string; slots: GroupSlot[]; courts: GroupCourt[]; membershipDiscount?: MembershipDiscountState | null; }
```

- [ ] **Step 2: Derive the member price** — add after the `equipmentTotal` memo (~line 223):

```ts
  // ── Membership discount preview (caller-aware, from availability payload) ──
  const memberDiscount = availability?.membershipDiscount ?? null;
  const discountCapped = memberDiscount != null && memberDiscount.weeklySlots != null && memberDiscount.usedThisWeek >= memberDiscount.weeklySlots;
  const discountActive = memberDiscount != null && !discountCapped;
  const memberCourtPrice = useMemo(() => {
    if (!selectedSlotRange || !discountActive || !memberDiscount) return null;
    return Math.round(selectedSlotRange.totalPrice * (100 - memberDiscount.percent)) / 100;
  }, [selectedSlotRange, discountActive, memberDiscount]);
```

- [ ] **Step 3: Render in the price summary.** The court line currently reads (line 731):

```tsx
                <div className="flex items-center justify-between"><span>Aikštelė ({selectedSlotRange.durationLabel})</span><span>{fmtPrice(selectedSlotRange.totalPrice)} €</span></div>
```

Replace with:

```tsx
                <div className="flex items-center justify-between">
                  <span>Aikštelė ({selectedSlotRange.durationLabel})</span>
                  {memberCourtPrice != null ? (
                    <span>
                      <span className="line-through text-muted-foreground mr-1.5">{fmtPrice(selectedSlotRange.totalPrice)} €</span>
                      <span className="font-semibold text-primary">{fmtPrice(memberCourtPrice)} €</span>
                    </span>
                  ) : (
                    <span>{fmtPrice(selectedSlotRange.totalPrice)} €</span>
                  )}
                </div>
                {memberCourtPrice != null && (
                  <div className="text-xs text-primary">Nario kaina (−{memberDiscount!.percent}%)</div>
                )}
                {discountCapped && (
                  <div className="text-xs text-muted-foreground">Šios savaitės narystės nuolaida išnaudota</div>
                )}
```

The total line (line 737) and reserve-button label (line 777) use `selectedSlotRange.totalPrice + equipmentTotal`; in **both**, substitute the discounted court price when present:

```ts
(memberCourtPrice ?? selectedSlotRange.totalPrice) + equipmentTotal
```

Leave the split-mode per-player labels (lines 680/741) on full price — split shares are discounted per-participant at payment time, not previewable per other players.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add artifacts/courtbook/src/components/group-booking-widget.tsx
git commit -m "feat(epic3): member price preview in group booking widget"
```

---

### Task 8: LinkGame backend — `openGames[]` in group detail

**Files:**
- Modify: `artifacts/api-server/src/routes/search-groups.ts` (detail handler, lines 231–463; add to imports, the `GroupDetailResult` interface near the top of the file, and the response object at line 430)
- Modify: `artifacts/courtbook/src/lib/search-groups-types.ts`

- [ ] **Step 1: Server query + payload.** Add `gamesTable, gameParticipantsTable` to the `@workspace/db` import in `search-groups.ts`. Add to the server-side `GroupDetailResult` interface (and a sibling interface):

```ts
export interface GroupOpenGame {
  id: number;
  datetime: string;
  durationMinutes: number;
  joinedCount: number;
  playersNeeded: number;
  pricePerSlot: number;
  splitInviteToken: string;
  minSkillLevel: number | null;
  maxSkillLevel: number | null;
  creatorName: string;
}
// and on GroupDetailResult:
  openGames: GroupOpenGame[];
```

In the detail handler, after the `lastBookedAt` block (line 428), add:

```ts
  // ── Joinable public split games (LinkGame) ────────────────────────────────
  // Spec refinement: split games are joinable while their booking is
  // awaiting_players — the game itself may be 'awaiting_players' or 'open'.
  const openGameRows = await db.select({
    id: gamesTable.id,
    datetime: gamesTable.datetime,
    durationMinutes: gamesTable.durationMinutes,
    playersNeeded: gamesTable.playersNeeded,
    minSkillLevel: gamesTable.minSkillLevel,
    maxSkillLevel: gamesTable.maxSkillLevel,
    creatorName: gamesTable.creatorName,
    pricePerSlot: bookingsTable.pricePerSlot,
    splitInviteToken: bookingsTable.splitInviteToken,
    joinedCount: sql<number>`(SELECT COUNT(*) FROM game_participants gp WHERE gp.game_id = ${gamesTable.id} AND gp.status = 'joined')`,
  })
    .from(gamesTable)
    .innerJoin(bookingsTable, eq(gamesTable.bookingId, bookingsTable.id))
    .where(and(
      eq(gamesTable.facilityId, facilityId),
      sql`REPLACE(${gamesTable.sport}, '-', '_') = ${sport}`,
      eq(gamesTable.visibility, "public"),
      inArray(gamesTable.status, ["awaiting_players", "open"]),
      eq(bookingsTable.isSplit, true),
      eq(bookingsTable.status, "awaiting_players"),
      sql`${gamesTable.datetime} > TO_CHAR(NOW() AT TIME ZONE 'Europe/Vilnius', 'YYYY-MM-DD"T"HH24:MI:SS')`,
    ))
    .orderBy(gamesTable.datetime);

  const openGames: GroupOpenGame[] = openGameRows
    .filter(g => Number(g.joinedCount) < g.playersNeeded && g.splitInviteToken != null)
    .map(g => ({
      id: g.id,
      datetime: g.datetime,
      durationMinutes: g.durationMinutes,
      joinedCount: Number(g.joinedCount),
      playersNeeded: g.playersNeeded,
      pricePerSlot: Number(g.pricePerSlot ?? 0),
      splitInviteToken: g.splitInviteToken!,
      minSkillLevel: g.minSkillLevel,
      maxSkillLevel: g.maxSkillLevel,
      creatorName: g.creatorName,
    }));
```

and add `openGames,` to the `response` object (after `lastBookedAt,` at line 459).

- [ ] **Step 2: Mirror the client type.** In `artifacts/courtbook/src/lib/search-groups-types.ts` add:

```ts
export interface GroupOpenGame {
  id: number;
  datetime: string;
  durationMinutes: number;
  joinedCount: number;
  playersNeeded: number;
  pricePerSlot: number;
  splitInviteToken: string;
  minSkillLevel: number | null;
  maxSkillLevel: number | null;
  creatorName: string;
}
```

and on `GroupDetailResult`: `openGames: GroupOpenGame[];`

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm typecheck
git add artifacts/api-server/src/routes/search-groups.ts artifacts/courtbook/src/lib/search-groups-types.ts
git commit -m "feat(epic3): joinable public split games in group detail payload"
```

---

### Task 9: LinkGame frontend — join section in the widget

**Files:**
- Modify: `artifacts/courtbook/src/components/group-booking-widget.tsx` (Props at line 84; render after the extras section ~line 660)
- Modify: `artifacts/courtbook/src/pages/facility-sport.tsx` (pass the new prop where `<GroupBookingWidget>` is rendered)

The `/join/:token` page (`src/pages/join-booking.tsx`, route in `App.tsx:301`) already handles share-checkout — including the joiner's discount after Task 6. The widget only needs to surface and link.

- [ ] **Step 1: Add the prop.** In the widget's `Props` interface and destructuring add:

```ts
  openGames?: import("@/lib/search-groups-types").GroupOpenGame[];
```

(or a top-level `import type { GroupOpenGame } from "@/lib/search-groups-types";` and `openGames?: GroupOpenGame[];`).

- [ ] **Step 2: Render the section.** Inside the widget body, after the extras (recurring/split) block and before the price summary, add:

```tsx
          {/* ── LinkGame: join an existing public split game ── */}
          {(openGames?.length ?? 0) > 0 && !splitEnabled && !recurringEnabled && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-muted-foreground">Prisijungti prie esamo žaidimo</p>
              {openGames!.slice(0, 3).map(g => {
                const dt = new Date(g.datetime);
                const when = `${dt.toLocaleDateString("lt-LT", { month: "2-digit", day: "2-digit" })} ${g.datetime.slice(11, 16)}`;
                return (
                  <a key={g.id} href={`${BASE}/join/${g.splitInviteToken}`}
                     className="flex items-center justify-between rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors px-3 py-2">
                    <span className="text-xs">
                      <span className="font-medium text-foreground">{when}</span>
                      <span className="text-muted-foreground"> · {g.joinedCount}/{g.playersNeeded} žaid. · {g.creatorName}</span>
                    </span>
                    <span className="text-xs font-semibold text-primary">{g.pricePerSlot.toFixed(2)} €</span>
                  </a>
                );
              })}
            </div>
          )}
```

(`BASE` is already imported/defined in this file — it's used at line 349.)

- [ ] **Step 3: Pass the data.** In `facility-sport.tsx`, where the group detail data is destructured (it already pulls `memberships, lastBookedAt`), also pull `openGames`, and pass `openGames={openGames}` to `<GroupBookingWidget … />`.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add artifacts/courtbook/src/components/group-booking-widget.tsx artifacts/courtbook/src/pages/facility-sport.tsx
git commit -m "feat(epic3): LinkGame join section in group booking widget"
```

---

### Task 10: End-to-end live validation

**Files:** none modified — validation only. Run on a throwaway port; clean up all seeded rows; never touch port 8080.

- [ ] **Step 1: Build + start throwaway server**

```bash
cd artifacts/api-server && pnpm build && PORT=8095 node ./dist/index.mjs > /tmp/epic3-validate.log 2>&1 &
```

- [ ] **Step 2: Seed.** Pick an existing active facility with tennis courts (query DB or `GET /api/search/groups`). As the owner/admin (bypass headers), create a plan with `discountPercent: 50, weeklySlots: 2` via `POST /api/facilities/:fid/tennis/memberships`. Subscribe a test user (`x-replit-agent-userid: epic3_test_member`) via `POST .../memberships/:planId/subscribe` (no dayOfWeek/startTime — must succeed after Task 1).

- [ ] **Step 3: Validate each spec scenario** (record actual outputs):

| # | Action | Expect |
|---|---|---|
| 1 | Member `POST .../book` (next Monday, 10:00–11:00) | `totalPrice` = 50% of full; DB row has `appliedMembershipId` |
| 2 | Same member books a 2nd slot same play-week | discounted (cap 2) |
| 3 | 3rd booking same play-week | **full price**, `appliedMembershipId` null |
| 4 | Booking in the NEXT play-week | discounted again (fresh week) |
| 5 | `GET .../availability?date=<monday>` as member | `membershipDiscount: { percent: 50, weeklySlots: 2, usedThisWeek: 2 }` |
| 6 | Same, anonymous (no auth headers) | `membershipDiscount: null` |
| 7 | Member `POST .../checkout-split` (totalSlots 4) | response `pricePerSlot` = discounted host share; participant row has `appliedMembershipId` (mock Stripe → booking `awaiting_players`) |
| 8 | Guest invitee `POST /api/bookings/share/:token/checkout` | full share (mock paid) |
| 9 | A second member (separate subscription, 100% plan) joins via share token | share €0 → `free_split_join_*` session id, marked paid without Stripe |
| 10 | `GET /api/search/groups/:fid/tennis` | `openGames[]` contains the seeded public split game with correct joinedCount/pricePerSlot/token |
| 11 | Concurrency: two parallel `/book` calls, member with `weeklySlots: 1` | exactly ONE discounted booking |

For #11:
```bash
curl -s -X POST "http://localhost:8095/api/search/groups/$FID/tennis/book" -H ... -d '{"date":"<wk>","startTime":"08:00","endTime":"08:30",...}' &
curl -s -X POST "http://localhost:8095/api/search/groups/$FID/tennis/book" -H ... -d '{"date":"<wk>","startTime":"09:00","endTime":"09:30",...}' &
wait
# then: SELECT total_price, applied_membership_id FROM bookings WHERE ... — exactly one row with applied_membership_id set
```

- [ ] **Step 4: Clean up** — `DELETE` the seeded bookings, games, game_participants, user_memberships, court_memberships rows; `kill` the 8095 server. Re-run `pnpm typecheck` once more.

- [ ] **Step 5: Commit any validation-driven fixes**

```bash
git add -A -- artifacts lib
git commit -m "fix(epic3): validation-driven fixes"   # only if fixes were needed
```

---

### Task 11: Docs + memory

**Files:**
- Create: `docs/membership-discount-engine.md`
- Create: `docs/linkgame-join.md`
- Modify: `.claude_data/projects/-home-runner-workspace/memory/hotel-room-epics.md`

- [ ] **Step 1:** Write `docs/membership-discount-engine.md` — concise high-level doc per project convention: data model (`appliedMembershipId` on bookings/game_participants, nullable slot relics), engine API (`applyMembershipDiscount` contract incl. FOR UPDATE + freshness-window cap counting, `getMembershipDiscountState`), the four wiring points, week semantics (play-date ISO week Mon–Sun Vilnius), €0 settle paths, relevant files.

- [ ] **Step 2:** Write `docs/linkgame-join.md` — `openGames[]` payload criteria (public + split + booking awaiting_players + future + free slots), widget section, join via existing `/join/:token` share-checkout.

- [ ] **Step 3:** Update the `hotel-room-epics` memory file: Epic 3 → done (engine + LinkGame), note what remains deferred (server-side atomic recurring, membership fee payments, admin plan UI).

- [ ] **Step 4: Commit**

```bash
git add docs/membership-discount-engine.md docs/linkgame-join.md
git commit -m "docs(epic3): membership discount engine + LinkGame feature docs"
```
