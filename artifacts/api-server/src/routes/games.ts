import { Router, type IRouter } from "express";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { db, gamesTable, gameParticipantsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import crypto from "node:crypto";

const router: IRouter = Router();

function formatGame(g: typeof gamesTable.$inferSelect, joinedCount = 0, isJoined = false) {
  return {
    ...g,
    createdAt: g.createdAt.toISOString(),
    joinedCount,
    slotsLeft: Math.max(0, g.playersNeeded - joinedCount),
    isJoined,
  };
}

function formatParticipant(p: typeof gameParticipantsTable.$inferSelect) {
  return { ...p, joinedAt: p.joinedAt.toISOString() };
}

// GET /games — list all open upcoming games with filters
router.get("/games", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);

  let rows = await db
    .select()
    .from(gamesTable)
    .where(and(
      eq(gamesTable.status, "open"),
      eq(gamesTable.isPrivate, false),
    ))
    .orderBy(gamesTable.datetime);

  if (req.query.sport) rows = rows.filter(r => r.sport === req.query.sport);
  if (req.query.city) rows = rows.filter(r => r.city.toLowerCase() === String(req.query.city).toLowerCase());
  if (req.query.skillLevel) rows = rows.filter(r => r.skillLevel === req.query.skillLevel || r.skillLevel === "any");

  // Filter out past games
  const now = new Date();
  rows = rows.filter(r => new Date(r.datetime) >= now);

  // Attach participant counts
  const counts = await db
    .select({ gameId: gameParticipantsTable.gameId, count: sql<number>`count(*)` })
    .from(gameParticipantsTable)
    .where(eq(gameParticipantsTable.status, "joined"))
    .groupBy(gameParticipantsTable.gameId);
  const countMap = new Map(counts.map(c => [c.gameId, Number(c.count)]));

  let joinedSet = new Set<number>();
  if (userId) {
    const mine = await db.select({ gameId: gameParticipantsTable.gameId }).from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "joined")));
    joinedSet = new Set(mine.map(m => m.gameId));
  }

  res.json(rows.map(g => formatGame(g, countMap.get(g.id) ?? 0, joinedSet.has(g.id))));
});

// GET /games/:id — detail (public, but shares private games via token)
router.get("/games/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }

  // Private games require the invite token
  if (g.isPrivate && g.inviteToken !== req.query.token) {
    const userId = getCurrentUserId(req);
    if (!userId || (userId !== g.creatorUserId)) {
      res.status(403).json({ error: "This game is private" }); return;
    }
  }

  const participants = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")))
    .orderBy(gameParticipantsTable.joinedAt);

  const userId = getCurrentUserId(req);
  const isJoined = userId ? participants.some(p => p.userId === userId) : false;

  res.json({
    ...formatGame(g, participants.length, isJoined),
    participants: participants.map(formatParticipant),
  });
});

// POST /games — create
router.post("/games", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const {
    creatorName, creatorEmail, sport, city, placeName, facilityId, courtId,
    playersNeeded, skillLevel, datetime, durationMinutes, description, isPrivate,
  } = req.body ?? {};

  if (!creatorName || !sport || !city || !datetime) {
    res.status(400).json({ error: "creatorName, sport, city, datetime required" }); return;
  }

  const inviteToken = isPrivate ? crypto.randomBytes(16).toString("hex") : null;

  const [game] = await db.insert(gamesTable).values({
    creatorUserId: userId,
    creatorName,
    creatorEmail: creatorEmail ?? null,
    sport,
    city,
    placeName: placeName ?? null,
    facilityId: facilityId ?? null,
    courtId: courtId ?? null,
    playersNeeded: playersNeeded ?? 4,
    skillLevel: skillLevel ?? "any",
    datetime,
    durationMinutes: durationMinutes ?? 60,
    description: description ?? null,
    isPrivate: !!isPrivate,
    inviteToken,
    status: "open",
  }).returning();

  // Creator auto-joins
  await db.insert(gameParticipantsTable).values({
    gameId: game.id,
    userId,
    userName: creatorName,
    userEmail: creatorEmail ?? null,
    status: "joined",
  });

  res.status(201).json(formatGame(game, 1, true));
});

// PUT /games/:id — creator only
router.put("/games/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const {
    sport, city, placeName, playersNeeded, skillLevel, datetime, durationMinutes,
    description, status,
  } = req.body ?? {};

  const [updated] = await db.update(gamesTable).set({
    ...(sport !== undefined && { sport }),
    ...(city !== undefined && { city }),
    ...(placeName !== undefined && { placeName: placeName ?? null }),
    ...(playersNeeded !== undefined && { playersNeeded }),
    ...(skillLevel !== undefined && { skillLevel }),
    ...(datetime !== undefined && { datetime }),
    ...(durationMinutes !== undefined && { durationMinutes }),
    ...(description !== undefined && { description: description ?? null }),
    ...(status !== undefined && { status }),
  }).where(eq(gamesTable.id, id)).returning();

  res.json(formatGame(updated));
});

// DELETE /games/:id — creator only
router.delete("/games/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(gamesTable).where(eq(gamesTable.id, id));
  res.json({ ok: true });
});

// POST /games/:id/join
router.post("/games/:id/join", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const { userName, userEmail, token } = req.body ?? {};
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!userName) { res.status(400).json({ error: "userName required" }); return; }

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Not found" }); return; }
  if (g.status !== "open") { res.status(400).json({ error: "Game is closed" }); return; }

  // Private games require creator OR a valid invite token
  if (g.isPrivate && g.creatorUserId !== userId) {
    const provided = token ?? queryToken;
    if (!provided || provided !== g.inviteToken) {
      res.status(403).json({ error: "This game is private — invite link required" }); return;
    }
  }

  // Reject join on past games
  if (new Date(g.datetime) < new Date()) {
    res.status(400).json({ error: "Game has already started or ended" }); return;
  }

  const existing = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, userId)));

  if (existing.length && existing[0].status === "joined") {
    res.status(200).json({ ok: true, alreadyJoined: true }); return;
  }

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(countRow?.count ?? 0) >= g.playersNeeded) {
    res.status(400).json({ error: "Game is full" }); return;
  }

  if (existing.length) {
    await db.update(gameParticipantsTable).set({ status: "joined", userName, userEmail: userEmail ?? null })
      .where(eq(gameParticipantsTable.id, existing[0].id));
  } else {
    await db.insert(gameParticipantsTable).values({
      gameId: id, userId, userName, userEmail: userEmail ?? null, status: "joined",
    });
  }

  // Auto-close if full
  const [newCountRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(newCountRow?.count ?? 0) >= g.playersNeeded) {
    await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, id));
  }

  res.json({ ok: true });
});

// DELETE /games/:id/leave
router.delete("/games/:id/leave", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Not found" }); return; }
  if (g.creatorUserId === userId) {
    res.status(400).json({ error: "Creator cannot leave — delete the game instead" }); return;
  }
  await db.update(gameParticipantsTable).set({ status: "left" })
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, userId)));
  // Re-open if was full
  if (g.status === "full") {
    await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, id));
  }
  res.json({ ok: true });
});

// GET /games/mine — games user created or joined
router.get("/my-games", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const joined = await db.select({ gameId: gameParticipantsTable.gameId }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "joined")));
  const joinedIds = joined.map(j => j.gameId);

  if (joinedIds.length === 0) { res.json([]); return; }

  const rows = await db.select().from(gamesTable).orderBy(desc(gamesTable.datetime));
  const mine = rows.filter(r => joinedIds.includes(r.id));

  const counts = await db.select({ gameId: gameParticipantsTable.gameId, count: sql<number>`count(*)` })
    .from(gameParticipantsTable).where(eq(gameParticipantsTable.status, "joined"))
    .groupBy(gameParticipantsTable.gameId);
  const countMap = new Map(counts.map(c => [c.gameId, Number(c.count)]));

  res.json(mine.map(g => formatGame(g, countMap.get(g.id) ?? 0, true)));
});

export default router;
