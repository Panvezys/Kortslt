import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, courtsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

/** GET /admin/courts — all courts with any status, newest first */
router.get("/admin/courts", requireAdmin, async (_req, res): Promise<void> => {
  const courts = await db
    .select()
    .from(courtsTable)
    .orderBy(desc(courtsTable.createdAt));

  res.json(
    courts.map((c) => ({
      ...c,
      pricePerHour: Number(c.pricePerHour),
      description: c.description ?? undefined,
      imageUrl: c.imageUrl ?? undefined,
      rating: c.rating ?? undefined,
      surface: c.surface ?? undefined,
      phone: c.phone ?? undefined,
      openingHours: c.openingHours ?? undefined,
      ownerUserId: c.ownerUserId ?? undefined,
      ownershipDocUrl: c.ownershipDocUrl ?? undefined,
      rejectionReason: c.rejectionReason ?? undefined,
    }))
  );
});

/** PUT /admin/courts/:id/approve */
router.put("/admin/courts/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [court] = await db
    .update(courtsTable)
    .set({ status: "approved", rejectionReason: null })
    .where(eq(courtsTable.id, id))
    .returning();

  if (!court) { res.status(404).json({ error: "Court not found" }); return; }
  res.json({ id: court.id, status: court.status });
});

/** PUT /admin/courts/:id/reject */
const RejectBody = z.object({ reason: z.string().optional() });

router.put("/admin/courts/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = RejectBody.safeParse(req.body);
  const reason = body.success ? (body.data.reason ?? null) : null;

  const [court] = await db
    .update(courtsTable)
    .set({ status: "rejected", rejectionReason: reason })
    .where(eq(courtsTable.id, id))
    .returning();

  if (!court) { res.status(404).json({ error: "Court not found" }); return; }
  res.json({ id: court.id, status: court.status, rejectionReason: court.rejectionReason });
});

export default router;
