import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, coachesTable, courtCoachesTable, courtsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner } from "../lib/auth";

const router: IRouter = Router();

function formatCoach(c: typeof coachesTable.$inferSelect) {
  return {
    ...c,
    pricePerHour: c.pricePerHour != null ? Number(c.pricePerHour) : undefined,
    bio: c.bio ?? undefined,
    photoUrl: c.photoUrl ?? undefined,
    videoUrl: c.videoUrl ?? undefined,
    availabilityDescription: c.availabilityDescription ?? undefined,
    phone: c.phone ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

// GET /coaches — list all coaches, or filter by courtId
router.get("/coaches", async (req, res): Promise<void> => {
  const courtId = req.query.courtId ? parseInt(req.query.courtId as string, 10) : null;

  if (courtId !== null && !isNaN(courtId)) {
    const rows = await db
      .select({ coach: coachesTable })
      .from(courtCoachesTable)
      .innerJoin(coachesTable, eq(courtCoachesTable.coachId, coachesTable.id))
      .where(eq(courtCoachesTable.courtId, courtId));
    res.json(rows.map((r) => formatCoach(r.coach)));
    return;
  }

  const coaches = await db.select().from(coachesTable).orderBy(coachesTable.createdAt);
  res.json(coaches.map(formatCoach));
});

// GET /coaches/me — get own coach profile
router.get("/coaches/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));
  if (!coach) {
    res.status(404).json({ error: "No coach profile found" });
    return;
  }
  res.json(formatCoach(coach));
});

// GET /coaches/:id — get coach by id
router.get("/coaches/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, id));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }
  res.json(formatCoach(coach));
});

// POST /coaches — create coach profile (auth required, one per user)
router.post("/coaches", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  const [existing] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));
  if (existing) {
    res.status(409).json({ error: "Coach profile already exists for this user. Use PUT to update." });
    return;
  }

  const [coach] = await db.insert(coachesTable).values({
    userId,
    name,
    email,
    bio: bio ?? null,
    photoUrl: photoUrl ?? null,
    videoUrl: videoUrl ?? null,
    pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
    sports: sports ?? [],
    availabilityDescription: availabilityDescription ?? null,
    phone: phone ?? null,
  }).returning();

  res.status(201).json(formatCoach(coach));
});

// PUT /coaches/:id — update coach profile (own profile or admin)
router.put("/coaches/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = getCurrentUserId(req)!;
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, id));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  const canEdit = await isOwner(req, coach.userId);
  if (!canEdit && coach.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = req.body;

  const [updated] = await db.update(coachesTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    bio: bio ?? null,
    photoUrl: photoUrl ?? null,
    videoUrl: videoUrl ?? null,
    pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
    ...(sports !== undefined && { sports }),
    availabilityDescription: availabilityDescription ?? null,
    phone: phone ?? null,
  }).where(eq(coachesTable.id, id)).returning();

  res.json(formatCoach(updated));
});

// PUT /coaches/me — upsert own coach profile
router.put("/coaches/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  const [existing] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));

  if (existing) {
    const [updated] = await db.update(coachesTable).set({
      name, email,
      bio: bio ?? null,
      photoUrl: photoUrl ?? null,
      videoUrl: videoUrl ?? null,
      pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
      sports: sports ?? [],
      availabilityDescription: availabilityDescription ?? null,
      phone: phone ?? null,
    }).where(eq(coachesTable.userId, userId)).returning();
    res.json(formatCoach(updated));
  } else {
    const [created] = await db.insert(coachesTable).values({
      userId, name, email,
      bio: bio ?? null,
      photoUrl: photoUrl ?? null,
      videoUrl: videoUrl ?? null,
      pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
      sports: sports ?? [],
      availabilityDescription: availabilityDescription ?? null,
      phone: phone ?? null,
    }).returning();
    res.status(201).json(formatCoach(created));
  }
});

// GET /courts/:id/coaches — coaches assigned to court
router.get("/courts/:id/coaches", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const rows = await db
    .select({ coach: coachesTable })
    .from(courtCoachesTable)
    .innerJoin(coachesTable, eq(courtCoachesTable.coachId, coachesTable.id))
    .where(eq(courtCoachesTable.courtId, courtId));

  res.json(rows.map((r) => formatCoach(r.coach)));
});

// POST /courts/:id/coaches — assign a coach to court (court owner only)
router.post("/courts/:id/coaches", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const { coachId } = req.body;
  if (!coachId) { res.status(400).json({ error: "coachId is required" }); return; }

  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, coachId));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  const [existing] = await db.select().from(courtCoachesTable)
    .where(and(eq(courtCoachesTable.courtId, courtId), eq(courtCoachesTable.coachId, coachId)));
  if (existing) { res.status(409).json({ error: "Coach already assigned to this court" }); return; }

  await db.insert(courtCoachesTable).values({ courtId, coachId });
  res.status(201).json({ ok: true });
});

// DELETE /courts/:id/coaches/:coachId — remove coach from court (court owner only)
router.delete("/courts/:id/coaches/:coachId", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  const coachId = parseInt(req.params.coachId, 10);
  if (isNaN(courtId) || isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(courtCoachesTable)
    .where(and(eq(courtCoachesTable.courtId, courtId), eq(courtCoachesTable.coachId, coachId)));

  res.json({ ok: true });
});

export default router;
