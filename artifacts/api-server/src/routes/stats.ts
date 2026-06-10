import { Router, type IRouter } from "express";
import { db, courtsTable, bookingsTable, facilitiesTable, courtPricingTable } from "@workspace/db";
import { sql, eq, desc, inArray, and, gte, lte } from "drizzle-orm";
import {
  GetStatsSummaryResponse,
  GetPopularCourtsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  // Two parallel queries instead of seven sequential ones:
  //   1. Court counts — conditional aggregation collapses 4 queries into 1.
  //   2. Booking counts + revenue — conditional aggregation collapses 3 queries into 1.
  const [[courtRow], [bookingRow]] = await Promise.all([
    db.select({
      total:      sql<number>`count(*)`,
      tennis:     sql<number>`count(*) filter (where ${courtsTable.type} = 'tennis')`,
      basketball: sql<number>`count(*) filter (where ${courtsTable.type} = 'basketball')`,
      padel:      sql<number>`count(*) filter (where ${courtsTable.type} = 'padel')`,
    }).from(courtsTable),
    db.select({
      total:     sql<number>`count(*)`,
      confirmed: sql<number>`count(*) filter (where ${bookingsTable.status} = 'confirmed')`,
      revenue:   sql<number>`coalesce(sum(case when ${bookingsTable.status} = 'confirmed' then total_price::numeric else 0 end), 0)`,
    }).from(bookingsTable),
  ]);

  res.json(GetStatsSummaryResponse.parse({
    totalCourts:      Number(courtRow?.total      ?? 0),
    tennisCourts:     Number(courtRow?.tennis     ?? 0),
    basketballCourts: Number(courtRow?.basketball ?? 0),
    padelCourts:      Number(courtRow?.padel      ?? 0),
    totalBookings:    Number(bookingRow?.total     ?? 0),
    confirmedBookings:Number(bookingRow?.confirmed ?? 0),
    totalRevenue:     Number(bookingRow?.revenue   ?? 0),
  }));
});

router.get("/stats/popular-courts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: courtsTable.id,
      name: courtsTable.name,
      type: courtsTable.type,
      facilityId: courtsTable.facilityId,
      city: facilitiesTable.city,
      address: facilitiesTable.address,
      imageUrl: courtsTable.imageUrl,
      pricePerHour: courtsTable.pricePerHour,
      isIndoor: courtsTable.isIndoor,
      condition: courtsTable.condition,
      rating: courtsTable.rating,
      bookingCount: sql<number>`count(${bookingsTable.id})`,
      revenue: sql<number>`coalesce(sum(${bookingsTable.totalPrice}::numeric), 0)`,
    })
    .from(courtsTable)
    .innerJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .leftJoin(bookingsTable, eq(courtsTable.id, bookingsTable.courtId))
    .groupBy(
      courtsTable.id,
      courtsTable.name,
      courtsTable.type,
      courtsTable.facilityId,
      facilitiesTable.city,
      facilitiesTable.address,
      courtsTable.imageUrl,
      courtsTable.pricePerHour,
      courtsTable.isIndoor,
      courtsTable.condition,
      courtsTable.rating,
    )
    .orderBy(desc(sql`count(${bookingsTable.id})`))
    .limit(6);

  // Compute minDisplayPrice for each popular court (same bait-and-switch guard: 06:00–23:00 only)
  const courtIds = rows.map(r => r.id);
  const pricingMinMap = new Map<number, number>();
  if (courtIds.length > 0) {
    const pricingRows = await db
      .select({ courtId: courtPricingTable.courtId, price: courtPricingTable.price })
      .from(courtPricingTable)
      .where(and(
        inArray(courtPricingTable.courtId, courtIds),
        gte(courtPricingTable.startTime, "06:00"),
        lte(courtPricingTable.startTime, "23:00"),
      ));
    for (const entry of pricingRows) {
      const hourly = Number(entry.price) * 2;
      const prev = pricingMinMap.get(entry.courtId);
      if (prev === undefined || hourly < prev) pricingMinMap.set(entry.courtId, hourly);
    }
  }

  const popular = GetPopularCourtsResponse.parse(rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    city: r.city,
    address: r.address,
    imageUrl: r.imageUrl ?? undefined,
    pricePerHour: Number(r.pricePerHour),
    minDisplayPrice: pricingMinMap.get(r.id) ?? Number(r.pricePerHour),
    isIndoor: r.isIndoor,
    condition: r.condition ?? "good",
    bookingCount: Number(r.bookingCount),
    revenue: Number(r.revenue),
    rating: r.rating ? Number(r.rating) : undefined,
  })));
  // facilityId rides outside the OpenAPI schema (parse would strip it) so the
  // home page can deep-link to the facility+sport group page.
  res.json(popular.map((p, i) => ({ ...p, facilityId: rows[i].facilityId })));
});

export default router;
