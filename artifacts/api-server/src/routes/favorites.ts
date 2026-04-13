import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, favoritesTable, courtsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/favorites", async (req, res): Promise<void> => {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const rows = await db
    .select({ courtId: favoritesTable.courtId })
    .from(favoritesTable)
    .where(eq(favoritesTable.userId, userId));

  const courtIds = rows.map(r => r.courtId);

  if (courtIds.length === 0) {
    res.json([]);
    return;
  }

  const courts = await db
    .select()
    .from(courtsTable)
    .where(inArray(courtsTable.id, courtIds));

  res.json(courts.map(c => ({
    ...c,
    pricePerHour: Number(c.pricePerHour),
    amenities: c.amenities ?? [],
    openingHours: c.openingHours ?? [],
  })));
});

router.post("/favorites/:courtId", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.courtId, 10);
  const { userId } = req.body;

  if (isNaN(courtId)) {
    res.status(400).json({ error: "Invalid courtId" });
    return;
  }
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  await db
    .insert(favoritesTable)
    .values({ userId, courtId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

router.delete("/favorites/:courtId", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.courtId, 10);
  const { userId } = req.query;

  if (isNaN(courtId)) {
    res.status(400).json({ error: "Invalid courtId" });
    return;
  }
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  await db
    .delete(favoritesTable)
    .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.courtId, courtId)));

  res.json({ ok: true });
});

export default router;
