import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, courtsTable, courtBlockedSlotsTable } from "@workspace/db";
import { requireAuth, isOwner } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

/** GET /courts/:id/blocked-slots?date=YYYY-MM-DD */
router.get("/courts/:id/blocked-slots", async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  let query = db
    .select()
    .from(courtBlockedSlotsTable)
    .where(eq(courtBlockedSlotsTable.courtId, courtId))
    .$dynamic();

  if (req.query.date) {
    query = query.where(
      and(
        eq(courtBlockedSlotsTable.courtId, courtId),
        eq(courtBlockedSlotsTable.date, String(req.query.date))
      )
    );
  }

  const slots = await query;
  res.json(slots);
});

const BlockSlotBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().optional(),
});

/** POST /courts/:id/blocked-slots — owner only */
router.post("/courts/:id/blocked-slots", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const parsed = BlockSlotBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  if (!isOwner(req, court.ownerUserId)) {
    res.status(403).json({ error: "Forbidden – you do not own this court" });
    return;
  }

  const [slot] = await db
    .insert(courtBlockedSlotsTable)
    .values({ courtId, ...parsed.data })
    .returning();

  res.status(201).json(slot);
});

/** DELETE /courts/:id/blocked-slots/:slotId — owner only */
router.delete("/courts/:id/blocked-slots/:slotId", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  const slotId = Number(req.params.slotId);
  if (isNaN(courtId) || isNaN(slotId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  if (!isOwner(req, court.ownerUserId)) {
    res.status(403).json({ error: "Forbidden – you do not own this court" });
    return;
  }

  const [deleted] = await db
    .delete(courtBlockedSlotsTable)
    .where(
      and(
        eq(courtBlockedSlotsTable.id, slotId),
        eq(courtBlockedSlotsTable.courtId, courtId)
      )
    )
    .returning();

  if (!deleted) { res.status(404).json({ error: "Slot not found" }); return; }
  res.json({ deleted: true });
});

export default router;
