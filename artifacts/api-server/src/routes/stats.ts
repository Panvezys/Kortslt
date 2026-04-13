import { Router, type IRouter } from "express";
import { db, courtsTable, bookingsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import {
  GetStatsSummaryResponse,
  GetPopularCourtsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [totalCourtsRow] = await db.select({ count: sql<number>`count(*)` }).from(courtsTable);
  const [tennisCourtsRow] = await db.select({ count: sql<number>`count(*)` }).from(courtsTable).where(eq(courtsTable.type, "tennis"));
  const [basketballCourtsRow] = await db.select({ count: sql<number>`count(*)` }).from(courtsTable).where(eq(courtsTable.type, "basketball"));
  const [totalBookingsRow] = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable);
  const [confirmedBookingsRow] = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable).where(eq(bookingsTable.status, "confirmed"));
  const [revenueRow] = await db.select({ total: sql<number>`coalesce(sum(total_price::numeric), 0)` }).from(bookingsTable).where(eq(bookingsTable.status, "confirmed"));

  res.json(GetStatsSummaryResponse.parse({
    totalCourts: Number(totalCourtsRow?.count ?? 0),
    totalBookings: Number(totalBookingsRow?.count ?? 0),
    confirmedBookings: Number(confirmedBookingsRow?.count ?? 0),
    totalRevenue: Number(revenueRow?.total ?? 0),
    tennisCourts: Number(tennisCourtsRow?.count ?? 0),
    basketballCourts: Number(basketballCourtsRow?.count ?? 0),
  }));
});

router.get("/stats/popular-courts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: courtsTable.id,
      name: courtsTable.name,
      type: courtsTable.type,
      city: courtsTable.city,
      address: courtsTable.address,
      imageUrl: courtsTable.imageUrl,
      pricePerHour: courtsTable.pricePerHour,
      isIndoor: courtsTable.isIndoor,
      condition: courtsTable.condition,
      bookingCount: sql<number>`count(${bookingsTable.id})`,
      revenue: sql<number>`coalesce(sum(${bookingsTable.totalPrice}::numeric), 0)`,
    })
    .from(courtsTable)
    .leftJoin(bookingsTable, eq(courtsTable.id, bookingsTable.courtId))
    .groupBy(
      courtsTable.id,
      courtsTable.name,
      courtsTable.type,
      courtsTable.city,
      courtsTable.address,
      courtsTable.imageUrl,
      courtsTable.pricePerHour,
      courtsTable.isIndoor,
      courtsTable.condition,
    )
    .orderBy(desc(sql`count(${bookingsTable.id})`))
    .limit(6);

  res.json(GetPopularCourtsResponse.parse(rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    city: r.city,
    address: r.address,
    imageUrl: r.imageUrl ?? undefined,
    pricePerHour: Number(r.pricePerHour),
    isIndoor: r.isIndoor,
    condition: r.condition ?? "good",
    bookingCount: Number(r.bookingCount),
    revenue: Number(r.revenue),
  }))));
});

export default router;
