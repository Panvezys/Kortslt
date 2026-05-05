import { Router, type IRouter } from "express";
import { eq, or, and, inArray, gte, lte, sql } from "drizzle-orm";
import { db, courtsTable, bookingsTable, courtBlockedSlotsTable, facilitiesTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** GET /api/owner/dashboard — owner-only summary for the dashboard.
 *  Optional query param: ?facilityId=N  →  scope to a single facility's courts.
 */
router.get("/owner/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayStr();
  const mStart = monthStart();

  const scopedFacilityId = req.query.facilityId ? Number(req.query.facilityId) : undefined;

  const ownedFacilities = await db
    .select({ id: facilitiesTable.id, name: facilitiesTable.name })
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, userId));

  const facilityIds = ownedFacilities.map(f => f.id);

  // Verify the requested facility actually belongs to this owner
  if (scopedFacilityId !== undefined && !facilityIds.includes(scopedFacilityId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const facilityInfo = scopedFacilityId !== undefined
    ? ownedFacilities.find(f => f.id === scopedFacilityId)
    : undefined;

  const courtsWhere = scopedFacilityId !== undefined
    ? eq(courtsTable.facilityId, scopedFacilityId)
    : (facilityIds.length > 0 ? inArray(courtsTable.facilityId, facilityIds) : sql`false`);

  const courts = await db
    .select()
    .from(courtsTable)
    .where(courtsWhere);

  if (courts.length === 0) {
    res.json({
      facility: facilityInfo ?? null,
      courts: [],
      todayBookings: [],
      todayBlockedSlots: [],
      recentBookings: [],
      monthlyRevenue: 0,
      monthlyBookingCount: 0,
    });
    return;
  }

  const courtIds = courts.map(c => c.id);

  const [todayBookings, todayBlockedSlots, recentBookings, monthlyStats] = await Promise.all([
    db
      .select({
        id: bookingsTable.id,
        courtId: bookingsTable.courtId,
        customerName: bookingsTable.customerName,
        customerEmail: bookingsTable.customerEmail,
        customerPhone: bookingsTable.customerPhone,
        bookerUserId: bookingsTable.bookerUserId,
        date: bookingsTable.date,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        totalPrice: bookingsTable.totalPrice,
        status: bookingsTable.status,
        rentedItems: bookingsTable.rentedItems,
        notes: bookingsTable.notes,
        createdAt: bookingsTable.createdAt,
        courtName: courtsTable.name,
      })
      .from(bookingsTable)
      .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
      .where(
        and(
          inArray(bookingsTable.courtId, courtIds),
          eq(bookingsTable.date, today),
          inArray(bookingsTable.status, ["confirmed", "pending", "blocked"]),
        )
      ),

    db
      .select()
      .from(courtBlockedSlotsTable)
      .where(
        and(
          inArray(courtBlockedSlotsTable.courtId, courtIds),
          eq(courtBlockedSlotsTable.date, today),
        )
      ),

    db
      .select({
        id: bookingsTable.id,
        courtId: bookingsTable.courtId,
        customerName: bookingsTable.customerName,
        customerEmail: bookingsTable.customerEmail,
        bookerUserId: bookingsTable.bookerUserId,
        date: bookingsTable.date,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        totalPrice: bookingsTable.totalPrice,
        refundAmount: bookingsTable.refundAmount,
        status: bookingsTable.status,
        createdAt: bookingsTable.createdAt,
        courtName: courtsTable.name,
      })
      .from(bookingsTable)
      .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
      .where(inArray(bookingsTable.courtId, courtIds))
      .orderBy(sql`${bookingsTable.createdAt} DESC`)
      .limit(5),

    // Gross = every euro that passed checkout (confirmed + cancelled).
    // Refunds = sum of refundAmount issued from cancelled bookings.
    // Net = Gross - Refunds. Reflects actual cash retained by the owner.
    db
      .select({
        grossRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${bookingsTable.status} IN ('confirmed','cancelled') THEN ${bookingsTable.totalPrice}::numeric ELSE 0 END), 0)`,
        refundedTotal: sql<string>`COALESCE(SUM(CASE WHEN ${bookingsTable.status} = 'cancelled' THEN COALESCE(${bookingsTable.refundAmount}, 0)::numeric ELSE 0 END), 0)`,
        bookingCount: sql<string>`COUNT(CASE WHEN ${bookingsTable.status} IN ('confirmed','pending') THEN 1 END)`,
      })
      .from(bookingsTable)
      .where(
        and(
          inArray(bookingsTable.courtId, courtIds),
          gte(bookingsTable.date, mStart),
          lte(bookingsTable.date, today),
        )
      ),
  ]);

  const grossRevenue = Number(monthlyStats[0]?.grossRevenue ?? 0);
  const refundedTotal = Number(monthlyStats[0]?.refundedTotal ?? 0);
  const netRevenue = Math.max(0, grossRevenue - refundedTotal);

  res.json({
    facility: facilityInfo ?? null,
    courts: courts.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      facilityId: c.facilityId,
      workingHours: c.workingHours,
    })),
    todayBookings: todayBookings.map(b => ({
      ...b,
      totalPrice: Number(b.totalPrice),
    })),
    todayBlockedSlots,
    recentBookings: recentBookings.map(b => ({
      ...b,
      totalPrice: Number(b.totalPrice),
      refundAmount: b.refundAmount != null ? Number(b.refundAmount) : 0,
    })),
    monthlyRevenue: netRevenue, // back-compat alias
    monthlyGrossRevenue: grossRevenue,
    monthlyRefundedTotal: refundedTotal,
    monthlyNetRevenue: netRevenue,
    monthlyBookingCount: Number(monthlyStats[0]?.bookingCount ?? 0),
  });
});

export default router;
