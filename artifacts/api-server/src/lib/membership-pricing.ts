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
