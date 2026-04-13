import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, courtsTable, bookingsTable, courtPricingTable } from "@workspace/db";
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
  GetCourtPricingParams,
  GetCourtPricingResponse,
  SetCourtPricingParams,
  SetCourtPricingBody,
  SetCourtPricingResponse,
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
    phone: c.phone ?? undefined,
    openingHours: c.openingHours ?? undefined,
  };
}

/** Generate all 30-min slots for a day: 07:00 – 21:30 (inclusive, ends 22:00) */
function generateSlots(): { startTime: string; endTime: string }[] {
  const slots = [];
  for (let h = 7; h < 22; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break; // last slot is 21:30-22:00
      const start = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const endH = m === 30 ? h + 1 : h;
      const endM = m === 30 ? 0 : 30;
      const end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
      slots.push({ startTime: start, endTime: end });
    }
  }
  return slots;
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
  if (params.data.type) conditions.push(eq(courtsTable.type, params.data.type));
  if (params.data.city) conditions.push(eq(courtsTable.city, params.data.city));
  if (params.data.surface) conditions.push(eq(courtsTable.surface, params.data.surface));
  if (params.data.condition) conditions.push(eq(courtsTable.condition, params.data.condition));
  if (params.data.isIndoor != null) conditions.push(eq(courtsTable.isIndoor, params.data.isIndoor));
  if (params.data.minPrice != null) conditions.push(gte(courtsTable.pricePerHour, String(params.data.minPrice)));
  if (params.data.maxPrice != null) conditions.push(lte(courtsTable.pricePerHour, String(params.data.maxPrice)));

  let query = db.select().from(courtsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));

  const courts = await query;
  res.json(ListCourtsResponse.parse(courts.map(formatCourt)));
});

router.post("/courts", async (req, res): Promise<void> => {
  const parsed = CreateCourtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [court] = await db
    .insert(courtsTable)
    .values({
      ...parsed.data,
      pricePerHour: String(parsed.data.pricePerHour),
      amenities: parsed.data.amenities ?? [],
      condition: (parsed.data.condition ?? "good") as string,
    })
    .returning();

  res.status(201).json(formatCourt(court));
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

  // Get court for default price
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, params.data.id));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  // Day of week for pricing lookup (JS: 0=Sun)
  const dayOfWeek = new Date(date + "T00:00:00").getDay();

  // Load pricing entries for this court + day
  const pricingEntries = await db
    .select()
    .from(courtPricingTable)
    .where(
      and(
        eq(courtPricingTable.courtId, params.data.id),
        eq(courtPricingTable.dayOfWeek, dayOfWeek)
      )
    );

  const pricingMap = new Map(pricingEntries.map(e => [e.startTime, Number(e.price)]));
  const defaultSlotPrice = Number(court.pricePerHour) / 2;

  // Get confirmed bookings for this date
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

  const allSlots = generateSlots().map(({ startTime, endTime }) => {
    const isBooked = existingBookings.some(
      b => b.startTime <= startTime && b.endTime > startTime
    );
    const price = pricingMap.has(startTime) ? pricingMap.get(startTime)! : defaultSlotPrice;
    return { startTime, endTime, isAvailable: !isBooked, price };
  });

  res.json(GetCourtAvailabilityResponse.parse({
    courtId: params.data.id,
    date,
    slots: allSlots,
  }));
});

// GET /courts/:id/pricing
router.get("/courts/:id/pricing", async (req, res): Promise<void> => {
  const params = GetCourtPricingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const entries = await db
    .select()
    .from(courtPricingTable)
    .where(eq(courtPricingTable.courtId, params.data.id));

  res.json(GetCourtPricingResponse.parse({
    courtId: params.data.id,
    entries: entries.map(e => ({
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      price: Number(e.price),
    })),
  }));
});

// PUT /courts/:id/pricing — replaces all pricing for this court
router.put("/courts/:id/pricing", async (req, res): Promise<void> => {
  const params = SetCourtPricingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SetCourtPricingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Delete all existing pricing for this court
  await db.delete(courtPricingTable).where(eq(courtPricingTable.courtId, params.data.id));

  // Insert new entries (if any)
  if (body.data.entries.length > 0) {
    await db.insert(courtPricingTable).values(
      body.data.entries.map(e => ({
        courtId: params.data.id,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        price: String(e.price),
      }))
    );
  }

  const entries = await db
    .select()
    .from(courtPricingTable)
    .where(eq(courtPricingTable.courtId, params.data.id));

  res.json(SetCourtPricingResponse.parse({
    courtId: params.data.id,
    entries: entries.map(e => ({
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      price: Number(e.price),
    })),
  }));
});

export default router;
