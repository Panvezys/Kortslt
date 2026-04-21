import { Router, type IRouter } from "express";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { db, gamesTable, gameParticipantsTable, gameResultsTable, matchInvitesTable, userRatingsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import { sendNotification } from "../lib/notify";
import { calculateTeamElo } from "../lib/elo";
import { sendMatchInviteEmail } from "../lib/email";
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
    matchType,
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
    matchType: matchType === "rated" ? "rated" : "casual",
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

  // Collect all participants before deleting (except creator)
  const participants = await db
    .select()
    .from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));

  await db.delete(gamesTable).where(eq(gamesTable.id, id));

  // Notify participants that the game was cancelled
  const sportLabel = g.sport.replace(/_/g, " ");
  const gameDate = new Date(g.datetime).toLocaleDateString("lt-LT");
  for (const p of participants) {
    if (p.userId && p.userId !== userId) {
      await sendNotification(
        p.userId,
        "game_cancelled",
        "Žaidimas atšauktas",
        `${sportLabel} žaidimas ${gameDate} (${g.city}) buvo atšauktas organizatoriaus.`,
        "/games",
      );
    }
  }

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

  // Notify game creator if someone else joined
  if (g.creatorUserId && g.creatorUserId !== userId) {
    const sportLabel = g.sport.replace(/_/g, " ");
    await sendNotification(
      g.creatorUserId,
      "game_join_request",
      `${userName} prisijungė prie jūsų žaidimo`,
      `${userName} prisijungė prie ${sportLabel} žaidimo ${new Date(g.datetime).toLocaleDateString("lt-LT")}.`,
      `/games/${id}`,
    );
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

// Helper: get or create user rating for a sport
async function getOrCreateRating(userId: string, sportSlug: string): Promise<{ elo: number }> {
  const [existing] = await db
    .select()
    .from(userRatingsTable)
    .where(and(eq(userRatingsTable.userId, userId), eq(userRatingsTable.sportSlug, sportSlug)));
  if (existing) return existing;
  const [row] = await db.insert(userRatingsTable).values({ userId, sportSlug }).returning();
  return row;
}

// POST /games/:id/result — creator reports final score
router.post("/games/:id/result", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Only the game creator can report results" }); return; }
  if (g.status !== "open" && g.status !== "full") { res.status(400).json({ error: "Game is not in a reportable state" }); return; }

  const { scoreTeamA, scoreTeamB } = req.body ?? {};
  if (scoreTeamA === undefined || scoreTeamB === undefined) {
    res.status(400).json({ error: "scoreTeamA and scoreTeamB required" }); return;
  }

  // Check no result yet
  const [existing] = await db.select().from(gameResultsTable).where(eq(gameResultsTable.gameId, id));
  if (existing) { res.status(400).json({ error: "Result already reported" }); return; }

  // 24h auto-confirm window
  const autoConfirmAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await db.insert(gameResultsTable).values({
    gameId: id,
    reportedByUserId: userId,
    scoreTeamA: Number(scoreTeamA),
    scoreTeamB: Number(scoreTeamB),
    status: "pending_verification",
    autoConfirmAt,
  }).returning();

  // Update game status
  await db.update(gamesTable).set({ status: "pending_verification" }).where(eq(gamesTable.id, id));

  // Notify all participants (except creator) to confirm
  const participants = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));

  for (const p of participants) {
    if (p.userId !== userId) {
      await sendNotification(
        p.userId,
        "result_confirmation",
        "Patvirtinkite žaidimo rezultatą",
        `${g.creatorName} paskelbė žaidimo rezultatą: ${scoreTeamA}:${scoreTeamB}. Patvirtinkite per 24h.`,
        `/games/${id}`,
      );
    }
  }

  res.status(201).json({ ...result, autoConfirmAt: result.autoConfirmAt?.toISOString() });
});

// POST /games/:id/verify — participant confirms or disputes result
router.post("/games/:id/verify", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }

  const [result] = await db.select().from(gameResultsTable).where(eq(gameResultsTable.gameId, id));
  if (!result) { res.status(404).json({ error: "No result reported for this game" }); return; }
  if (result.status !== "pending_verification") { res.status(400).json({ error: "Result is not pending verification" }); return; }

  // Verify the caller is a participant
  const [participation] = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "joined")));
  if (!participation) { res.status(403).json({ error: "You are not a participant in this game" }); return; }

  const { action } = req.body ?? {}; // "confirm" | "dispute"
  if (action !== "confirm" && action !== "dispute") {
    res.status(400).json({ error: "action must be 'confirm' or 'dispute'" }); return;
  }

  if (action === "dispute") {
    await db.update(gameResultsTable).set({ status: "disputed" }).where(eq(gameResultsTable.id, result.id));
    await db.update(gamesTable).set({ status: "disputed" }).where(eq(gamesTable.id, id));
    await sendNotification(
      g.creatorUserId,
      "result_disputed",
      "Žaidimo rezultatas ginčijamas",
      `${participation.userName} nesutinka su žaidimo rezultatu ${result.scoreTeamA}:${result.scoreTeamB}.`,
      `/games/${id}`,
    );
    res.json({ status: "disputed" }); return;
  }

  // Confirm — apply ELO changes if rated
  await db.update(gameResultsTable).set({ status: "confirmed" }).where(eq(gameResultsTable.id, result.id));
  await db.update(gamesTable).set({ status: "completed" }).where(eq(gamesTable.id, id));

  if (g.matchType === "rated") {
    const participants = await db.select().from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));

    const teamAPlayers = participants.filter(p => p.team === "A");
    const teamBPlayers = participants.filter(p => p.team === "B");
    const unassigned = participants.filter(p => !p.team);

    // If teams not assigned, split evenly by join order
    const effectiveTeamA = teamAPlayers.length ? teamAPlayers : unassigned.slice(0, Math.ceil(unassigned.length / 2));
    const effectiveTeamB = teamBPlayers.length ? teamBPlayers : unassigned.slice(Math.ceil(unassigned.length / 2));

    const teamAWithElo = await Promise.all(effectiveTeamA.map(async p => ({
      userId: p.userId,
      elo: (await getOrCreateRating(p.userId, g.sport)).elo,
    })));
    const teamBWithElo = await Promise.all(effectiveTeamB.map(async p => ({
      userId: p.userId,
      elo: (await getOrCreateRating(p.userId, g.sport)).elo,
    })));

    const winner: "A" | "B" | "draw" =
      result.scoreTeamA > result.scoreTeamB ? "A" :
      result.scoreTeamB > result.scoreTeamA ? "B" : "draw";

    const changes = calculateTeamElo(teamAWithElo, teamBWithElo, winner);

    const isDraw = winner === "draw";

    for (const change of changes) {
      const isOnTeamA = !!teamAWithElo.find(p => p.userId === change.userId);
      const isWinner = isDraw ? false : (isOnTeamA ? winner === "A" : winner === "B");

      const winsAdd = isDraw ? 0 : (isWinner ? 1 : 0);
      const lossesAdd = isDraw ? 0 : (!isWinner ? 1 : 0);
      const drawsAdd = isDraw ? 1 : 0;

      await db.update(userRatingsTable)
        .set({
          elo: change.newElo,
          wins: sql`${userRatingsTable.wins} + ${winsAdd}`,
          losses: sql`${userRatingsTable.losses} + ${lossesAdd}`,
          draws: sql`${userRatingsTable.draws} + ${drawsAdd}`,
          updatedAt: new Date(),
        })
        .where(and(eq(userRatingsTable.userId, change.userId), eq(userRatingsTable.sportSlug, g.sport)));

      // Notify player of ELO change
      const sign = change.delta > 0 ? "+" : "";
      await sendNotification(
        change.userId,
        "elo_update",
        `ELO pasikeitė: ${sign}${change.delta}`,
        `Žaidimas (${g.sport}) baigtas. Jūsų reitingas: ${change.oldElo} → ${change.newElo} (${sign}${change.delta}).`,
        `/games/${id}`,
      );
    }
  }

  res.json({ status: "confirmed" });
});

// POST /games/:id/invite — invite player by email
router.post("/games/:id/invite", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Only the creator can invite players" }); return; }

  const { email, name, team } = req.body ?? {};
  if (!email) { res.status(400).json({ error: "email required" }); return; }

  // Check if invite already sent
  const [existing] = await db.select().from(matchInvitesTable)
    .where(and(eq(matchInvitesTable.gameId, id), eq(matchInvitesTable.email, email)));
  if (existing) { res.status(400).json({ error: "Invite already sent to this email" }); return; }

  const inviteToken = crypto.randomBytes(16).toString("hex");
  const [invite] = await db.insert(matchInvitesTable).values({
    gameId: id,
    email,
    name: name ?? null,
    team: team ?? null,
    inviteToken,
    status: "pending",
  }).returning();

  // Send invitation email
  const joinLink = g.isPrivate
    ? `${process.env.SITE_URL || "https://korts.lt"}/games/${id}?token=${g.inviteToken}`
    : `${process.env.SITE_URL || "https://korts.lt"}/games/${id}`;

  await sendMatchInviteEmail(email, name ?? email, g.creatorName, g.sport, new Date(g.datetime), joinLink);

  res.status(201).json({ ...invite, createdAt: invite.createdAt.toISOString() });
});

// GET /games/:id/result — get reported result
router.get("/games/:id/result", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [result] = await db.select().from(gameResultsTable).where(eq(gameResultsTable.gameId, id));
  if (!result) { res.status(404).json({ error: "No result found" }); return; }
  res.json({
    ...result,
    autoConfirmAt: result.autoConfirmAt?.toISOString(),
    createdAt: result.createdAt.toISOString(),
  });
});

export default router;
