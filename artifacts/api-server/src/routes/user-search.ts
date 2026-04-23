import { Router } from "express";
import { ilike, inArray, and, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, gameParticipantsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, getUserRole } from "../lib/auth";

const router = Router();

router.get("/users/search", requireAuth, async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  const currentUserId = getCurrentUserId(req)!;
  const role = await getUserRole(currentUserId);

  if (role === "owner" || role === "admin") {
    // Elevated roles can search broadly (needed for coach invite flows), but
    // email is still never returned.
    const results = await db
      .selectDistinctOn([gameParticipantsTable.userId], {
        userId: gameParticipantsTable.userId,
        userName: gameParticipantsTable.userName,
      })
      .from(gameParticipantsTable)
      .where(
        and(
          ilike(gameParticipantsTable.userName, `%${q}%`),
          ne(gameParticipantsTable.userId, currentUserId),
        ),
      )
      .limit(10);

    res.json(results);
    return;
  }

  // For plain players: only surface users who already share a game with the
  // requester. This prevents global participant-table enumeration by
  // low-privilege accounts.
  const sharedGameIds = db
    .select({ gameId: gameParticipantsTable.gameId })
    .from(gameParticipantsTable)
    .where(sql`${gameParticipantsTable.userId} = ${currentUserId}`);

  const results = await db
    .selectDistinctOn([gameParticipantsTable.userId], {
      userId: gameParticipantsTable.userId,
      userName: gameParticipantsTable.userName,
    })
    .from(gameParticipantsTable)
    .where(
      and(
        ilike(gameParticipantsTable.userName, `%${q}%`),
        inArray(gameParticipantsTable.gameId, sharedGameIds),
        ne(gameParticipantsTable.userId, currentUserId),
      ),
    )
    .limit(10);

  res.json(results);
});

export default router;
