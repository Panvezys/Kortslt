import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, or, sql } from "drizzle-orm";
import { db, courtsTable, bookingsTable, courtPricingTable, courtBlockedSlotsTable, facilitiesTable, courtPhotosTable, gamesTable } from "@workspace/db";
import { asc } from "drizzle-orm";
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
import { requireAuth, requireAdmin, isOwner, getCurrentUserId, getUserRole } from "../lib/auth";
import { sendAdminNotification } from "../lib/notify";

const router: IRouter = Router();

function formatCourt(c: typeof courtsTable.$inferSelect) {
  return {
    ...c,
    pricePerHour: Number(c.pricePerHour),
    peakPricePerHour: c.peakPricePerHour != null ? Number(c.peakPricePerHour) : undefined,
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
    instantBookingEnabled: c.instantBookingEnabled ?? true,
  };
}

/** Restricted view for unauthenticated / public callers.
 *  Sensitive internal and owner-identifying fields are intentionally omitted. */
function formatPublicCourt(c: typeof courtsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description ?? undefined,
    address: c.address,
    city: c.city,
    postcode: c.postcode ?? undefined,
    latitude: c.latitude,
    longitude: c.longitude,
    pricePerHour: Number(c.pricePerHour),
    peakPricePerHour: c.peakPricePerHour != null ? Number(c.peakPricePerHour) : undefined,
    rentableItems: c.rentableItems ?? undefined,
    imageUrl: c.imageUrl ?? undefined,
    ownerName: c.ownerName,
    amenities: c.amenities,
    isIndoor: c.isIndoor,
    maxPlayers: c.maxPlayers,
    surface: c.surface ?? undefined,
    condition: (c.condition ?? "good") as "excellent" | "very_good" | "good" | "fair",
    rating: c.rating ?? undefined,
    totalBookings: c.totalBookings,
    phone: c.phone ?? undefined,
    openingHours: c.openingHours ?? undefined,
    socialFacebook: c.socialFacebook ?? undefined,
    socialInstagram: c.socialInstagram ?? undefined,
    socialWhatsapp: c.socialWhatsapp ?? undefined,
    socialWebsite: c.socialWebsite ?? undefined,
    instantBookingEnabled: c.instantBookingEnabled ?? true,
    facilityId: c.facilityId ?? undefined,
    workingHours: c.workingHours ?? undefined,
    amenityPhotos: c.amenityPhotos ?? undefined,
    createdAt: c.createdAt,
  };
}

/** Returns true if the given time slot (HH:MM) falls in peak hours: Mon–Fri 17:00–22:00 */
function isPeakSlot(startTime: string, dayOfWeek: number): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // weekend
  const [h] = startTime.split(":").map(Number);
  return h >= 17 && h < 22;
}

/** Parse "HH:MM" → total minutes */
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Format total minutes → "HH:MM" */
function minToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Generate 30-min slots between openTime and closeTime (default: 07:00–22:00).
 *  The last slot ends at closeTime, so a slot starting at closeTime is excluded.
 *  E.g. open="08:00", close="22:00" produces 08:00–08:30, …, 21:30–22:00
 */
function generateSlots(openTime = "07:00", closeTime = "22:00"): { startTime: string; endTime: string }[] {
  const openMin = timeToMin(openTime);
  const closeMin = timeToMin(closeTime);
  const slots = [];
  for (let m = openMin; m + 30 <= closeMin; m += 30) {
    slots.push({ startTime: minToTime(m), endTime: minToTime(m + 30) });
  }
  return slots;
}

const PUBLIC_STATUSES = ["approved", "active"] as const;

router.get("/courts/cities", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ city: courtsTable.city })
    .from(courtsTable)
    .where(or(eq(courtsTable.status, "approved"), eq(courtsTable.status, "active")))
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

  // If ownerUserId filter is supplied, this is an owner dashboard request.
  // Require the caller to be authenticated as that owner (or an admin).
  if (params.data.ownerUserId) {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const role = await getUserRole(userId);
    if (role !== "admin" && userId !== params.data.ownerUserId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    conditions.push(eq(courtsTable.ownerUserId, params.data.ownerUserId));
  } else {
    // Public callers only see active/approved courts.
    conditions.push(inArray(courtsTable.status, ["approved", "active"]));
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

    const courtIds = filtered.map(r => r.court.id);
    const photoMap = new Map<number, string[]>();
    if (courtIds.length > 0) {
      const photos = await db
        .select({ courtId: courtPhotosTable.courtId, url: courtPhotosTable.url })
        .from(courtPhotosTable)
        .where(inArray(courtPhotosTable.courtId, courtIds))
        .orderBy(asc(courtPhotosTable.displayOrder), asc(courtPhotosTable.createdAt));
      for (const p of photos) {
        const arr = photoMap.get(p.courtId) ?? [];
        if (arr.length < 3) arr.push(p.url);
        photoMap.set(p.courtId, arr);
      }
    }

    res.json(filtered.map(r => ({
      ...formatPublicCourt(r.court),
      facilityVerified: r.facilityStatus === "verified",
      photos: photoMap.get(r.court.id) ?? [],
    })));
    return;
  }

  // Authenticated owner/admin view — return full court data including internal fields.
  let query = db.select().from(courtsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));

  const courts = await query;
  const courtIds = courts.map(c => c.id);
  const photoMap = new Map<number, string[]>();
  if (courtIds.length > 0) {
    const photos = await db
      .select({ courtId: courtPhotosTable.courtId, url: courtPhotosTable.url })
      .from(courtPhotosTable)
      .where(inArray(courtPhotosTable.courtId, courtIds))
      .orderBy(asc(courtPhotosTable.displayOrder), asc(courtPhotosTable.createdAt));
    for (const p of photos) {
      const arr = photoMap.get(p.courtId) ?? [];
      if (arr.length < 3) arr.push(p.url);
      photoMap.set(p.courtId, arr);
    }
  }
  res.json(courts.map(c => ({ ...formatCourt(c), photos: photoMap.get(c.id) ?? [] })));
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
      rentableItems: parsed.data.rentableItems ?? null,
      amenities: parsed.data.amenities ?? [],
      condition: (parsed.data.condition ?? "good") as string,
      ownerUserId: userId,
      status: "draft",
      instantBookingEnabled: true,
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

  const isPublic = court.status === "approved" || court.status === "active";

  if (!isPublic) {
    // Non-public courts are only visible to the owner or an admin.
    if (!(await isOwner(req, court.ownerUserId))) {
      res.status(404).json({ error: "Court not found" });
      return;
    }
    // Authenticated owner/admin gets full internal data validated against the schema.
    res.json(GetCourtResponse.parse(formatCourt(court)));
    return;
  }

  // Public court — return the restricted public view (no Zod parse to avoid
  // requiring internal fields like ownerEmail that are intentionally excluded).
  res.json(formatPublicCourt(court));
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
  if (!(await isOwner(req, existing.ownerUserId))) {
    res.status(403).json({ error: "Forbidden – you do not own this court" });
    return;
  }

  // Preserve extra owner-settable fields that aren't in the Zod schema
  const extraFields: Record<string, unknown> = {};
  if (typeof (req.body as any).instantBookingEnabled === "boolean") {
    extraFields.instantBookingEnabled = (req.body as any).instantBookingEnabled;
  }

  // Explicitly destructure body.data to guarantee ownerUserId is never
  // written — even if the schema or client ever adds it in the future.
  // The original court owner must always remain the owner.
  const { ...safeFields } = body.data as any;
  delete safeFields.ownerUserId;

  const [court] = await db
    .update(courtsTable)
    .set({
      ...safeFields,
      ...extraFields,
      pricePerHour: String(body.data.pricePerHour),
      peakPricePerHour: body.data.peakPricePerHour != null ? String(body.data.peakPricePerHour) : null,
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
  if (!(await isOwner(req, existing.ownerUserId))) {
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
          or(
            eq(bookingsTable.status, "confirmed"),
            eq(bookingsTable.status, "blocked"),
            and(
              eq(bookingsTable.status, "pending"),
              sql`${bookingsTable.createdAt} > NOW() - INTERVAL '10 minutes'`
            )
          )
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

  // ── Parse working hours for this day ────────────────────────────────────────
  let openTime = "07:00";
  let closeTime = "22:00";
  let courtClosed = false;

  if (court.workingHours) {
    try {
      const wh = JSON.parse(court.workingHours) as Record<string, { open: string; close: string; closed: boolean }>;
      const dayConfig = wh[String(dayOfWeek)];
      if (dayConfig) {
        if (dayConfig.closed) {
          courtClosed = true;
        } else {
          openTime = dayConfig.open ?? "07:00";
          closeTime = dayConfig.close ?? "22:00";
        }
      }
    } catch {
      // malformed JSON — fall back to defaults
    }
  }

  if (courtClosed) {
    res.json(GetCourtAvailabilityResponse.parse({ courtId: params.data.id, date, slots: [] }));
    return;
  }

  const pricingMap = new Map(pricingEntries.map(e => [e.startTime, Number(e.price)]));
  const defaultSlotPrice = Number(court.pricePerHour) / 2;
  const peakSlotPrice = court.peakPricePerHour != null ? Number(court.peakPricePerHour) / 2 : null;

  const allSlots = generateSlots(openTime, closeTime).map(({ startTime, endTime }) => {
    const isBooked = existingBookings.some(
      b => b.startTime <= startTime && b.endTime > startTime
    );
    const isBlocked = blockedSlots.some(
      b => b.startTime <= startTime && b.endTime > startTime
    );

    // Slot price: custom pricing > peak pricing > default
    let price: number;
    if (pricingMap.has(startTime)) {
      price = pricingMap.get(startTime)!;
    } else if (peakSlotPrice != null && isPeakSlot(startTime, dayOfWeek)) {
      price = peakSlotPrice;
    } else {
      price = defaultSlotPrice;
    }

    return { startTime, endTime, isAvailable: !isBooked && !isBlocked, price };
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

router.put("/courts/:id/pricing", requireAuth, async (req, res): Promise<void> => {
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

  const [existingCourt] = await db.select().from(courtsTable).where(eq(courtsTable.id, params.data.id));
  if (!existingCourt) {
    res.status(404).json({ error: "Court not found" });
    return;
  }
  if (!(await isOwner(req, existingCourt.ownerUserId))) {
    res.status(403).json({ error: "Forbidden – you do not own this court" });
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

// ─── Owner: submit court for review ──────────────────────────────────────────
router.post("/courts/:id/submit-review", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid courtId" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }
  if (!(await isOwner(req, court.ownerUserId ?? ""))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  // Validate required fields
  const missingFields: string[] = [];
  if (!court.pricePerHour || Number(court.pricePerHour) <= 0) missingFields.push("kaina");
  if (!court.address || !court.city) missingFields.push("vieta");
  if (missingFields.length > 0) {
    res.status(422).json({ error: `Trūksta privalomų laukų: ${missingFields.join(", ")}` }); return;
  }

  if (!["draft", "hidden"].includes(court.status)) {
    res.status(409).json({ error: `Aikštelė jau yra "${court.status}" būsenos` }); return;
  }

  const [updated] = await db
    .update(courtsTable)
    .set({ status: "pending_review", rejectionReason: null })
    .where(eq(courtsTable.id, courtId))
    .returning();

  await sendAdminNotification(
    "Nauja aikštelė laukia patvirtinimo",
    `„${court.name}" pateikta peržiūrai.`,
    "/admin/courts",
  );

  res.json(formatCourt(updated));
});

// ─── Admin/Owner: update court status ─────────────────────────────────────────
router.patch("/courts/:id/status", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid courtId" }); return; }

  const { status, rejectionReason } = req.body as { status?: string; rejectionReason?: string };
  const ALLOWED_ADMIN = ["draft", "pending_review", "active", "hidden", "approved"];
  const OWNER_TOGGLE = ["active", "hidden"];

  if (!status) { res.status(400).json({ error: "status required" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const userId = getCurrentUserId(req);
  const role = userId ? await getUserRole(userId) : null;
  const userIsAdmin = role === "admin";
  const userIsOwner = await isOwner(req, court.ownerUserId ?? "");

  if (userIsAdmin) {
    if (!ALLOWED_ADMIN.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${ALLOWED_ADMIN.join(", ")}` }); return;
    }
  } else if (userIsOwner) {
    if (!OWNER_TOGGLE.includes(status)) {
      res.status(403).json({ error: "Owners can only toggle between active and hidden" }); return;
    }
    if (!OWNER_TOGGLE.includes(court.status)) {
      res.status(409).json({ error: "Court must be active or hidden to use this toggle" }); return;
    }
  } else {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [updated] = await db
    .update(courtsTable)
    .set({ status, rejectionReason: userIsAdmin ? (rejectionReason ?? null) : court.rejectionReason })
    .where(eq(courtsTable.id, courtId))
    .returning();

  res.json(formatCourt(updated));
});

// ─── Admin: list courts pending review ───────────────────────────────────────
router.get("/admin/courts/pending", requireAdmin, async (_req, res): Promise<void> => {
  const courts = await db
    .select()
    .from(courtsTable)
    .where(inArray(courtsTable.status, ["pending", "pending_review"]))
    .orderBy(courtsTable.createdAt);

  const courtIds = courts.map(c => c.id);
  const photoMap = new Map<number, string[]>();
  if (courtIds.length > 0) {
    const photos = await db
      .select({ courtId: courtPhotosTable.courtId, url: courtPhotosTable.url })
      .from(courtPhotosTable)
      .where(inArray(courtPhotosTable.courtId, courtIds))
      .orderBy(asc(courtPhotosTable.displayOrder), asc(courtPhotosTable.createdAt));
    for (const p of photos) {
      const arr = photoMap.get(p.courtId) ?? [];
      if (arr.length < 3) arr.push(p.url);
      photoMap.set(p.courtId, arr);
    }
  }

  res.json(courts.map(c => ({ ...formatCourt(c), photos: photoMap.get(c.id) ?? [] })));
});

router.get("/courts/:id/activity", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [lastBooking] = await db
    .select({ startTime: bookingsTable.startTime })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.courtId, id), eq(bookingsTable.status, "confirmed")))
    .orderBy(asc(bookingsTable.startTime))
    .limit(1);

  const todayGames = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(and(
      eq(gamesTable.courtId, id),
      gte(gamesTable.datetime, todayStart),
      lte(gamesTable.datetime, todayEnd),
    ));

  res.json({
    lastBookedAt: lastBooking?.startTime ?? null,
    todayGameCount: todayGames.length,
  });
});

export default router;
