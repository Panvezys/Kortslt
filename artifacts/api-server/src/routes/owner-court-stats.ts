import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { db, courtsTable, bookingsTable, facilitiesTable } from "@workspace/db";
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

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

/** GET /api/owner/courts/:courtId/stats */
router.get("/owner/courts/:courtId/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const courtId = Number(req.params.courtId);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court ID" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId)).limit(1);
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const facilityId = court.facilityId;
  const [facility] = await db
    .select({ ownerUserId: facilitiesTable.ownerUserId })
    .from(facilitiesTable)
    .where(eq(facilitiesTable.id, court.facilityId))
    .limit(1);
  if (!facility || facility.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = todayStr();
  const mStart = monthStart();
  const wStart = weekStart();

  const [todayBookings, weeklyBookings, recentBookings, monthlyStats, facilityRow] = await Promise.all([
    db.select({
      id: bookingsTable.id,
      courtId: bookingsTable.courtId,
      customerName: bookingsTable.customerName,
      customerEmail: bookingsTable.customerEmail,
      customerPhone: bookingsTable.customerPhone,
      date: bookingsTable.date,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      totalPrice: bookingsTable.totalPrice,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
    })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.courtId, courtId),
        eq(bookingsTable.date, today),
        // Schedule view ignores cancelled rows so the slot reads as free.
        inArray(bookingsTable.status, ["confirmed", "pending", "blocked"]),
      ))
      .orderBy(bookingsTable.startTime),

    db.select({
      id: bookingsTable.id,
      courtId: bookingsTable.courtId,
      customerName: bookingsTable.customerName,
      customerEmail: bookingsTable.customerEmail,
      date: bookingsTable.date,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      totalPrice: bookingsTable.totalPrice,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
    })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.courtId, courtId),
        gte(bookingsTable.date, wStart),
        lte(bookingsTable.date, today),
        // Weekly schedule excludes cancelled bookings so freed slots appear empty.
        inArray(bookingsTable.status, ["confirmed", "pending", "blocked"]),
      ))
      .orderBy(bookingsTable.date, bookingsTable.startTime),

    db.select({
      id: bookingsTable.id,
      courtId: bookingsTable.courtId,
      customerName: bookingsTable.customerName,
      customerEmail: bookingsTable.customerEmail,
      customerPhone: bookingsTable.customerPhone,
      date: bookingsTable.date,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      totalPrice: bookingsTable.totalPrice,
      refundAmount: bookingsTable.refundAmount,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
    })
      .from(bookingsTable)
      .where(eq(bookingsTable.courtId, courtId))
      .orderBy(sql`${bookingsTable.createdAt} DESC`)
      .limit(30),

    db.select({
      grossRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${bookingsTable.status} IN ('confirmed','cancelled') THEN ${bookingsTable.totalPrice}::numeric ELSE 0 END), 0)`,
      refundedTotal: sql<string>`COALESCE(SUM(CASE WHEN ${bookingsTable.status} = 'cancelled' THEN COALESCE(${bookingsTable.refundAmount}, 0)::numeric ELSE 0 END), 0)`,
      bookingCount: sql<string>`COUNT(CASE WHEN ${bookingsTable.status} IN ('confirmed','pending') THEN 1 END)`,
    })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.courtId, courtId),
        gte(bookingsTable.date, mStart),
        lte(bookingsTable.date, today),
      )),

    facilityId
      ? db.select({ id: facilitiesTable.id, name: facilitiesTable.name })
          .from(facilitiesTable)
          .where(eq(facilitiesTable.id, facilityId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  res.json({
    court: {
      id: court.id,
      name: court.name,
      type: court.type,
      status: (court as any).status ?? "active",
      pricePerHour: Number(court.pricePerHour),
      facilityId: court.facilityId,
      isIndoor: court.isIndoor,
      imageUrl: court.imageUrl,
    },
    facility: (facilityRow as any[])[0] ?? null,
    monthlyRevenue: Math.max(0, Number(monthlyStats[0]?.grossRevenue ?? 0) - Number(monthlyStats[0]?.refundedTotal ?? 0)),
    monthlyGrossRevenue: Number(monthlyStats[0]?.grossRevenue ?? 0),
    monthlyRefundedTotal: Number(monthlyStats[0]?.refundedTotal ?? 0),
    monthlyNetRevenue: Math.max(0, Number(monthlyStats[0]?.grossRevenue ?? 0) - Number(monthlyStats[0]?.refundedTotal ?? 0)),
    monthlyBookingCount: Number(monthlyStats[0]?.bookingCount ?? 0),
    todayBookings: todayBookings.map(b => ({ ...b, totalPrice: Number(b.totalPrice) })),
    weeklyBookings: weeklyBookings.map(b => ({ ...b, totalPrice: Number(b.totalPrice) })),
    recentBookings: recentBookings.map(b => ({
      ...b,
      totalPrice: Number(b.totalPrice),
      refundAmount: b.refundAmount != null ? Number(b.refundAmount) : 0,
    })),
  });
});

export default router;
