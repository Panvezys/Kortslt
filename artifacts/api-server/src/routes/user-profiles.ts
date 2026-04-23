import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  userProfilesTable,
  userSportProfilesTable,
  gameParticipantsTable,
  gamesTable,
  userRatingsTable,
  bookingsTable,
  courtsTable,
} from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

// Compute per-sport game + booking stats for a userId
async function computeSportStats(userId: string, email?: string) {
  const gameRows = await db
    .select({
      sport: gamesTable.sport,
      gamesPlayed: sql<number>`count(*)`,
      minutesPlayed: sql<number>`coalesce(sum(${gamesTable.durationMinutes}), 0)`,
    })
    .from(gameParticipantsTable)
    .innerJoin(gamesTable, eq(gameParticipantsTable.gameId, gamesTable.id))
    .where(eq(gameParticipantsTable.userId, userId))
    .groupBy(gamesTable.sport);

  const sportMap = new Map<string, { gamesPlayed: number; gameHours: number; bookingHours: number }>();
  for (const r of gameRows) {
    const gameHours = Math.round((Number(r.minutesPlayed) / 60) * 10) / 10;
    sportMap.set(r.sport, { gamesPlayed: Number(r.gamesPlayed), gameHours, bookingHours: 0 });
  }

  if (email) {
    const bookingRows = await db
      .select({
        sport: courtsTable.type,
        bookingHours: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (${bookingsTable.endTime}::time - ${bookingsTable.startTime}::time)) / 3600), 0)`,
      })
      .from(bookingsTable)
      .innerJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
      .where(and(eq(bookingsTable.customerEmail, email), eq(bookingsTable.status, "confirmed")))
      .groupBy(courtsTable.type);

    for (const b of bookingRows) {
      const bHours = Math.round(Number(b.bookingHours) * 10) / 10;
      if (sportMap.has(b.sport)) {
        sportMap.get(b.sport)!.bookingHours = bHours;
      } else {
        sportMap.set(b.sport, { gamesPlayed: 0, gameHours: 0, bookingHours: bHours });
      }
    }
  }

  return [...sportMap.entries()].map(([sport, v]) => ({
    sport,
    gamesPlayed: v.gamesPlayed,
    hoursPlayed: Math.round((v.gameHours + v.bookingHours) * 10) / 10,
    gameHours: v.gameHours,
    bookingHours: v.bookingHours,
  }));
}

// GET /user-profiles/batch?ids=id1,id2,id3 — avatar lookup for multiple users
router.get("/user-profiles/batch", async (req, res): Promise<void> => {
  const ids = ((req.query.ids as string) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) { res.json({}); return; }

  const profiles = await db
    .select({ userId: userProfilesTable.userId, imageUrl: userProfilesTable.imageUrl })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.userId, ids));

  const result: Record<string, string | null> = {};
  for (const id of ids) result[id] = null;
  for (const p of profiles) result[p.userId] = p.imageUrl;

  res.json(result);
});

// GET /user-profiles/:userId — public profile card
router.get("/user-profiles/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  const sportProfiles = await db
    .select()
    .from(userSportProfilesTable)
    .where(eq(userSportProfilesTable.userId, userId));

  const activityPublic = profile?.activityPublic ?? true;
  let stats: { sport: string; gamesPlayed: number; hoursPlayed: number }[] = [];
  if (activityPublic) {
    stats = await computeSportStats(userId);
  }

  res.json({
    userId,
    activityPublic,
    bio: profile?.bio ?? null,
    imageUrl: profile?.imageUrl ?? null,
    sportProfiles: sportProfiles.map((sp) => ({
      sport: sp.sport,
      level: sp.level,
    })),
    stats,
  });
});

// GET /user-profiles/me/full — own full profile (private)
router.get("/user-profiles/me/full", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  // Fetch the authenticated user's primary email server-side; never trust a
  // caller-supplied email parameter (would allow enumerating other users' data).
  let email: string | undefined;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
  } catch (err) {
    // Clerk lookup failed; proceed without booking stats but log for observability
    console.error("[user-profiles] Failed to fetch Clerk user for booking stats", { userId, err });
  }

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  const sportProfiles = await db
    .select()
    .from(userSportProfilesTable)
    .where(eq(userSportProfilesTable.userId, userId));

  const stats = await computeSportStats(userId, email);
  const ratings = await db.select().from(userRatingsTable).where(eq(userRatingsTable.userId, userId));

  res.json({
    userId,
    activityPublic: profile?.activityPublic ?? true,
    bio: profile?.bio ?? null,
    imageUrl: profile?.imageUrl ?? null,
    sportProfiles: sportProfiles.map((sp) => ({
      sport: sp.sport,
      level: sp.level,
    })),
    stats,
    ratings: ratings.map(r => ({
      sport: r.sportSlug,
      elo: r.elo,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
    })),
  });
});

// PUT /user-profiles/me/settings — update activityPublic + bio
router.put("/user-profiles/me/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { activityPublic, bio } = req.body ?? {};

  await db
    .insert(userProfilesTable)
    .values({ userId, activityPublic: activityPublic ?? true, bio: bio ?? null })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: {
        activityPublic: activityPublic ?? true,
        bio: bio ?? null,
        updatedAt: new Date(),
      },
    });

  res.json({ ok: true });
});

// PUT /user-profiles/me/image — sync imageUrl from Clerk (called on page load)
router.put("/user-profiles/me/image", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { imageUrl } = req.body ?? {};
  if (!imageUrl) { res.status(400).json({ error: "imageUrl required" }); return; }

  await db
    .insert(userProfilesTable)
    .values({ userId, imageUrl })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: { imageUrl, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

// PUT /user-profiles/me/sports — upsert a sport level
router.put("/user-profiles/me/sports", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { sport, level } = req.body ?? {};
  if (!sport || !level) { res.status(400).json({ error: "sport and level required" }); return; }

  await db
    .insert(userSportProfilesTable)
    .values({ userId, sport, level })
    .onConflictDoUpdate({
      target: [userSportProfilesTable.userId, userSportProfilesTable.sport],
      set: { level, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

// DELETE /user-profiles/me/sports/:sport — remove a sport
router.delete("/user-profiles/me/sports/:sport", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { sport } = req.params;

  await db
    .delete(userSportProfilesTable)
    .where(
      and(
        eq(userSportProfilesTable.userId, userId),
        eq(userSportProfilesTable.sport, sport),
      ),
    );

  res.json({ ok: true });
});

export default router;
