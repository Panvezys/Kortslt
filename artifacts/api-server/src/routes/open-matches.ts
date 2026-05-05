/**
 * Open Matches routes
 *
 * GET /api/matches/open — public feed of split bookings with visibility='public'
 */
import { Router, type IRouter } from "express";
import { and, eq, sql, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  courtsTable,
  facilitiesTable,
  gamesTable,
  gameParticipantsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/matches/open", async (req, res): Promise<void> => {
  try {
    const { sport, city, date, skillLevel, limit } = req.query as Record<string, string | undefined>;
    const maxRows = Math.min(parseInt(limit ?? "60", 10) || 60, 100);
    const userSkill = skillLevel != null && skillLevel !== "" ? parseFloat(skillLevel) : null;

    const conditions: ReturnType<typeof eq>[] = [
      eq(gamesTable.visibility, "public"),
      eq(gamesTable.status, "awaiting_players"),
    ];

    if (sport && sport !== "all") conditions.push(eq(gamesTable.sport, sport) as any);
    if (city) conditions.push(eq(gamesTable.city, city) as any);

    const rows = await db
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
      .where(and(...(conditions as any[])))
      .orderBy(bookingsTable.date, bookingsTable.startTime)
      .limit(maxRows);

    // Apply date filter (bookings.date is a text column YYYY-MM-DD)
    let filtered = rows;
    if (date) filtered = rows.filter(r => r.booking.date === date);

    // Apply optional skill-level filter
    if (userSkill != null && !isNaN(userSkill)) {
      filtered = filtered.filter(r => {
        const min = r.game.minSkillLevel;
        const max = r.game.maxSkillLevel;
        if (min != null && userSkill < min) return false;
        if (max != null && userSkill > max) return false;
        return true;
      });
    }

    // Aggregate participant counts per game
    const gameIds = filtered.map(r => r.game.id);
    const participantCounts = new Map<number, { paid: number; pending: number }>();

    if (gameIds.length > 0) {
      const participantRows = await db
        .select({
          gameId: gameParticipantsTable.gameId,
          paymentStatus: gameParticipantsTable.paymentStatus,
          count: sql<string>`count(*)`,
        })
        .from(gameParticipantsTable)
        .where(and(
          eq(gameParticipantsTable.status, "joined"),
          inArray(gameParticipantsTable.gameId, gameIds),
        ))
        .groupBy(gameParticipantsTable.gameId, gameParticipantsTable.paymentStatus);

      for (const row of participantRows) {
        const existing = participantCounts.get(row.gameId) ?? { paid: 0, pending: 0 };
        const c = parseInt(row.count, 10);
        if (row.paymentStatus === "paid") existing.paid += c;
        else existing.pending += c;
        participantCounts.set(row.gameId, existing);
      }
    }

    const result = filtered.map(r => {
      const { game, booking, court, facility } = r;
      const counts = participantCounts.get(game.id) ?? { paid: 0, pending: 0 };
      const total = booking.totalSlots ?? game.playersNeeded;
      const slotsLeft = Math.max(0, total - counts.paid - counts.pending);
      return {
        gameId: game.id,
        bookingId: booking.id,
        token: booking.splitInviteToken ?? null,
        courtName: court?.name ?? "",
        courtId: court?.id ?? null,
        facilityName: facility?.name ?? "",
        facilityCity: facility?.city ?? "",
        courtImageUrl: court?.imageUrl ?? null,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        sport: game.sport,
        matchType: game.matchType,
        visibility: game.visibility,
        minSkillLevel: game.minSkillLevel ?? null,
        maxSkillLevel: game.maxSkillLevel ?? null,
        pricePerSlot: Number(booking.pricePerSlot ?? 0),
        totalPrice: Number(booking.totalPrice),
        totalSlots: total,
        paidSlots: counts.paid,
        slotsLeft,
        creatorName: game.creatorName,
        creatorUserId: game.creatorUserId,
        description: game.description ?? null,
        datetime: game.datetime,
        createdAt: game.createdAt.toISOString(),
      };
    });

    res.json({ matches: result, total: result.length });
  } catch (err) {
    logger.error({ err }, "GET /api/matches/open failed");
    res.status(500).json({ error: "Nepavyko gauti mačų sąrašo" });
  }
});

export default router;
