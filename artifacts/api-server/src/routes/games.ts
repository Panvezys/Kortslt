import { Router, type IRouter } from "express";
import { eq, desc, and, or, inArray, sql, gte, lt, ne } from "drizzle-orm";
import {
  db,
  gamesTable,
  gameParticipantsTable,
  gameResultsTable,
  matchInvitesTable,
  userRatingsTable,
  eloHistoryTable,
  gameChatTable,
  gameResultConfirmationsTable,
  bookingsTable,
  courtsTable,
  facilitiesTable,
  userProfilesTable,
  courtPricingTable,
  courtBlockedSlotsTable,
} from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import { sendNotification } from "../lib/notify";
import { calculateTeamElo } from "../lib/elo";
import {
  type SportScore,
  getSportConfig,
  validateScore,
  deriveWinner,
  setsWonFromScore,
  pointsWonFromScore,
} from "@workspace/db";
import { sendMatchInviteEmail } from "../lib/email";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { computeRefund, hoursBeforeStart } from "./bookings";
import crypto from "node:crypto";
import { z } from "zod";
import { EmailString } from "@workspace/api-zod";

// ─── Local helpers shared with bookings flow (kept inline to avoid cross-route imports) ──
function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function isPeakSlot(startTime: string, dayOfWeek: number): boolean {
  const m = toMin(startTime);
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  return isWeekday && m >= 17 * 60 && m < 22 * 60;
}
function slotsBetween(startTime: string, endTime: string): string[] {
  const start = toMin(startTime);
  const end = toMin(endTime);
  const out: string[] = [];
  for (let m = start; m < end; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(`${h}:${mm}`);
  }
  return out;
}

const router: IRouter = Router();

function formatGame(g: typeof gamesTable.$inferSelect, joinedCount = 0, isJoined = false, isCreator = false) {
  return {
    id: g.id,
    creatorName: g.creatorName,
    sport: g.sport,
    city: g.city,
    placeName: g.placeName,
    facilityId: g.facilityId,
    courtId: g.courtId,
    playersNeeded: g.playersNeeded,
    skillLevel: g.skillLevel,
    datetime: g.datetime instanceof Date ? g.datetime.toISOString() : new Date(g.datetime).toISOString(),
    durationMinutes: g.durationMinutes,
    description: g.description,
    isPrivate: g.isPrivate,
    requiresApproval: g.requiresApproval,
    teamCount: g.teamCount,
    status: g.status,
    matchType: g.matchType,
    bookingId: g.bookingId ?? null,
    createdAt: g.createdAt.toISOString(),
    joinedCount,
    slotsLeft: Math.max(0, g.playersNeeded - joinedCount),
    isJoined,
    isCreator,
  };
}

function formatParticipant(p: typeof gameParticipantsTable.$inferSelect) {
  return {
    id: p.id,
    gameId: p.gameId,
    userName: p.userName,
    team: p.team,
    status: p.status,
    joinedAt: p.joinedAt.toISOString(),
  };
}

function formatParticipantWithId(p: typeof gameParticipantsTable.$inferSelect) {
  return {
    id: p.id,
    gameId: p.gameId,
    userId: p.userId,
    userName: p.userName,
    team: p.team,
    status: p.status,
    joinedAt: p.joinedAt.toISOString(),
  };
}

// Look up reliability scores for a list of user IDs in one query.
async function getReliabilityMap(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const profiles = await db.select({ userId: userProfilesTable.userId, reliabilityScore: userProfilesTable.reliabilityScore })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.userId, userIds));
  return new Map(profiles.map(p => [p.userId, p.reliabilityScore ?? 100]));
}

function formatDateTime(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// GET /games/my — games where I'm creator or participant (game history)
router.get("/games/my", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  // Games where user is a participant (joined) — targeted query
  const participantRows = await db
    .select({ gameId: gameParticipantsTable.gameId, team: gameParticipantsTable.team })
    .from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "joined")));
  const participantGameIds = participantRows.map(r => r.gameId);
  const myTeamMap = new Map(participantRows.map(r => [r.gameId, r.team]));

  // Fetch only games where user is creator OR participant — no full table scan
  const games = participantGameIds.length > 0
    ? await db.select().from(gamesTable)
        .where(or(eq(gamesTable.creatorUserId, userId), inArray(gamesTable.id, participantGameIds)))
        .orderBy(desc(gamesTable.datetime))
    : await db.select().from(gamesTable)
        .where(eq(gamesTable.creatorUserId, userId))
        .orderBy(desc(gamesTable.datetime));

  if (games.length === 0) { res.json([]); return; }

  const gameIds = games.map(g => g.id);

  // Get participants only for these specific games
  const allParticipants = await db
    .select()
    .from(gameParticipantsTable)
    .where(and(inArray(gameParticipantsTable.gameId, gameIds), eq(gameParticipantsTable.status, "joined")));
  const participantsByGame = new Map<number, typeof allParticipants>();
  for (const p of allParticipants) {
    if (!participantsByGame.has(p.gameId)) participantsByGame.set(p.gameId, []);
    participantsByGame.get(p.gameId)!.push(p);
  }

  // Get results only for these specific games
  const results = await db.select().from(gameResultsTable)
    .where(inArray(gameResultsTable.gameId, gameIds));
  const resultByGame = new Map(results.map(r => [r.gameId, r]));

  // Get ELO ratings only for the relevant user IDs across these games
  const allUserIds = [...new Set(allParticipants.map(p => p.userId))];
  const ratings = allUserIds.length > 0
    ? await db.select().from(userRatingsTable).where(inArray(userRatingsTable.userId, allUserIds))
    : [];
  const ratingKey = (uid: string, sport: string) => `${uid}::${sport}`;
  const ratingMap = new Map(ratings.map(r => [ratingKey(r.userId, r.sport), r.elo]));

  const out = games.map(g => {
    const participants = participantsByGame.get(g.id) ?? [];
    const result = resultByGame.get(g.id) ?? null;
    const myTeam = myTeamMap.get(g.id) ?? null;

    // Determine win/loss/draw for this user
    let myResult: "win" | "loss" | "draw" | null = null;
    if (result && result.status === "confirmed" && myTeam) {
      const teamWon = result.scoreTeamA > result.scoreTeamB ? "A" :
                      result.scoreTeamB > result.scoreTeamA ? "B" : "draw";
      if (teamWon === "draw") myResult = "draw";
      else myResult = teamWon === myTeam ? "win" : "loss";
    }

    return {
      id: g.id,
      sport: g.sport,
      city: g.city,
      placeName: g.placeName,
      datetime: formatDateTime(g.datetime),
      status: g.status,
      matchType: g.matchType,
      playersNeeded: g.playersNeeded,
      myTeam,
      myResult,
      result: result ? {
        scoreTeamA: result.scoreTeamA,
        scoreTeamB: result.scoreTeamB,
        status: result.status,
      } : null,
      participants: participants.map(p => ({
        userId: p.userId,
        userName: p.userName,
        team: p.team,
        elo: ratingMap.get(ratingKey(p.userId, g.sport)) ?? 1200,
      })),
    };
  });

  res.json(out);
});

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

  res.json(rows.map(g => formatGame(g, countMap.get(g.id) ?? 0, joinedSet.has(g.id), !!(userId && userId === g.creatorUserId))));
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

  const userId = getCurrentUserId(req);
  const isCreator = userId === g.creatorUserId;

  const participants = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")))
    .orderBy(gameParticipantsTable.joinedAt);

  const isJoined = userId ? participants.some(p => p.userId === userId) : false;

  // Check if current user has a pending join request
  let isPending = false;
  if (userId && !isJoined) {
    const [myRow] = await db.select().from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "pending")));
    isPending = !!myRow;
  }

  // For creator: fetch pending join requests
  let pendingParticipants: typeof participants = [];
  if (isCreator) {
    pendingParticipants = await db.select().from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "pending")))
      .orderBy(gameParticipantsTable.joinedAt);
  }

  // Fetch ELO ratings + reliability scores for participants
  const participantRatings = await Promise.all(
    participants.map(p => db.select().from(userRatingsTable)
      .where(and(eq(userRatingsTable.userId, p.userId), eq(userRatingsTable.sportSlug, g.sport)))
      .limit(1).then(rows => ({ userId: p.userId, elo: rows[0]?.elo ?? 1200 })))
  );
  const ratingMap = new Map(participantRatings.map(r => [r.userId, r.elo]));
  const reliabilityMap = await getReliabilityMap(participants.map(p => p.userId));

  const gameData = formatGame(g, participants.length, isJoined, isCreator);
  // Expose internal user IDs only to authenticated game participants, not public visitors
  const isAuthenticatedParticipant = isJoined || isCreator;
  res.json({
    ...gameData,
    ...(isCreator && g.inviteToken ? { inviteToken: g.inviteToken } : {}),
    ...(isAuthenticatedParticipant ? { creatorUserId: g.creatorUserId } : {}),
    isPending,
    participants: participants.map(p => ({
      ...(isAuthenticatedParticipant ? formatParticipantWithId(p) : formatParticipant(p)),
      elo: ratingMap.get(p.userId) ?? 1200,
      reliabilityScore: reliabilityMap.get(p.userId) ?? 100,
      isOrganizer: p.userId === g.creatorUserId,
    })),
    pendingParticipants: pendingParticipants.map(p => formatParticipantWithId(p)),
  });
});

// POST /games — create
router.post("/games", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const {
    creatorName, creatorEmail, sport, city, placeName, facilityId, courtId,
    playersNeeded, skillLevel, datetime, durationMinutes, description, isPrivate,
    matchType, requiresApproval, teamCount,
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
    requiresApproval: !!requiresApproval,
    teamCount: teamCount ? Math.max(2, Math.min(6, Number(teamCount))) : 2,
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

  const created = formatGame(game, 1, true, true);
  res.status(201).json(game.inviteToken ? { ...created, inviteToken: game.inviteToken } : created);
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

  res.json(formatGame(updated, 0, false, true));
});

// DELETE /games/:id — creator only
// GET /games/:id/refund-preview — host-cancellation refund preview (mirrors bookings preview).
// Returns canCancel:false with reason when the game has no linked paid booking — the host can
// still delete the game in that case (no money is at stake), the dialog just shows a plain warning.
router.get("/games/:id/refund-preview", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  if (!g.bookingId) {
    res.json({
      gameId: g.id,
      bookingId: null,
      hasBooking: false,
      totalPrice: 0,
      hoursBeforeStart: 0,
      refundPercent: 0,
      refundAmount: 0,
      refundable: false,
      canCancel: true,
    });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, g.bookingId));
  if (!booking) {
    res.json({
      gameId: g.id,
      bookingId: g.bookingId,
      hasBooking: false,
      totalPrice: 0,
      hoursBeforeStart: 0,
      refundPercent: 0,
      refundAmount: 0,
      refundable: false,
      canCancel: true,
    });
    return;
  }

  const totalPriceEur = Number(booking.totalPrice);
  const hours = hoursBeforeStart(booking.date, booking.startTime);
  const tier = computeRefund(totalPriceEur, hours);
  const canCancel = booking.status !== "cancelled" && hours > 0;
  let reason: string | undefined;
  if (booking.status === "cancelled") reason = "Rezervacija jau atšaukta.";
  else if (hours <= 0) reason = "Žaidimas jau prasidėjo arba pasibaigė.";

  res.json({
    gameId: g.id,
    bookingId: booking.id,
    hasBooking: true,
    totalPrice: totalPriceEur,
    hoursBeforeStart: Math.round(hours * 10) / 10,
    refundPercent: tier.refundPercent,
    refundAmount: tier.refundAmount,
    refundable: tier.refundable,
    canCancel,
    ...(reason ? { reason } : {}),
  });
});

router.delete("/games/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  // ─── Single-owner cancellation claim ─────────────────────────────────────────
  // CAS the game into 'cancelling' so that concurrent DELETEs are rejected with 409.
  // Without this, a second request could race past the booking-CAS (which would
  // already be claimed) and delete the game while the first request's Stripe call
  // is still in flight, producing "game deleted but booking still confirmed and
  // no refund issued" if Stripe then fails and the first request rolls booking back.
  const originalStatus = g.status;
  const claimGame = await db
    .update(gamesTable)
    .set({ status: "cancelling" })
    .where(and(eq(gamesTable.id, id), ne(gamesTable.status, "cancelling")))
    .returning();
  if (claimGame.length === 0) {
    res.status(409).json({ error: "Atšaukimas jau vykdomas. Bandykite po akimirkos." });
    return;
  }

  // ─── If a paid Korts.lt booking is linked, mirror the standard booking-cancel + refund flow ──
  let refundedAmount = 0;
  let refundPercent = 0;
  if (g.bookingId) {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, g.bookingId));
    if (booking && booking.status !== "cancelled") {
      const totalPriceEur = Number(booking.totalPrice);
      const hours = hoursBeforeStart(booking.date, booking.startTime);
      if (hours <= 0) {
        res.status(400).json({ error: "Žaidimas jau prasidėjo arba pasibaigė", code: "CANCEL_TOO_LATE" });
        return;
      }
      const tier = computeRefund(totalPriceEur, hours);

      // CAS on booking status to prevent double-refund if the host clicks twice or the
      // sweeper races us on a still-pending booking.
      const claimed = await db
        .update(bookingsTable)
        .set({ status: "cancelled" })
        .where(and(eq(bookingsTable.id, booking.id), ne(bookingsTable.status, "cancelled")))
        .returning();

      if (claimed.length > 0) {
        let stripeRefundId: string | null = null;
        if (
          tier.refundable &&
          tier.refundAmount > 0 &&
          booking.stripePaymentIntentId &&
          !booking.stripePaymentIntentId.startsWith("mock_")
        ) {
          try {
            const stripe = await getUncachableStripeClient();
            const refund = await stripe.refunds.create(
              {
                payment_intent: booking.stripePaymentIntentId,
                amount: Math.round(tier.refundAmount * 100),
                reason: "requested_by_customer",
              },
              { idempotencyKey: `cancel-game-${g.id}` },
            );
            stripeRefundId = refund.id;
            logger.info(
              { gameId: g.id, bookingId: booking.id, refundId: refund.id, amount: tier.refundAmount },
              "Stripe refund issued for host-cancelled game",
            );
          } catch (err) {
            logger.error({ err, gameId: g.id, bookingId: booking.id }, "Stripe refund failed");
            // Roll back BOTH booking and game status so the host can retry.
            // Without restoring game.status, the next attempt would 409 forever.
            await db
              .update(bookingsTable)
              .set({ status: booking.status })
              .where(eq(bookingsTable.id, booking.id));
            await db
              .update(gamesTable)
              .set({ status: originalStatus })
              .where(eq(gamesTable.id, g.id));
            res.status(502).json({ error: "Nepavyko grąžinti pinigų. Bandykite dar kartą." });
            return;
          }
        }

        await db
          .update(bookingsTable)
          .set({ refundAmount: String(tier.refundAmount), stripeRefundId })
          .where(eq(bookingsTable.id, booking.id));

        refundedAmount = tier.refundAmount;
        refundPercent = tier.refundPercent;
      }
    }
  }

  // Collect all participants before deleting (except creator) so we can notify them.
  const participants = await db
    .select()
    .from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));

  // bookingId on games has ON DELETE SET NULL, so the booking row (now 'cancelled')
  // survives for refund history; participants/results/chat cascade-delete with the game.
  await db.delete(gamesTable).where(eq(gamesTable.id, id));

  // Notify all joined participants that the host cancelled.
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

  res.json({ ok: true, refundAmount: refundedAmount, refundPercent });
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

  // If user already has a pending request, don't duplicate
  if (existing.length && existing[0].status === "pending") {
    res.status(200).json({ ok: true, status: "pending" }); return;
  }

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(countRow?.count ?? 0) >= g.playersNeeded) {
    res.status(400).json({ error: "Game is full" }); return;
  }

  // --- Approval workflow ---
  const isCreatorJoining = g.creatorUserId === userId;
  const needsApproval = g.requiresApproval && !isCreatorJoining;

  const newStatus = needsApproval ? "pending" : "joined";

  if (existing.length) {
    await db.update(gameParticipantsTable).set({ status: newStatus, userName, userEmail: userEmail ?? null })
      .where(eq(gameParticipantsTable.id, existing[0].id));
  } else {
    await db.insert(gameParticipantsTable).values({
      gameId: id, userId, userName, userEmail: userEmail ?? null, status: newStatus,
    });
  }

  const sportLabel = g.sport.replace(/_/g, " ");
  const gameDate = new Date(g.datetime).toLocaleDateString("lt-LT");

  if (needsApproval) {
    // Notify creator about the join request
    await sendNotification(
      g.creatorUserId,
      "game_join_request",
      `${userName} nori prisijungti prie jūsų žaidimo`,
      `${userName} prašo prisijungti prie ${sportLabel} žaidimo ${gameDate}. Peržiūrėkite prašymą.`,
      `/games/${id}`,
    );
    res.json({ ok: true, status: "pending" }); return;
  }

  // Auto-close if full (only for direct joins)
  const [newCountRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(newCountRow?.count ?? 0) >= g.playersNeeded) {
    await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, id));
  }

  // Notify game creator if someone else joined directly
  if (g.creatorUserId !== userId) {
    await sendNotification(
      g.creatorUserId,
      "game_join_request",
      `${userName} prisijungė prie jūsų žaidimo`,
      `${userName} prisijungė prie ${sportLabel} žaidimo ${gameDate}.`,
      `/games/${id}`,
    );
  }

  res.json({ ok: true, status: "joined" });
});

// POST /games/:id/approve-join — creator approves or rejects a join request
router.post("/games/:id/approve-join", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const { participantId, action } = req.body ?? {}; // action: "approve" | "reject"

  if (!participantId || (action !== "approve" && action !== "reject")) {
    res.status(400).json({ error: "participantId and action ('approve'|'reject') required" }); return;
  }

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Only the creator can approve/reject requests" }); return; }

  const [participant] = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.id, participantId), eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "pending")));
  if (!participant) { res.status(404).json({ error: "Pending request not found" }); return; }

  // Creator-sent invites (source="invite") can only be accepted by the invited user themselves
  // via POST /games/:id/accept-invite — the creator cannot approve their own invitations
  if (participant.source === "invite") {
    res.status(403).json({ error: "This is a creator-sent invitation and can only be accepted by the invited user" }); return;
  }

  const sportLabel = g.sport.replace(/_/g, " ");
  const gameDate = new Date(g.datetime).toLocaleDateString("lt-LT");

  if (action === "reject") {
    await db.update(gameParticipantsTable).set({ status: "rejected" })
      .where(eq(gameParticipantsTable.id, participantId));
    // Notify applicant
    await sendNotification(
      participant.userId,
      "game_join_rejected",
      "Prašymas prisijungti atmestas",
      `Jūsų prašymas prisijungti prie ${sportLabel} žaidimo ${gameDate} buvo atmestas.`,
      `/games/${id}`,
    );
    res.json({ ok: true, action: "rejected" }); return;
  }

  // Check game isn't full before approving
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(countRow?.count ?? 0) >= g.playersNeeded) {
    res.status(400).json({ error: "Game is full — cannot approve more players" }); return;
  }

  await db.update(gameParticipantsTable).set({ status: "joined" })
    .where(eq(gameParticipantsTable.id, participantId));

  // Auto-close if now full
  const [newCountRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(newCountRow?.count ?? 0) >= g.playersNeeded) {
    await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, id));
  }

  // Notify applicant of approval
  await sendNotification(
    participant.userId,
    "game_join_approved",
    "Prašymas prisijungti patvirtintas!",
    `Jūsų prašymas prisijungti prie ${sportLabel} žaidimo ${gameDate} buvo patvirtintas!`,
    `/games/${id}`,
  );

  res.json({ ok: true, action: "approved" });
});

// DELETE /games/:id/remove-player — creator removes a joined player
router.delete("/games/:id/remove-player", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;
  const { targetUserId } = req.body ?? {};

  if (!targetUserId) { res.status(400).json({ error: "targetUserId required" }); return; }

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Only the creator can remove players" }); return; }
  if (targetUserId === userId) { res.status(400).json({ error: "Creator cannot remove themselves" }); return; }

  const [participant] = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, targetUserId), eq(gameParticipantsTable.status, "joined")));
  if (!participant) { res.status(404).json({ error: "Player not found in this game" }); return; }

  await db.update(gameParticipantsTable).set({ status: "removed" })
    .where(eq(gameParticipantsTable.id, participant.id));

  // Re-open game if it was full
  if (g.status === "full") {
    await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, id));
  }

  // Notify the removed player
  const sportLabel = g.sport.replace(/_/g, " ");
  const gameDate = new Date(g.datetime).toLocaleDateString("lt-LT");
  await sendNotification(
    targetUserId,
    "game_removed",
    "Buvote pašalinti iš žaidimo",
    `Organizatorius pašalino jus iš ${sportLabel} žaidimo ${gameDate} (${g.city}).`,
    `/games`,
  );

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

  // Single-transition CAS: only flip rows that are currently `joined`. If 0 rows
  // updated, the user wasn't actually joined → idempotent no-op (no penalty).
  const flipped = await db
    .update(gameParticipantsTable)
    .set({ status: "left" })
    .where(and(
      eq(gameParticipantsTable.gameId, id),
      eq(gameParticipantsTable.userId, userId),
      eq(gameParticipantsTable.status, "joined"),
    ))
    .returning({ id: gameParticipantsTable.id });

  if (flipped.length === 0) {
    // Already left (or never joined) — return idempotently without penalty.
    res.json({ ok: true, alreadyLeft: true }); return;
  }

  // Re-open if was full
  if (g.status === "full") {
    await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, id));
  }

  // ─── Reliability penalty: leaving within 12h of game start costs 10 points ──
  const now = Date.now();
  const startMs = new Date(g.datetime).getTime();
  const hoursUntilStart = (startMs - now) / (1000 * 60 * 60);
  const wasActive = g.status === "open" || g.status === "full";
  if (wasActive && hoursUntilStart > 0 && hoursUntilStart < 12) {
    // Ensure a profile row exists, then decrement (clamp at 0).
    const [existing] = await db.select({ score: userProfilesTable.reliabilityScore })
      .from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    if (!existing) {
      await db.insert(userProfilesTable).values({ userId, reliabilityScore: 90 }).onConflictDoNothing();
    } else {
      const newScore = Math.max(0, (existing.score ?? 100) - 10);
      await db.update(userProfilesTable).set({ reliabilityScore: newScore }).where(eq(userProfilesTable.userId, userId));
    }
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

  res.json(mine.map(g => formatGame(g, countMap.get(g.id) ?? 0, true, g.creatorUserId === userId)));
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

  // Time gate: result can only be reported after the game has ended
  const endsAtMs = new Date(g.datetime).getTime() + (g.durationMinutes ?? 0) * 60_000;
  if (Date.now() < endsAtMs) {
    res.status(400).json({ error: "Žaidimas dar nepasibaigė — rezultatą galima paskelbti tik po žaidimo pabaigos." });
    return;
  }

  // Accept either a structured `score` (preferred, sport-typed) or legacy scoreTeamA/scoreTeamB.
  const { scoreTeamA, scoreTeamB, score } = req.body ?? {};
  const hasStructured = score && typeof score === "object" && (score.type === "SET_BASED" || score.type === "POINT_BASED");

  let teamAScore: number;
  let teamBScore: number;
  let structuredScore: SportScore | null = null;

  if (hasStructured) {
    const cfg = getSportConfig(g.sport);
    const errs = validateScore(score as SportScore, cfg);
    if (errs.length > 0) { res.status(400).json({ error: errs[0].message }); return; }
    structuredScore = score as SportScore;
    // Casual games drive ELO — require an unambiguous winner (no ties).
    const side = deriveWinner(structuredScore, cfg);
    if (!side) {
      res.status(400).json({ error: "Lygiosios negalimos – nustatykite nugalėtoją." }); return;
    }
    if (cfg.scoringType === "SET_BASED") {
      const sets = setsWonFromScore(structuredScore);
      teamAScore = sets.a;
      teamBScore = sets.b;
    } else {
      const pts = pointsWonFromScore(structuredScore);
      teamAScore = pts.a;
      teamBScore = pts.b;
    }
  } else {
    if (scoreTeamA === undefined || scoreTeamB === undefined) {
      res.status(400).json({ error: "scoreTeamA and scoreTeamB required" }); return;
    }
    teamAScore = Number(scoreTeamA);
    teamBScore = Number(scoreTeamB);
    if (
      !Number.isFinite(teamAScore) || !Number.isFinite(teamBScore) ||
      !Number.isInteger(teamAScore) || !Number.isInteger(teamBScore) ||
      teamAScore < 0 || teamBScore < 0
    ) {
      res.status(400).json({ error: "Rezultatas turi būti neneigiamas sveikasis skaičius." }); return;
    }
    if (teamAScore === teamBScore) {
      res.status(400).json({ error: "Lygiosios negalimos – nustatykite nugalėtoją." }); return;
    }
  }

  // 24h auto-confirm window
  const autoConfirmAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Wrap insert in a transaction with a row-lock on the game so concurrent submissions can't race
  // (one will see the other's freshly-inserted result inside the same lock window).
  const insertOutcome = await db.transaction(async (tx) => {
    await tx.select({ id: gamesTable.id })
      .from(gamesTable)
      .where(eq(gamesTable.id, id))
      .for("update");
    const [existing] = await tx.select().from(gameResultsTable).where(eq(gameResultsTable.gameId, id));
    if (existing) return { ok: false as const, error: "Result already reported" };

    const [created] = await tx.insert(gameResultsTable).values({
      gameId: id,
      reportedByUserId: userId,
      scoreTeamA: teamAScore,
      scoreTeamB: teamBScore,
      status: "pending_verification",
      autoConfirmAt,
    }).returning();

    await tx.update(gamesTable)
      .set({ status: "pending_verification", ...(structuredScore ? { resultData: structuredScore } : {}) })
      .where(eq(gamesTable.id, id));
    return { ok: true as const, result: created };
  });

  if (!insertOutcome.ok) { res.status(400).json({ error: insertOutcome.error }); return; }
  const result = insertOutcome.result;

  // Notify all participants (except creator) to confirm
  const participants = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));

  for (const p of participants) {
    if (p.userId !== userId) {
      await sendNotification(
        p.userId,
        "result_confirmation",
        "Patvirtinkite žaidimo rezultatą",
        `${g.creatorName} paskelbė žaidimo rezultatą: ${teamAScore}:${teamBScore}. Patvirtinkite per 24h.`,
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

  // The reporter cannot verify their own result — requires an independent participant
  if (userId === result.reportedByUserId) {
    res.status(403).json({ error: "The result reporter cannot verify their own result" }); return;
  }

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

  // ─── Per-user confirmation: record this confirmation, then apply ELO only if ALL non-reporters confirmed ──
  try {
    await db.insert(gameResultConfirmationsTable).values({ gameResultId: result.id, userId });
  } catch (err: any) {
    // Unique violation: already confirmed → idempotent, just count and decide.
    if (err?.code !== "23505") throw err;
  }

  const allParticipants = await db.select({ userId: gameParticipantsTable.userId })
    .from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  const nonReporterParticipants = allParticipants.filter(p => p.userId !== result.reportedByUserId);
  const requiredConfirmations = nonReporterParticipants.length;

  const confirmations = await db.select({ userId: gameResultConfirmationsTable.userId })
    .from(gameResultConfirmationsTable)
    .where(eq(gameResultConfirmationsTable.gameResultId, result.id));
  const validConfirmIds = new Set(nonReporterParticipants.map(p => p.userId));
  const confirmedCount = confirmations.filter(c => validConfirmIds.has(c.userId)).length;

  if (confirmedCount < requiredConfirmations) {
    // Still waiting for more confirmations — leave status as pending_verification.
    res.json({ status: "pending_verification", confirmedCount, requiredConfirmations });
    return;
  }

  // All non-reporters confirmed → apply ELO via shared helper (idempotent).
  await applyResultElo(result.id);
  res.json({ status: "confirmed", confirmedCount, requiredConfirmations });
});

// POST /games/:id/invite — invite player by email
router.post("/games/:id/invite", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Only the creator can invite players" }); return; }

  const InviteBody = z.object({
    email: EmailString,
    name: z.string().trim().min(1).optional(),
    team: z.string().optional(),
  });
  const parsed = InviteBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { email, name, team } = parsed.data;

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

// GET /games/:id/result — get reported result (public-safe: no internal user IDs)
router.get("/games/:id/result", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [result] = await db.select().from(gameResultsTable).where(eq(gameResultsTable.gameId, id));
  if (!result) { res.status(404).json({ error: "No result found" }); return; }
  res.json({
    id: result.id,
    gameId: result.gameId,
    scoreTeamA: result.scoreTeamA,
    scoreTeamB: result.scoreTeamB,
    status: result.status,
    autoConfirmAt: result.autoConfirmAt?.toISOString() ?? null,
    createdAt: result.createdAt.toISOString(),
  });
});

// GET /games/h2h?userId1=X&userId2=Y — head-to-head rivalry stats
router.get("/games/h2h", requireAuth, async (req, res): Promise<void> => {
  const { userId1, userId2 } = req.query as { userId1: string; userId2: string };
  if (!userId1 || !userId2) { res.status(400).json({ error: "userId1 and userId2 required" }); return; }

  const p1Games = await db.select({ gameId: gameParticipantsTable.gameId })
    .from(gameParticipantsTable).where(and(eq(gameParticipantsTable.userId, userId1), eq(gameParticipantsTable.status, "joined")));
  const p2Games = await db.select({ gameId: gameParticipantsTable.gameId })
    .from(gameParticipantsTable).where(and(eq(gameParticipantsTable.userId, userId2), eq(gameParticipantsTable.status, "joined")));

  const p1Set = new Set(p1Games.map(g => g.gameId));
  const sharedGameIds = p2Games.map(g => g.gameId).filter(id => p1Set.has(id));

  if (sharedGameIds.length === 0) { res.json({ user1Wins: 0, user2Wins: 0, draws: 0, total: 0 }); return; }

  let user1Wins = 0, user2Wins = 0, draws = 0;
  for (const gameId of sharedGameIds) {
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    const [result] = await db.select().from(gameResultsTable).where(and(eq(gameResultsTable.gameId, gameId), eq(gameResultsTable.status, "confirmed")));
    if (!result || !game || game.matchType !== "rated") continue;

    const [p1Part] = await db.select().from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, gameId), eq(gameParticipantsTable.userId, userId1), eq(gameParticipantsTable.status, "joined")));
    if (!p1Part) continue;

    const teamA = result.scoreTeamA;
    const teamB = result.scoreTeamB;
    const p1Team = p1Part.team;

    if (teamA === teamB) { draws++; }
    else if ((p1Team === "A" && teamA > teamB) || (p1Team === "B" && teamB > teamA)) { user1Wins++; }
    else { user2Wins++; }
  }

  res.json({ user1Wins, user2Wins, draws, total: sharedGameIds.length });
});

// GET /users/:userId/elo-history?sport=tennis — ELO history for line chart
router.get("/users/:userId/elo-history", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const sport = String(req.query.sport ?? "");
  const where = sport
    ? and(eq(eloHistoryTable.userId, userId), eq(eloHistoryTable.sportSlug, sport))
    : eq(eloHistoryTable.userId, userId);
  const history = await db.select().from(eloHistoryTable).where(where)
    .orderBy(eloHistoryTable.recordedAt).limit(50);
  res.json(history.map(h => ({ ...h, recordedAt: h.recordedAt.toISOString() })));
});

// POST /games/:id/add-player — creator sends an invitation to a user by userId (requires target's acceptance)
router.post("/games/:id/add-player", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }
  if (g.creatorUserId !== userId) { res.status(403).json({ error: "Only creator can invite players" }); return; }

  // Game must be open or in the future
  if (g.status !== "open" && g.status !== "full") {
    res.status(400).json({ error: "Cannot invite players to a game that is not open" }); return;
  }
  if (new Date(g.datetime) < new Date()) {
    res.status(400).json({ error: "Cannot invite players to a game that has already started" }); return;
  }

  const { targetUserId, targetUserName, team } = req.body as any;
  if (!targetUserId || !targetUserName) { res.status(400).json({ error: "targetUserId and targetUserName required" }); return; }

  // Creator cannot invite themselves (they are already joined)
  if (targetUserId === userId) {
    res.status(400).json({ error: "Creator is already in the game" }); return;
  }

  const [existing] = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, targetUserId)));
  if (existing) { res.status(400).json({ error: "Player already has a record in this game" }); return; }

  // Insert as "pending" with source="invite" — only the invited user can accept via accept-invite
  const [invite] = await db.insert(gameParticipantsTable).values({
    gameId: id,
    userId: targetUserId,
    userName: targetUserName,
    team: team ?? null,
    status: "pending",
    source: "invite",
  }).returning();

  // Notify the invited user so they can accept or decline
  const sportLabel = g.sport.replace(/_/g, " ");
  const gameDate = new Date(g.datetime).toLocaleDateString("lt-LT");
  await sendNotification(
    targetUserId,
    "game_join_request",
    `Kvietimas prisijungti prie žaidimo`,
    `${g.creatorName} kviečia jus žaisti ${sportLabel} ${gameDate} (${g.city}). Prisijunkite, kad patvirtintumėte.`,
    `/games/${id}`,
  );

  res.status(201).json({ ...formatParticipantWithId(invite), status: "pending" });
});

// POST /games/:id/accept-invite — invited user accepts a creator-sent invitation
router.post("/games/:id/accept-invite", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }

  if (g.status !== "open" && g.status !== "full") {
    res.status(400).json({ error: "Game is no longer accepting players" }); return;
  }
  if (new Date(g.datetime) < new Date()) {
    res.status(400).json({ error: "Game has already started" }); return;
  }

  // Find a creator-sent invite for THIS authenticated user — identity bound to session, not client body
  // Only source="invite" entries are accepted here; user-initiated join requests use approve-join
  const [invite] = await db.select().from(gameParticipantsTable)
    .where(and(
      eq(gameParticipantsTable.gameId, id),
      eq(gameParticipantsTable.userId, userId),
      eq(gameParticipantsTable.status, "pending"),
      eq(gameParticipantsTable.source, "invite"),
    ));
  if (!invite) { res.status(404).json({ error: "No pending invitation found for you in this game" }); return; }

  // Capacity check before accepting
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(countRow?.count ?? 0) >= g.playersNeeded) {
    res.status(400).json({ error: "Game is full — cannot accept invite" }); return;
  }

  await db.update(gameParticipantsTable)
    .set({ status: "joined" })
    .where(eq(gameParticipantsTable.id, invite.id));

  // Auto-close game if now full
  const [newCountRow] = await db.select({ count: sql<number>`count(*)` }).from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.status, "joined")));
  if (Number(newCountRow?.count ?? 0) >= g.playersNeeded) {
    await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, id));
  }

  res.json({ ok: true, status: "joined" });
});

// GET /games/:id/chat — get all chat messages (participants only)
router.get("/games/:id/chat", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }

  const isCreator = g.creatorUserId === userId;
  if (!isCreator) {
    const [participation] = await db.select().from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "joined")));
    if (!participation) { res.status(403).json({ error: "Only participants can view chat" }); return; }
  }

  const messages = await db.select().from(gameChatTable)
    .where(eq(gameChatTable.gameId, id))
    .orderBy(gameChatTable.createdAt);

  res.json(messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

// POST /games/:id/chat — send a message (participants only)
router.post("/games/:id/chat", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = getCurrentUserId(req)!;

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!g) { res.status(404).json({ error: "Game not found" }); return; }

  const isCreator = g.creatorUserId === userId;
  if (!isCreator) {
    const [participation] = await db.select().from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, id), eq(gameParticipantsTable.userId, userId), eq(gameParticipantsTable.status, "joined")));
    if (!participation) { res.status(403).json({ error: "Only participants can chat" }); return; }
  }

  const { senderName, body } = req.body ?? {};
  if (!senderName || !String(body ?? "").trim()) {
    res.status(400).json({ error: "senderName and body required" }); return;
  }

  const [msg] = await db.insert(gameChatTable).values({
    gameId: id,
    senderUserId: userId,
    senderName,
    body: String(body).trim(),
  }).returning();

  res.status(201).json({ ...msg, createdAt: msg.createdAt.toISOString() });
});

// ─── Host-Pays-All checkout: create pending booking + pending game, return Stripe URL ──
router.post("/games/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const {
    creatorName, creatorEmail, sport, city, placeName, playersNeeded, skillLevel,
    durationMinutes, description, isPrivate, matchType, requiresApproval, teamCount,
    courtId, bookingDate, bookingStart, bookingEnd, customerPhone,
    successUrl, cancelUrl,
  } = req.body ?? {};

  if (!creatorName || !creatorEmail || !sport || !city || !courtId || !bookingDate || !bookingStart || !bookingEnd || !successUrl || !cancelUrl) {
    res.status(400).json({ error: "Missing required fields (creatorName, creatorEmail, sport, city, courtId, bookingDate, bookingStart, bookingEnd, successUrl, cancelUrl)" });
    return;
  }

  const reqStartMin = toMin(bookingStart);
  const reqEndMin = toMin(bookingEnd);
  if (reqEndMin <= reqStartMin) {
    res.status(400).json({ error: "bookingEnd must be after bookingStart" }); return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, Number(courtId)));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const dayOfWeek = new Date(bookingDate + "T00:00:00").getDay();

  // Working-hours validation
  if (court.workingHours) {
    try {
      const wh = JSON.parse(court.workingHours) as Record<string, { open: string; close: string; closed: boolean }>;
      const dayConfig = wh[String(dayOfWeek)];
      if (dayConfig) {
        if (dayConfig.closed) { res.status(400).json({ error: "Court is closed on this day" }); return; }
        const openMin = toMin(dayConfig.open ?? "07:00");
        const closeMin = toMin(dayConfig.close ?? "22:00");
        if (reqStartMin < openMin || reqEndMin > closeMin) {
          res.status(400).json({ error: "Requested time is outside working hours" }); return;
        }
      }
    } catch { /* malformed wh JSON — skip */ }
  }

  // Server-side price (mirror bookings.ts)
  const pricingEntries = await db.select().from(courtPricingTable)
    .where(and(eq(courtPricingTable.courtId, Number(courtId)), eq(courtPricingTable.dayOfWeek, dayOfWeek)));
  const pricingMap = new Map(pricingEntries.map(e => [e.startTime, Number(e.price)]));
  const defaultSlotPrice = Number(court.pricePerHour) / 2;
  const peakSlotPrice = court.peakPricePerHour != null ? Number(court.peakPricePerHour) / 2 : null;
  let courtPrice = 0;
  for (const slotStart of slotsBetween(bookingStart, bookingEnd)) {
    if (pricingMap.has(slotStart)) courtPrice += pricingMap.get(slotStart)!;
    else if (peakSlotPrice != null && isPeakSlot(slotStart, dayOfWeek)) courtPrice += peakSlotPrice;
    else courtPrice += defaultSlotPrice;
  }

  // Atomic conflict check + double insert (booking + game), under per-(court,date) advisory lock
  type Inserted = { booking: typeof bookingsTable.$inferSelect; game: typeof gamesTable.$inferSelect };
  let inserted: Inserted;
  try {
    inserted = await db.transaction(async (tx) => {
      const dateInt = parseInt(bookingDate.replace(/-/g, ""), 10);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(courtId))}::int, ${sql.raw(String(dateInt))}::int)`);

      const [confirmedOrPending, blocked] = await Promise.all([
        tx.select({ startTime: bookingsTable.startTime, endTime: bookingsTable.endTime })
          .from(bookingsTable)
          .where(and(
            eq(bookingsTable.courtId, Number(courtId)),
            eq(bookingsTable.date, bookingDate),
            or(
              eq(bookingsTable.status, "confirmed"),
              eq(bookingsTable.status, "blocked"),
              and(eq(bookingsTable.status, "pending"), sql`${bookingsTable.createdAt} > NOW() - INTERVAL '15 minutes'`),
            ),
          )),
        tx.select({ startTime: courtBlockedSlotsTable.startTime, endTime: courtBlockedSlotsTable.endTime })
          .from(courtBlockedSlotsTable)
          .where(and(eq(courtBlockedSlotsTable.courtId, Number(courtId)), eq(courtBlockedSlotsTable.date, bookingDate))),
      ]);

      for (const b of confirmedOrPending) {
        if (reqStartMin < toMin(b.endTime) && reqEndMin > toMin(b.startTime)) {
          throw new Error("SLOT_UNAVAILABLE");
        }
      }
      for (const b of blocked) {
        if (reqStartMin < toMin(b.endTime) && reqEndMin > toMin(b.startTime)) {
          throw new Error("SLOT_BLOCKED");
        }
      }

      const [booking] = await tx.insert(bookingsTable).values({
        courtId: Number(courtId),
        bookerUserId: userId,
        customerName: creatorName,
        customerEmail: creatorEmail,
        customerPhone: customerPhone ?? null,
        date: bookingDate,
        startTime: bookingStart,
        endTime: bookingEnd,
        totalPrice: String(courtPrice),
        status: "pending",
      }).returning();

      const inviteToken = isPrivate ? crypto.randomBytes(16).toString("hex") : null;
      const datetimeIso = new Date(`${bookingDate}T${bookingStart}:00`).toISOString();
      const dur = reqEndMin - reqStartMin;

      const [game] = await tx.insert(gamesTable).values({
        creatorUserId: userId,
        creatorName,
        creatorEmail,
        sport,
        city,
        placeName: placeName ?? court.name,
        facilityId: court.facilityId ?? null,
        courtId: Number(courtId),
        bookingId: booking.id,
        playersNeeded: playersNeeded ?? 4,
        skillLevel: skillLevel ?? "any",
        datetime: datetimeIso,
        durationMinutes: durationMinutes ?? dur,
        description: description ?? null,
        isPrivate: !!isPrivate,
        requiresApproval: !!requiresApproval,
        teamCount: teamCount ? Math.max(2, Math.min(6, Number(teamCount))) : 2,
        inviteToken,
        status: "pending_payment",
        matchType: matchType === "rated" ? "rated" : "casual",
      }).returning();

      // Creator auto-joins (so they appear in the participants list once payment confirms)
      await tx.insert(gameParticipantsTable).values({
        gameId: game.id,
        userId,
        userName: creatorName,
        userEmail: creatorEmail,
        status: "joined",
        source: "join_request",
      });

      return { booking, game };
    });
  } catch (err: any) {
    if (err?.message === "SLOT_UNAVAILABLE") { res.status(409).json({ error: "Requested time slot is not available", code: "SLOT_UNAVAILABLE" }); return; }
    if (err?.message === "SLOT_BLOCKED") { res.status(409).json({ error: "Requested time slot is blocked", code: "SLOT_BLOCKED" }); return; }
    throw err;
  }

  // ─── Create Stripe checkout ──
  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    // No Stripe configured → mock-confirm immediately (dev mode)
    const mockSessionId = `mock_session_${inserted.booking.id}_${Date.now()}`;
    await db.update(bookingsTable).set({ stripeSessionId: mockSessionId, status: "confirmed" }).where(eq(bookingsTable.id, inserted.booking.id));
    await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, inserted.game.id));
    await db.update(courtsTable).set({ totalBookings: sql`total_bookings + 1` }).where(eq(courtsTable.id, Number(courtId)));
    res.json({ checkoutUrl: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id=${mockSessionId}`, gameId: inserted.game.id, bookingId: inserted.booking.id });
    return;
  }

  // Resolve Connect destination (court → facility → owner)
  let connectAccountId: string | null = court.stripeConnectAccountId ?? null;
  if (!connectAccountId && court.facilityId) {
    const [facility] = await db.select({ id: facilitiesTable.id, stripeConnectAccountId: facilitiesTable.stripeConnectAccountId })
      .from(facilitiesTable).where(eq(facilitiesTable.id, court.facilityId));
    connectAccountId = facility?.stripeConnectAccountId ?? null;
  }
  if (!connectAccountId && court.ownerUserId) {
    const [profile] = await db.select({ stripeAccountId: userProfilesTable.stripeAccountId, status: userProfilesTable.stripeAccountStatus })
      .from(userProfilesTable).where(eq(userProfilesTable.userId, court.ownerUserId));
    if (profile?.stripeAccountId && profile.status === "active") connectAccountId = profile.stripeAccountId;
  }

  const amountCents = Math.round(courtPrice * 100);
  const sessionParams: any = {
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: `${court.name} – žaidimas (${bookingDate} ${bookingStart}–${bookingEnd})`,
          description: `Korts.lt žaidimas — kūrėjas moka už visą aikštelę.`,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    mode: "payment",
    success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    // Stripe minimum is 30 minutes; our slot hold is 15 min and the cron sweeper
    // will release the booking + game well before this fires.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    metadata: { bookingId: String(inserted.booking.id), gameId: String(inserted.game.id) },
    customer_email: creatorEmail,
    locale: "lt",
  };
  if (connectAccountId) {
    const applicationFeeAmount = Math.round(amountCents * 5 / 100);
    sessionParams.payment_intent_data = { application_fee_amount: applicationFeeAmount, transfer_data: { destination: connectAccountId } };
  }

  // Compensating rollback: if Stripe session creation fails, delete the dangling
  // pending game + booking so we don't hold the slot until the 15-min sweeper.
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    req.log?.error?.({ err, bookingId: inserted.booking.id, gameId: inserted.game.id }, "stripe session create failed — rolling back");
    await db.delete(gamesTable).where(eq(gamesTable.id, inserted.game.id));
    await db.delete(bookingsTable).where(eq(bookingsTable.id, inserted.booking.id));
    res.status(502).json({ error: "Nepavyko sukurti mokėjimo sesijos. Bandykite dar kartą." });
    return;
  }
  await db.update(bookingsTable).set({ stripeSessionId: session.id }).where(eq(bookingsTable.id, inserted.booking.id));

  res.json({ checkoutUrl: session.url, gameId: inserted.game.id, bookingId: inserted.booking.id });
});

// ─── Exported helper: apply ELO for a confirmed result (used by /verify and the auto-confirm cron) ──
export async function applyResultElo(gameResultId: number): Promise<void> {
  const [result] = await db.select().from(gameResultsTable).where(eq(gameResultsTable.id, gameResultId));
  if (!result) return;
  if (result.status === "confirmed") return; // idempotent

  // Only the FIRST caller flips status (race between /verify-confirm and cron).
  const flipped = await db
    .update(gameResultsTable)
    .set({ status: "confirmed" })
    .where(and(eq(gameResultsTable.id, gameResultId), eq(gameResultsTable.status, "pending_verification")))
    .returning();
  if (flipped.length === 0) return; // somebody else already promoted

  await db.update(gamesTable).set({ status: "completed" }).where(eq(gamesTable.id, result.gameId));

  const [g] = await db.select().from(gamesTable).where(eq(gamesTable.id, result.gameId));
  if (!g || g.matchType !== "rated") return;

  const participants = await db.select().from(gameParticipantsTable)
    .where(and(eq(gameParticipantsTable.gameId, g.id), eq(gameParticipantsTable.status, "joined")));
  const teamAPlayers = participants.filter(p => p.team === "A");
  const teamBPlayers = participants.filter(p => p.team === "B");
  const unassigned = participants.filter(p => !p.team);
  const effectiveTeamA = teamAPlayers.length ? teamAPlayers : unassigned.slice(0, Math.ceil(unassigned.length / 2));
  const effectiveTeamB = teamBPlayers.length ? teamBPlayers : unassigned.slice(Math.ceil(unassigned.length / 2));

  const teamAWithElo = await Promise.all(effectiveTeamA.map(async p => ({ userId: p.userId, elo: (await getOrCreateRating(p.userId, g.sport)).elo })));
  const teamBWithElo = await Promise.all(effectiveTeamB.map(async p => ({ userId: p.userId, elo: (await getOrCreateRating(p.userId, g.sport)).elo })));

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

    await db.insert(eloHistoryTable).values({
      userId: change.userId,
      sportSlug: g.sport,
      elo: change.newElo,
      delta: change.delta,
      gameId: g.id,
    });

    const sign = change.delta > 0 ? "+" : "";
    await sendNotification(
      change.userId,
      "elo_update",
      `ELO pasikeitė: ${sign}${change.delta}`,
      `Žaidimas (${g.sport}) baigtas. Reitingas: ${change.oldElo} → ${change.newElo} (${sign}${change.delta}).`,
      `/games/${g.id}`,
    );
  }
}

// ─── Sweepers (called from cron) ──
export async function sweepStalePendingGames(): Promise<number> {
  // Find games stuck in pending_payment for > 15 min (Stripe abandoned/expired).
  const stale = await db.select({ id: gamesTable.id, bookingId: gamesTable.bookingId })
    .from(gamesTable)
    .where(and(
      eq(gamesTable.status, "pending_payment"),
      sql`${gamesTable.createdAt} < NOW() - INTERVAL '15 minutes'`,
    ));
  if (stale.length === 0) return 0;

  for (const row of stale) {
    if (row.bookingId) {
      await db.update(bookingsTable)
        .set({ status: "cancelled" })
        .where(and(eq(bookingsTable.id, row.bookingId), ne(bookingsTable.status, "confirmed")));
    }
    await db.delete(gamesTable).where(and(eq(gamesTable.id, row.id), eq(gamesTable.status, "pending_payment")));
  }
  return stale.length;
}

export async function sweepAutoConfirmResults(): Promise<number> {
  const due = await db.select({ id: gameResultsTable.id })
    .from(gameResultsTable)
    .where(and(
      eq(gameResultsTable.status, "pending_verification"),
      lt(gameResultsTable.autoConfirmAt, new Date()),
    ));
  for (const r of due) {
    try { await applyResultElo(r.id); }
    catch (err) { logger.error({ err, resultId: r.id }, "auto-confirm: applyResultElo failed"); }
  }
  return due.length;
}

export default router;
