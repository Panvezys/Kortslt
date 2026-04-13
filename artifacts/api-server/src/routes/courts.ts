import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
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

router.get("/courts", async (req, res): Promise<void> => {
  const params = ListCourtsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(courtsTable).$dynamic();
  const conditions = [];
  if (params.data.type) {
    conditions.push(eq(courtsTable.type, params.data.type));
  }
  if (params.data.minPrice != null) {
    conditions.push(gte(courtsTable.pricePerHour, String(params.data.minPrice)));
  }
  if (params.data.maxPrice != null) {
    conditions.push(lte(courtsTable.pricePerHour, String(params.data.maxPrice)));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const courts = await query;
  res.json(ListCourtsResponse.parse(courts.map(c => ({
    ...c,
    pricePerHour: Number(c.pricePerHour),
    rating: c.rating ?? undefined,
  }))));
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
  }).returning();

  res.status(201).json(GetCourtResponse.parse({ ...court, pricePerHour: Number(court.pricePerHour) }));
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

  res.json(GetCourtResponse.parse({ ...court, pricePerHour: Number(court.pricePerHour) }));
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
    })
    .where(eq(courtsTable.id, params.data.id))
    .returning();

  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  res.json(UpdateCourtResponse.parse({ ...court, pricePerHour: Number(court.pricePerHour) }));
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
