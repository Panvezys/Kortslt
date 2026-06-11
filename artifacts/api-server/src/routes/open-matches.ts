/**
 * Open Matches routes
 *
 * GET /api/matches/open — unified feed: split-payment booked matches + casual community games
 */
import { Router, type IRouter } from "express";
import { and, eq, gte, sql, inArray, isNull } from "drizzle-orm";
import {
  db,
  bookingsTable,
  courtsTable,
  facilitiesTable,
  gamesTable,
  gameParticipantsTable,
  userRatingsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/matches/open", async (req, res): Promise<void> => {
  try {
    const { sport, city, date, skillLevel, limit } = req.query as Record<string, string | undefined>;
    const maxRows = Math.min(parseInt(limit ?? "60", 10) || 60, 100);
    const userSkill = skillLevel != null && skillLevel !== "" ? parseFloat(skillLevel) : null;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const nowIso = new Date().toISOString();

    // ── 1. Booked matches (split-payment games linked to a real court booking) ──
    const bookedConditions: any[] = [
      eq(gamesTable.visibility, "public"),
      eq(gamesTable.status, "awaiting_players"),
      gte(bookingsTable.date, today),
    ];
    if (sport && sport !== "all") bookedConditions.push(eq(gamesTable.sport, sport));
    if (city) bookedConditions.push(eq(gamesTable.city, city));

    const bookedRows = await db
      .select({
        game: gamesTable,
        booking: bookingsTable,
        court: courtsTable,
        facility: facilitiesTable,
      })
      .from(gamesTable)
      .innerJoin(bookingsTable, eq(gamesTable.bookingId, bookingsTable.id))
      .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
      .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
      .where(and(...bookedConditions))
      .orderBy(bookingsTable.date, bookingsTable.startTime)
      .limit(maxRows);

    // ── 2. Casual community games (no court booking) ──
    // isPrivate is the authoritative privacy field; visibility may be stale on older rows.
    const casualConditions: any[] = [
      eq(gamesTable.status, "open"),
      eq(gamesTable.isPrivate, false),
      isNull(gamesTable.bookingId),
      gte(gamesTable.datetime, nowIso),
    ];
    if (sport && sport !== "all") casualConditions.push(eq(gamesTable.sport, sport));
    if (city) casualConditions.push(eq(gamesTable.city, city));

    const casualRows = await db
      .select({ game: gamesTable })
      .from(gamesTable)
      .where(and(...casualConditions))
      .orderBy(gamesTable.datetime)
      .limit(maxRows);

    // ── 3. Apply date filter ──
    let filteredBooked = bookedRows;
    let filteredCasual = casualRows;
    if (date) {
      filteredBooked = bookedRows.filter(r => r.booking.date === date);
      filteredCasual = casualRows.filter(r => String(r.game.datetime).startsWith(date));
    }

    // ── 4. Apply optional skill filter to booked matches ──
    if (userSkill != null && !isNaN(userSkill)) {
      filteredBooked = filteredBooked.filter(r => {
        const min = r.game.minSkillLevel;
        const max = r.game.maxSkillLevel;
        if (min != null && userSkill < min) return false;
        if (max != null && userSkill > max) return false;
        return true;
      });
    }

    // ── 5. Fetch creator ELO ratings per sport ──
    const creatorSportPairs = [
      ...filteredBooked.map(r => ({ userId: r.game.creatorUserId, sport: r.game.sport })),
      ...filteredCasual.map(r => ({ userId: r.game.creatorUserId, sport: r.game.sport })),
    ];
    const uniqueCreatorIds = [...new Set(creatorSportPairs.map(p => p.userId))];
    const creatorEloMap = new Map<string, number>(); // key: "userId::sport"
    if (uniqueCreatorIds.length > 0) {
      const ratingRows = await db
        .select({ userId: userRatingsTable.userId, sportSlug: userRatingsTable.sportSlug, elo: userRatingsTable.elo })
        .from(userRatingsTable)
        .where(inArray(userRatingsTable.userId, uniqueCreatorIds));
      for (const r of ratingRows) creatorEloMap.set(`${r.userId}::${r.sportSlug}`, r.elo);
    }

    // ── 7. Aggregate participant counts for all games ──
    const allGameIds = [
      ...filteredBooked.map(r => r.game.id),
      ...filteredCasual.map(r => r.game.id),
    ];
    const participantCounts = new Map<number, { paid: number; pending: number; joined: number }>();

    if (allGameIds.length > 0) {
      const participantRows = await db
        .select({
          gameId: gameParticipantsTable.gameId,
          paymentStatus: gameParticipantsTable.paymentStatus,
          count: sql<string>`count(*)`,
        })
        .from(gameParticipantsTable)
        .where(and(
          eq(gameParticipantsTable.status, "joined"),
          inArray(gameParticipantsTable.gameId, allGameIds),
        ))
        .groupBy(gameParticipantsTable.gameId, gameParticipantsTable.paymentStatus);

      for (const row of participantRows) {
        const existing = participantCounts.get(row.gameId) ?? { paid: 0, pending: 0, joined: 0 };
        const c = parseInt(row.count, 10);
        if (row.paymentStatus === "paid") existing.paid += c;
        else existing.pending += c;
        existing.joined += c;
        participantCounts.set(row.gameId, existing);
      }
    }

    // ── 8. Build booked match items ──
    const bookedItems = filteredBooked.map(r => {
      const { game, booking, court, facility } = r;
      const counts = participantCounts.get(game.id) ?? { paid: 0, pending: 0, joined: 0 };
      const total = booking.totalSlots ?? game.playersNeeded;
      const slotsLeft = Math.max(0, total - counts.paid - counts.pending);
      const datetime = `${booking.date}T${booking.startTime}:00`;
      return {
        kind: "booked" as const,
        gameId: game.id,
        sport: game.sport,
        matchType: game.matchType,
        visibility: game.visibility,
        creatorName: game.creatorName,
        creatorUserId: game.creatorUserId,
        description: game.description ?? null,
        datetime,
        minSkillLevel: game.minSkillLevel ?? null,
        maxSkillLevel: game.maxSkillLevel ?? null,
        // Booked-only
        bookingId: booking.id,
        token: booking.splitInviteToken ?? null,
        courtName: court?.name ?? "",
        courtId: court?.id ?? null,
        courtType: court?.type ?? null,
        facilityId: court?.facilityId ?? null,
        facilityName: facility?.name ?? "",
        facilityCity: facility?.city ?? "",
        courtImageUrl: court?.imageUrl ?? null,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        pricePerSlot: Number(booking.pricePerSlot ?? 0),
        totalPrice: Number(booking.totalPrice),
        totalSlots: total,
        paidSlots: counts.paid,
        slotsLeft,
        lat: facility?.latitude ?? null,
        lng: facility?.longitude ?? null,
        // Casual-only (null for booked)
        city: facility?.city ?? null,
        placeName: null as string | null,
        skillLevel: null as string | null,
        durationMinutes: null as number | null,
        joinedCount: null as number | null,
        playersNeeded: null as number | null,
        isPrivate: false,
        creatorElo: creatorEloMap.get(`${game.creatorUserId}::${game.sport}`) ?? null,
        createdAt: game.createdAt.toISOString(),
      };
    });

    // ── 9. Build casual game items ──
    const casualItems = filteredCasual.map(r => {
      const { game } = r;
      const counts = participantCounts.get(game.id) ?? { paid: 0, pending: 0, joined: 0 };
      const slotsLeft = Math.max(0, (game.playersNeeded ?? 2) - counts.joined);
      return {
        kind: "casual" as const,
        gameId: game.id,
        sport: game.sport,
        matchType: game.matchType,
        visibility: game.visibility,
        creatorName: game.creatorName,
        creatorUserId: game.creatorUserId,
        description: game.description ?? null,
        datetime: String(game.datetime),
        minSkillLevel: game.minSkillLevel ?? null,
        maxSkillLevel: game.maxSkillLevel ?? null,
        // Booked-only (null for casual)
        bookingId: null as number | null,
        token: null as string | null,
        courtName: null as string | null,
        courtId: null as number | null,
        courtType: null as string | null,
        facilityId: null as number | null,
        facilityName: null as string | null,
        facilityCity: null as string | null,
        courtImageUrl: null as string | null,
        date: null as string | null,
        startTime: null as string | null,
        endTime: null as string | null,
        pricePerSlot: null as number | null,
        totalPrice: null as number | null,
        totalSlots: null as number | null,
        paidSlots: null as number | null,
        slotsLeft,
        // Casual-only
        city: game.city ?? null,
        placeName: game.placeName ?? null,
        skillLevel: game.skillLevel ?? null,
        durationMinutes: game.durationMinutes ?? null,
        joinedCount: counts.joined,
        playersNeeded: game.playersNeeded ?? null,
        isPrivate: game.isPrivate ?? false,
        lat: null as number | null,
        lng: null as number | null,
        creatorElo: creatorEloMap.get(`${game.creatorUserId}::${game.sport}`) ?? null,
        createdAt: game.createdAt.toISOString(),
      };
    });

    // ── 10. Merge and sort by datetime ascending ──
    const allItems = [...bookedItems, ...casualItems].sort((a, b) =>
      new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );

    res.json({ matches: allItems, total: allItems.length });
  } catch (err) {
    logger.error({ err }, "GET /api/matches/open failed");
    res.status(500).json({ error: "Nepavyko gauti mačų sąrašo" });
  }
});

export default router;
