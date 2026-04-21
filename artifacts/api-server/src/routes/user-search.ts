import { Router } from "express";
import { ilike, or } from "drizzle-orm";
import { db, gameParticipantsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/users/search", requireAuth, async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  const results = await db
    .selectDistinctOn([gameParticipantsTable.userId], {
      userId: gameParticipantsTable.userId,
      userName: gameParticipantsTable.userName,
      userEmail: gameParticipantsTable.userEmail,
    })
    .from(gameParticipantsTable)
    .where(or(
      ilike(gameParticipantsTable.userName, `%${q}%`),
      ilike(gameParticipantsTable.userEmail, `%${q}%`),
    ))
    .limit(10);

  res.json(results);
});

export default router;
