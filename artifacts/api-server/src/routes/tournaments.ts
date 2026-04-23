import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, tournamentsTable, tournamentRegistrationsTable, courtsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner } from "../lib/auth";

const router: IRouter = Router();

function formatTournament(t: typeof tournamentsTable.$inferSelect, registrationCount?: number) {
  return {
    ...t,
    entryFee: t.entryFee != null ? Number(t.entryFee) : null,
    description: t.description ?? null,
    registrationDeadline: t.registrationDeadline ?? null,
    prizeInfo: t.prizeInfo ?? null,
    coverPhotoUrl: t.coverPhotoUrl ?? null,
    facilityId: t.facilityId ?? null,
    featuredUntil: t.featuredUntil ? t.featuredUntil.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    registrationCount: registrationCount ?? 0,
  };
}

function formatReg(r: typeof tournamentRegistrationsTable.$inferSelect) {
  return {
    ...r,
    playerPhone: r.playerPhone ?? null,
    userId: r.userId ?? null,
    registeredAt: r.registeredAt.toISOString(),
  };
}

// GET /tournaments — list all, optionally ?sport=&status=&courtId=&featured=1&facilityId=
router.get("/tournaments", async (req, res): Promise<void> => {
  let rows = await db.select().from(tournamentsTable).orderBy(tournamentsTable.startDate);

  if (req.query.sport) rows = rows.filter(r => r.sport === req.query.sport);
  if (req.query.status) rows = rows.filter(r => r.status === req.query.status);
  if (req.query.courtId) {
    const cid = parseInt(req.query.courtId as string, 10);
    if (!isNaN(cid)) rows = rows.filter(r => r.courtId === cid);
  }
  if (req.query.facilityId) {
    const fid = parseInt(req.query.facilityId as string, 10);
    if (!isNaN(fid)) rows = rows.filter(r => r.facilityId === fid);
  }
  if (req.query.featured === "1" || req.query.featured === "true") {
    const now = new Date();
    rows = rows.filter(r => r.isFeatured && r.featuredUntil && new Date(r.featuredUntil) > now);
  }
  if (req.query.ownerUserId) {
    rows = rows.filter(r => r.ownerUserId === req.query.ownerUserId);
  }

  // Attach registration counts
  const counts = await db
    .select({ tournamentId: tournamentRegistrationsTable.tournamentId, count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .groupBy(tournamentRegistrationsTable.tournamentId);

  const countMap = new Map(counts.map(c => [c.tournamentId, Number(c.count)]));
  res.json(rows.map(r => formatTournament(r, countMap.get(r.id) ?? 0)));
});

// GET /tournaments/:id
router.get("/tournaments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id));

  res.json(formatTournament(t, Number(countRow?.count ?? 0)));
});

// GET /courts/:id/tournaments
router.get("/courts/:id/tournaments", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.courtId, courtId));
  res.json(rows.map(r => formatTournament(r)));
});

// POST /courts/:id/tournaments — create tournament (owner only)
router.post("/courts/:id/tournaments", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const userId = getCurrentUserId(req)!;
  const { name, description, sport, startDate, endDate, registrationDeadline, maxParticipants, entryFee, prizeInfo, status, format, coverPhotoUrl } = req.body;

  if (!name || !sport || !startDate || !endDate) {
    res.status(400).json({ error: "name, sport, startDate, endDate are required" }); return;
  }

  const [tournament] = await db.insert(tournamentsTable).values({
    courtId,
    facilityId: court.facilityId ?? null,
    ownerUserId: userId,
    name,
    description: description ?? null,
    sport,
    coverPhotoUrl: coverPhotoUrl ?? null,
    startDate,
    endDate,
    registrationDeadline: registrationDeadline ?? null,
    maxParticipants: maxParticipants ?? 16,
    entryFee: entryFee != null ? String(entryFee) : null,
    prizeInfo: prizeInfo ?? null,
    status: status ?? "draft",
    format: format ?? "single_elimination",
  }).returning();

  res.status(201).json(formatTournament(tournament));
});

// PUT /tournaments/:id — update tournament (owner only)
router.put("/tournaments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  const canEdit = await isOwner(req, t.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, description, sport, startDate, endDate, registrationDeadline, maxParticipants, entryFee, prizeInfo, status, format, coverPhotoUrl } = req.body;

  const [updated] = await db.update(tournamentsTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description: description ?? null }),
    ...(sport !== undefined && { sport }),
    ...(coverPhotoUrl !== undefined && { coverPhotoUrl: coverPhotoUrl ?? null }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(registrationDeadline !== undefined && { registrationDeadline: registrationDeadline ?? null }),
    ...(maxParticipants !== undefined && { maxParticipants }),
    ...(entryFee !== undefined && { entryFee: entryFee != null ? String(entryFee) : null }),
    ...(prizeInfo !== undefined && { prizeInfo: prizeInfo ?? null }),
    ...(status !== undefined && { status }),
    ...(format !== undefined && { format }),
  }).where(eq(tournamentsTable.id, id)).returning();

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id));

  res.json(formatTournament(updated, Number(countRow?.count ?? 0)));
});

// POST /tournaments/:id/promote — activate homepage promotion for N days (owner only)
router.post("/tournaments/:id/promote", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Not found" }); return; }

  const canEdit = await isOwner(req, t.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const days = parseInt(String(req.body?.days ?? 14), 10);
  const until = new Date();
  until.setDate(until.getDate() + (isNaN(days) ? 14 : days));

  const [updated] = await db.update(tournamentsTable).set({
    isFeatured: true,
    featuredUntil: until,
  }).where(eq(tournamentsTable.id, id)).returning();

  res.json(formatTournament(updated));
});

// DELETE /tournaments/:id (owner only)
router.delete("/tournaments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  const canEdit = await isOwner(req, t.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.json({ ok: true });
});

// GET /tournaments/:id/registrations (owner only)
router.get("/tournaments/:id/registrations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  const canEdit = await isOwner(req, t.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const rows = await db.select().from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id))
    .orderBy(tournamentRegistrationsTable.registeredAt);

  res.json(rows.map(formatReg));
});

// POST /tournaments/:id/register — register for tournament (public/guest)
router.post("/tournaments/:id/register", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  if (t.status !== "open") {
    res.status(400).json({ error: "Tournament is not open for registration" }); return;
  }

  if (t.registrationDeadline) {
    const deadline = new Date(t.registrationDeadline);
    if (new Date() > deadline) {
      res.status(400).json({ error: "Registration deadline has passed" }); return;
    }
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id));

  if (Number(countRow?.count ?? 0) >= t.maxParticipants) {
    res.status(400).json({ error: "Tournament is full" }); return;
  }

  const { playerName, playerEmail, playerPhone, userId } = req.body;
  if (!playerName || !playerEmail) {
    res.status(400).json({ error: "playerName and playerEmail are required" }); return;
  }

  const [reg] = await db.insert(tournamentRegistrationsTable).values({
    tournamentId: id,
    playerName,
    playerEmail,
    playerPhone: playerPhone ?? null,
    userId: userId ?? null,
    status: "confirmed",
  }).returning();

  res.status(201).json(formatReg(reg));
});

// DELETE /tournaments/:id/registrations/:regId (owner only)
router.delete("/tournaments/:id/registrations/:regId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const regId = parseInt(req.params.regId, 10);
  if (isNaN(id) || isNaN(regId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  const canEdit = await isOwner(req, t.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const deleted = await db.delete(tournamentRegistrationsTable).where(
    and(
      eq(tournamentRegistrationsTable.id, regId),
      eq(tournamentRegistrationsTable.tournamentId, id)
    )
  ).returning();
  if (deleted.length === 0) { res.status(404).json({ error: "Registration not found" }); return; }
  res.json({ ok: true });
});

export default router;
