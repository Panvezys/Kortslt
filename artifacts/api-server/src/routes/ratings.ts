import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, userRatingsTable, sportsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import { eloTier } from "../lib/elo";

const router: IRouter = Router();

function formatRating(r: typeof userRatingsTable.$inferSelect) {
  return {
    ...r,
    tier: eloTier(r.elo),
  };
}

/** GET /user-ratings/me — current user's ratings */
router.get("/user-ratings/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(userRatingsTable)
    .where(eq(userRatingsTable.userId, userId));

  res.json(rows.map(formatRating));
});

/** GET /user-ratings/:userId — public ratings for a user */
router.get("/user-ratings/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const rows = await db
    .select()
    .from(userRatingsTable)
    .where(eq(userRatingsTable.userId, userId));

  res.json(rows.map(formatRating));
});

/** GET /leaderboard/:sportSlug — top 50 players for a sport */
router.get("/leaderboard/:sportSlug", async (req, res): Promise<void> => {
  const { sportSlug } = req.params;
  const rows = await db
    .select()
    .from(userRatingsTable)
    .where(eq(userRatingsTable.sportSlug, sportSlug))
    .orderBy(userRatingsTable.elo)
    .limit(50);

  res.json(rows.map(formatRating).sort((a, b) => b.elo - a.elo));
});

/** POST /user-ratings/ensure — create default ratings for current user */
router.post("/user-ratings/ensure", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { sportSlug } = req.body as { sportSlug?: string };
  if (!sportSlug) { res.status(400).json({ error: "sportSlug required" }); return; }

  const [existing] = await db
    .select()
    .from(userRatingsTable)
    .where(and(eq(userRatingsTable.userId, userId), eq(userRatingsTable.sportSlug, sportSlug)));

  if (existing) { res.json(formatRating(existing)); return; }

  const [row] = await db.insert(userRatingsTable).values({ userId, sportSlug }).returning();
  res.status(201).json(formatRating(row));
});

export default router;
