import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, trainersTable, courtsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner } from "../lib/auth";

const router: IRouter = Router();

function formatTrainer(t: typeof trainersTable.$inferSelect) {
  return {
    ...t,
    hourlyRate: t.hourlyRate != null ? Number(t.hourlyRate) : null,
    bio: t.bio ?? null,
    photoUrl: t.photoUrl ?? null,
    availabilityJson: t.availabilityJson ?? null,
    email: t.email ?? null,
    phone: t.phone ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

// GET /trainers — list all trainers, optionally ?courtId=&sport=
router.get("/trainers", async (req, res): Promise<void> => {
  const courtId = req.query.courtId ? parseInt(req.query.courtId as string, 10) : null;
  let rows = await db.select().from(trainersTable).orderBy(trainersTable.createdAt);
  if (courtId !== null && !isNaN(courtId)) {
    rows = rows.filter(r => r.courtId === courtId);
  }
  if (req.query.sport) {
    const sport = req.query.sport as string;
    rows = rows.filter(r => r.sports.includes(sport));
  }
  res.json(rows.map(formatTrainer));
});

// GET /trainers/:id
router.get("/trainers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [trainer] = await db.select().from(trainersTable).where(eq(trainersTable.id, id));
  if (!trainer) { res.status(404).json({ error: "Trainer not found" }); return; }
  res.json(formatTrainer(trainer));
});

// GET /courts/:id/trainers
router.get("/courts/:id/trainers", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }
  const rows = await db.select().from(trainersTable).where(eq(trainersTable.courtId, courtId));
  res.json(rows.map(formatTrainer));
});

// POST /courts/:id/trainers — create trainer for court (owner only)
router.post("/courts/:id/trainers", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const userId = getCurrentUserId(req)!;
  const { name, bio, photoUrl, sports, hourlyRate, availabilityJson, email, phone } = req.body;

  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const [trainer] = await db.insert(trainersTable).values({
    courtId,
    ownerUserId: userId,
    name,
    bio: bio ?? null,
    photoUrl: photoUrl ?? null,
    sports: sports ?? [],
    hourlyRate: hourlyRate != null ? String(hourlyRate) : null,
    availabilityJson: availabilityJson ?? null,
    email: email ?? null,
    phone: phone ?? null,
  }).returning();

  res.status(201).json(formatTrainer(trainer));
});

// PUT /trainers/:id — update trainer (owner only)
router.put("/trainers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [trainer] = await db.select().from(trainersTable).where(eq(trainersTable.id, id));
  if (!trainer) { res.status(404).json({ error: "Trainer not found" }); return; }

  const canEdit = await isOwner(req, trainer.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, bio, photoUrl, sports, hourlyRate, availabilityJson, email, phone } = req.body;

  const [updated] = await db.update(trainersTable).set({
    ...(name !== undefined && { name }),
    bio: bio ?? null,
    photoUrl: photoUrl ?? null,
    ...(sports !== undefined && { sports }),
    hourlyRate: hourlyRate != null ? String(hourlyRate) : null,
    availabilityJson: availabilityJson ?? null,
    email: email ?? null,
    phone: phone ?? null,
  }).where(eq(trainersTable.id, id)).returning();

  res.json(formatTrainer(updated));
});

// DELETE /trainers/:id — delete trainer (owner only)
router.delete("/trainers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [trainer] = await db.select().from(trainersTable).where(eq(trainersTable.id, id));
  if (!trainer) { res.status(404).json({ error: "Trainer not found" }); return; }

  const canEdit = await isOwner(req, trainer.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(trainersTable).where(eq(trainersTable.id, id));
  res.json({ ok: true });
});

export default router;
