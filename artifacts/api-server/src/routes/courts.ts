import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, courtsTable, bookingsTable, courtPricingTable, courtBlockedSlotsTable, facilitiesTable } from "@workspace/db";
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
import { requireAuth, isOwner, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

function formatCourt(c: typeof courtsTable.$inferSelect) {
  return {
    ...c,
    pricePerHour: Number(c.pricePerHour),
    peakPricePerHour: c.peakPricePerHour != null ? Number(c.peakPricePerHour) : undefined,
    bufferMinutes: c.bufferMinutes ?? 0,
    rentableItems: c.rentableItems ?? undefined,
    description: c.description ?? undefined,
    imageUrl: c.imageUrl ?? undefined,
    rating: c.rating ?? undefined,
    surface: c.surface ?? undefined,
    condition: (c.condition ?? "good") as "excellent" | "very_good" | "good" | "fair",
    phone: c.phone ?? undefined,
    openingHours: c.openingHours ?? undefined,
    ownerUserId: c.ownerUserId ?? undefined,
    ownershipDocUrl: c.ownershipDocUrl ?? undefined,
    rejectionReason: c.rejectionReason ?? undefined,
    postcode: c.postcode ?? undefined,
    socialFacebook: c.socialFacebook ?? undefined,
    socialInstagram: c.socialInstagram ?? undefined,
    socialWhatsapp: c.socialWhatsapp ?? undefined,
    socialWebsite: c.socialWebsite ?? undefined,
    facilityId: c.facilityId ?? undefined,
    workingHours: c.workingHours ?? undefined,
    amenityPhotos: c.amenityPhotos ?? undefined,
  };
}

/** Returns true if the given time slot (HH:MM) falls in peak hours: Mon–Fri 17:00–22:00 */
function isPeakSlot(startTime: string, dayOfWeek: number): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // weekend
  const [h] = startTime.split(":").map(Number);
  return h >= 17 && h < 22;
}

/** Generate all 30-min slots for a day: 07:00 – 21:30 */
function generateSlots(): { startTime: string; endTime: string }[] {
  const slots = [];
  for (let h = 7; h < 22; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break;
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
    .where(eq(courtsTable.status, "approved"))
    .orderBy(courtsTable.city);
  res.json(rows.map(r => r.city));
});

router.get("/courts", async (req, res): Promise<void> => {
  const params = ListCourtsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: ReturnType<typeof eq>[] = [];

  // If ownerUserId filter is supplied, return all statuses for that owner (their dashboard view).
  // Otherwise, public callers only see approved courts.
  if (params.data.ownerUserId) {
    conditions.push(eq(courtsTable.ownerUserId, params.data.ownerUserId));
  } else {
    conditions.push(eq(courtsTable.status, "approved"));
  }

  if (params.data.type) conditions.push(eq(courtsTable.type, params.data.type));
  if (params.data.city) conditions.push(eq(courtsTable.city, params.data.city));
  if (params.data.surface) conditions.push(eq(courtsTable.surface, params.data.surface));
  if (params.data.condition) conditions.push(eq(courtsTable.condition, params.data.condition));
  if (params.data.isIndoor != null) conditions.push(eq(courtsTable.isIndoor, params.data.isIndoor));
  if (params.data.minPrice != null) conditions.push(gte(courtsTable.pricePerHour, String(params.data.minPrice)));
  if (params.data.maxPrice != null) conditions.push(lte(courtsTable.pricePerHour, String(params.data.maxPrice)));
  if (params.data.ownerEmail) conditions.push(eq(courtsTable.ownerEmail, params.data.ownerEmail));

  // Public view: courts must belong to a verified facility (or have no facility).
  // Owner view (ownerUserId set) skips this filter so owners see their unverified courts.
  if (!params.data.ownerUserId) {
    // Join with facilities and only include courts from verified facilities (or legacy courts with no facilityId)
    const rows = await db
      .select({ court: courtsTable, facilityStatus: facilitiesTable.verificationStatus })
      .from(courtsTable)
      .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
      .where(and(...conditions));

    const filtered = rows.filter(r =>
      r.court.facilityId == null || r.facilityStatus === "verified"
    );
    res.json(filtered.map(r => ({
      ...formatCourt(r.court),
      facilityVerified: r.facilityStatus === "verified",
    })));
    return;
  }

  let query = db.select().from(courtsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));

  const courts = await query;
  res.json(courts.map(c => formatCourt(c)));
});

router.post("/courts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCourtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getCurrentUserId(req);

  let inheritedLocation: { address?: string; city?: string; latitude?: number; longitude?: number; postcode?: string } = {};
  if (parsed.data.facilityId) {
    const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, parsed.data.facilityId));
    if (facility) {
      inheritedLocation = {
        address: facility.address ?? parsed.data.address,
        city: facility.city ?? parsed.data.city,
        latitude: facility.latitude ?? parsed.data.latitude,
        longitude: facility.longitude ?? parsed.data.longitude,
        postcode: facility.postcode ?? parsed.data.postcode,
      };
    }
  }

  const [court] = await db
    .insert(courtsTable)
    .values({
      ...parsed.data,
      ...inheritedLocation,
      pricePerHour: String(parsed.data.pricePerHour),
      peakPricePerHour: parsed.data.peakPricePerHour != null ? String(parsed.data.peakPricePerHour) : null,
      bufferMinutes: parsed.data.bufferMinutes ?? 0,
      rentableItems: parsed.data.rentableItems ?? null,
      amenities: parsed.data.amenities ?? [],
      condition: (parsed.data.condition ?? "good") as string,
      ownerUserId: userId,
      status: "pending",
      ownershipDocUrl: parsed.data.ownershipDocUrl ?? null,
      facilityId: parsed.data.facilityId ?? null,
      workingHours: parsed.data.workingHours ?? null,
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

router.put("/courts/:id", requireAuth, async (req, res): Promise<void> => {
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

  // Ownership check
  const [existing] = await db.select().from(courtsTable).where(eq(courtsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Court not found" });
    return;
  }
  if (existing.ownerUserId && !(await isOwner(req, existing.ownerUserId))) {
    res.status(403).json({ error: "Forbidden – you do not own this court" });
    return;
  }

  const [court] = await db
    .update(courtsTable)
    .set({
      ...body.data,
      pricePerHour: String(body.data.pricePerHour),
      peakPricePerHour: body.data.peakPricePerHour != null ? String(body.data.peakPricePerHour) : null,
      bufferMinutes: body.data.bufferMinutes ?? 0,
      rentableItems: body.data.rentableItems ?? null,
      amenities: body.data.amenities ?? [],
      condition: (body.data.condition ?? "good") as string,
      facilityId: body.data.facilityId ?? null,
      workingHours: body.data.workingHours ?? null,
      amenityPhotos: body.data.amenityPhotos ?? null,
    })
    .where(eq(courtsTable.id, params.data.id))
    .returning();

  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  res.json(UpdateCourtResponse.parse(formatCourt(court)));
});

router.delete("/courts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCourtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Ownership check
  const [existing] = await db.select().from(courtsTable).where(eq(courtsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Court not found" });
    return;
  }
  if (existing.ownerUserId && !(await isOwner(req, existing.ownerUserId))) {
    res.status(403).json({ error: "Forbidden – you do not own this court" });
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

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, params.data.id));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  const dayOfWeek = new Date(date + "T00:00:00").getDay();

  const [pricingEntries, existingBookings, blockedSlots] = await Promise.all([
    db
      .select()
      .from(courtPricingTable)
      .where(
        and(
          eq(courtPricingTable.courtId, params.data.id),
          eq(courtPricingTable.dayOfWeek, dayOfWeek)
        )
      ),
    db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.courtId, params.data.id),
          eq(bookingsTable.date, date),
          inArray(bookingsTable.status, ["confirmed", "pending"])
        )
      ),
    db
      .select()
      .from(courtBlockedSlotsTable)
      .where(
        and(
          eq(courtBlockedSlotsTable.courtId, params.data.id),
          eq(courtBlockedSlotsTable.date, date)
        )
      ),
  ]);

  const pricingMap = new Map(pricingEntries.map(e => [e.startTime, Number(e.price)]));
  const defaultSlotPrice = Number(court.pricePerHour) / 2;
  const peakSlotPrice = court.peakPricePerHour != null ? Number(court.peakPricePerHour) / 2 : null;
  const bufferMinutes = court.bufferMinutes ?? 0;
  const bufferSlots = Math.ceil(bufferMinutes / 30); // number of 30-min slots to block after a booking

  // Build a set of buffer-blocked start times
  const bufferBlockedTimes = new Set<string>();
  if (bufferSlots > 0) {
    const slotsArr = generateSlots();
    for (const booking of existingBookings) {
      const endIdx = slotsArr.findIndex(s => s.startTime === booking.endTime);
      if (endIdx >= 0) {
        for (let i = endIdx; i < Math.min(endIdx + bufferSlots, slotsArr.length); i++) {
          bufferBlockedTimes.add(slotsArr[i].startTime);
        }
      }
    }
  }

  const allSlots = generateSlots().map(({ startTime, endTime }) => {
    const isBooked = existingBookings.some(
      b => b.startTime <= startTime && b.endTime > startTime
    );
    const isBlocked = blockedSlots.some(
      b => b.startTime <= startTime && b.endTime > startTime
    );
    const isBuffer = bufferBlockedTimes.has(startTime);

    // Slot price: custom pricing > peak pricing > default
    let price: number;
    if (pricingMap.has(startTime)) {
      price = pricingMap.get(startTime)!;
    } else if (peakSlotPrice != null && isPeakSlot(startTime, dayOfWeek)) {
      price = peakSlotPrice;
    } else {
      price = defaultSlotPrice;
    }

    return { startTime, endTime, isAvailable: !isBooked && !isBlocked && !isBuffer, price };
  });

  res.json(GetCourtAvailabilityResponse.parse({
    courtId: params.data.id,
    date,
    slots: allSlots,
  }));
});

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

  await db.delete(courtPricingTable).where(eq(courtPricingTable.courtId, params.data.id));

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

// GET /courts/:id/equipment-availability?date=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM
router.get("/courts/:id/equipment-availability", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  const { date, startTime, endTime } = req.query as Record<string, string>;
  if (!courtId || !date || !startTime || !endTime) {
    res.status(400).json({ error: "courtId, date, startTime, endTime required" });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const equipment: Array<{ name: string; pricePerSlot: number; stock: number }> =
    court.rentableItems ? JSON.parse(court.rentableItems) : [];

  if (equipment.length === 0) { res.json([]); return; }

  // Find overlapping confirmed/pending bookings with rented items
  const existingBookings = await db
    .select({ rentedItems: bookingsTable.rentedItems, startTime: bookingsTable.startTime, endTime: bookingsTable.endTime })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.courtId, courtId), eq(bookingsTable.date, date)));

  // Parse startTime/endTime to minutes for overlap check
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const reqStart = toMin(startTime);
  const reqEnd = toMin(endTime);

  // Sum up booked quantities for overlapping bookings
  const bookedQty: Record<string, number> = {};
  for (const b of existingBookings) {
    if (!b.rentedItems) continue;
    const bStart = toMin(b.startTime);
    const bEnd = toMin(b.endTime);
    // Overlap: not (bEnd <= reqStart || bStart >= reqEnd)
    if (bEnd <= reqStart || bStart >= reqEnd) continue;
    try {
      const items: Array<{ name: string; quantity: number }> = JSON.parse(b.rentedItems);
      for (const item of items) {
        bookedQty[item.name] = (bookedQty[item.name] ?? 0) + item.quantity;
      }
    } catch {}
  }

  const result = equipment.map(e => ({
    name: e.name,
    pricePerSlot: e.pricePerSlot,
    stock: e.stock,
    booked: bookedQty[e.name] ?? 0,
    available: Math.max(0, e.stock - (bookedQty[e.name] ?? 0)),
  }));

  res.json(result);
});

export default router;
