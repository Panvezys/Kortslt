import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, courtsTable, bookingsTable } from "@workspace/db";
import {
  ListCourtsQueryParams,
  CreateCourtBody,
  GetCourtParams,
  GetCourtResponse,
  UpdateCourtBody,
  UpdateCourtParams,
  UpdateCourtResponse,
  DeleteCourtParams,
  GetCourtAvailabilityParams,
  GetCourtAvailabilityQueryParams,
  GetCourtAvailabilityResponse,
  ListCourtsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatCourt(c: typeof courtsTable.$inferSelect) {
  return {
    ...c,
    pricePerHour: Number(c.pricePerHour),
    imageUrl: c.imageUrl ?? undefined,
    rating: c.rating ?? undefined,
    surface: c.surface ?? undefined,
    condition: (c.condition ?? "good") as "excellent" | "good" | "fair",
  };
}

router.get("/courts/cities", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ city: courtsTable.city })
    .from(courtsTable)
    .orderBy(courtsTable.city);
  res.json(rows.map(r => r.city));
});

router.get("/courts", async (req, res): Promise<void> => {
  const params = ListCourtsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.type) {
    conditions.push(eq(courtsTable.type, params.data.type));
  }
  if (params.data.city) {
    conditions.push(eq(courtsTable.city, params.data.city));
  }
  if (params.data.surface) {
    conditions.push(eq(courtsTable.surface, params.data.surface));
  }
  if (params.data.condition) {
    conditions.push(eq(courtsTable.condition, params.data.condition));
  }
  if (params.data.isIndoor != null) {
    conditions.push(eq(courtsTable.isIndoor, params.data.isIndoor));
  }
  if (params.data.minPrice != null) {
    conditions.push(gte(courtsTable.pricePerHour, String(params.data.minPrice)));
  }
  if (params.data.maxPrice != null) {
    conditions.push(lte(courtsTable.pricePerHour, String(params.data.maxPrice)));
  }

  let query = db.select().from(courtsTable).$dynamic();
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const courts = await query;
  res.json(ListCourtsResponse.parse(courts.map(formatCourt)));
});

router.post("/courts", async (req, res): Promise<void> => {
  const parsed = CreateCourtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [court] = await db.insert(courtsTable).values({
    ...parsed.data,
    pricePerHour: String(parsed.data.pricePerHour),
    amenities: parsed.data.amenities ?? [],
    isIndoor: parsed.data.isIndoor ?? false,
    maxPlayers: parsed.data.maxPlayers ?? 4,
    condition: (parsed.data.condition ?? "good") as string,
  }).returning();

  res.status(201).json(GetCourtResponse.parse(formatCourt(court)));
});

router.get("/courts/:id", async (req, res): Promise<void> => {
  const params = GetCourtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, params.data.id));

  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  res.json(GetCourtResponse.parse(formatCourt(court)));
});

router.put("/courts/:id", async (req, res): Promise<void> => {
  const params = UpdateCourtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateCourtBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [court] = await db
    .update(courtsTable)
    .set({
      ...body.data,
      pricePerHour: String(body.data.pricePerHour),
      amenities: body.data.amenities ?? [],
      condition: (body.data.condition ?? "good") as string,
    })
    .where(eq(courtsTable.id, params.data.id))
    .returning();

  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  res.json(UpdateCourtResponse.parse(formatCourt(court)));
});

router.delete("/courts/:id", async (req, res): Promise<void> => {
  const params = DeleteCourtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [court] = await db.delete(courtsTable).where(eq(courtsTable.id, params.data.id)).returning();

  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/courts/:id/availability", async (req, res): Promise<void> => {
  const params = GetCourtAvailabilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetCourtAvailabilityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { date } = query.data;

  const existingBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.courtId, params.data.id),
        eq(bookingsTable.date, date),
        eq(bookingsTable.status, "confirmed")
      )
    );

  const allSlots = [];
  for (let hour = 7; hour < 22; hour++) {
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
    const isBooked = existingBookings.some(
      b => b.startTime <= startTime && b.endTime > startTime
    );
    allSlots.push({ startTime, endTime, isAvailable: !isBooked });
  }

  res.json(GetCourtAvailabilityResponse.parse({
    courtId: params.data.id,
    date,
    slots: allSlots,
  }));
});

export default router;
