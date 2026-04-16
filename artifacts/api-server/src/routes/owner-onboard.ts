import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, facilitiesTable, userRolesTable, courtsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, getUserRole } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const OnboardStep1Body = z.object({
  companyName: z.string().min(2),
  registrationCode: z.string().min(2),
  address: z.string().min(2),
  city: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const OnboardStep2Body = z.object({
  facilityId: z.number(),
  verificationDocUrl: z.string().min(1),
});

const OnboardStep3Body = z.object({
  facilityId: z.number(),
  name: z.string().min(2),
  description: z.string().optional(),
  photos: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
});

const VALID_SPORT_TYPES = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];

const OnboardStep4Court = z.object({
  name: z.string().min(2),
  type: z.string().refine(v => VALID_SPORT_TYPES.includes(v), { message: "Invalid sport type" }),
  surface: z.string().optional(),
  pricePerHour: z.string().refine(v => { const n = parseFloat(v); return !isNaN(n) && n > 0; }, { message: "Price must be a positive number" }),
  isIndoor: z.boolean().optional(),
  maxPlayers: z.number().min(1).max(100).optional(),
  amenities: z.array(z.string()).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const OnboardStep4Body = z.object({
  facilityId: z.number(),
  courts: z.array(OnboardStep4Court).min(1),
});

router.get("/owner/onboard/status", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const role = await getUserRole(userId);
  const [facility] = await db
    .select()
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, userId))
    .limit(1);

  const courts = facility
    ? await db.select({ id: courtsTable.id }).from(courtsTable).where(eq(courtsTable.facilityId, facility.id))
    : [];

  let step = 1;
  if (facility && facility.companyName && facility.registrationCode) {
    step = 2;
    if (facility.verificationDocUrl) step = 3;
    if (facility.name && facility.name !== facility.companyName) step = 4;
    if (courts.length > 0) step = 5;
  }

  res.json({
    role,
    isOwner: role === "owner" || role === "admin",
    facility: facility ?? null,
    courtCount: courts.length,
    currentStep: step,
    completed: step >= 5,
  });
});

router.post("/owner/onboard/step1", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = OnboardStep1Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db
    .select()
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, userId))
    .limit(1);

  let facility;
  if (existing.length > 0) {
    [facility] = await db
      .update(facilitiesTable)
      .set({
        companyName: parsed.data.companyName,
        registrationCode: parsed.data.registrationCode,
        address: parsed.data.address,
        city: parsed.data.city,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
      })
      .where(eq(facilitiesTable.id, existing[0].id))
      .returning();
  } else {
    [facility] = await db
      .insert(facilitiesTable)
      .values({
        name: parsed.data.companyName,
        ownerUserId: userId,
        companyName: parsed.data.companyName,
        registrationCode: parsed.data.registrationCode,
        address: parsed.data.address,
        city: parsed.data.city,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
      })
      .returning();
  }

  res.json(facility);
});

router.post("/owner/onboard/step2", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = OnboardStep2Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, parsed.data.facilityId));
  if (!existing || existing.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!existing.companyName || !existing.registrationCode) {
    res.status(400).json({ error: "Complete step 1 first" }); return;
  }

  const [facility] = await db
    .update(facilitiesTable)
    .set({ verificationDocUrl: parsed.data.verificationDocUrl, verificationStatus: "pending" })
    .where(eq(facilitiesTable.id, parsed.data.facilityId))
    .returning();

  res.json(facility);
});

router.post("/owner/onboard/step3", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = OnboardStep3Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, parsed.data.facilityId));
  if (!existing || existing.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!existing.verificationDocUrl) {
    res.status(400).json({ error: "Complete step 2 first" }); return;
  }

  const [facility] = await db
    .update(facilitiesTable)
    .set({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      photos: parsed.data.photos ?? [],
      equipment: parsed.data.equipment ?? [],
    })
    .where(eq(facilitiesTable.id, parsed.data.facilityId))
    .returning();

  res.json(facility);
});

router.post("/owner/onboard/step4", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = OnboardStep4Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, parsed.data.facilityId));
  if (!facility || facility.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!facility.name || facility.name === facility.companyName) {
    res.status(400).json({ error: "Complete step 3 first" }); return;
  }

  const createdCourts = [];
  for (const court of parsed.data.courts) {
    const [created] = await db
      .insert(courtsTable)
      .values({
        name: court.name,
        type: court.type,
        surface: court.surface ?? null,
        pricePerHour: court.pricePerHour,
        isIndoor: court.isIndoor ?? false,
        maxPlayers: court.maxPlayers ?? 4,
        amenities: court.amenities ?? [],
        address: court.address ?? facility.address ?? "",
        city: court.city ?? facility.city ?? "",
        latitude: court.latitude ?? 54.6872,
        longitude: court.longitude ?? 25.2797,
        ownerName: facility.companyName ?? facility.name,
        ownerEmail: facility.email ?? "",
        ownerUserId: userId,
        facilityId: facility.id,
        status: "pending",
      })
      .returning();
    createdCourts.push(created);
  }

  await db
    .insert(userRolesTable)
    .values({ userId, role: "owner" })
    .onConflictDoUpdate({
      target: userRolesTable.userId,
      set: { role: "owner", updatedAt: new Date() },
    });

  res.json({ facility, courts: createdCourts });
});

export default router;
