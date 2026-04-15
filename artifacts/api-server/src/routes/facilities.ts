import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, facilitiesTable } from "@workspace/db";
import { CreateFacilityBody, UpdateFacilityParams, UpdateFacilityBody, DeleteFacilityParams } from "@workspace/api-zod";
import { requireAuth, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

router.get("/facilities", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db.select().from(facilitiesTable).where(eq(facilitiesTable.ownerUserId, userId));
  res.json(rows.map(f => ({ ...f, description: f.description ?? undefined })));
});

router.post("/facilities", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateFacilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [facility] = await db
    .insert(facilitiesTable)
    .values({ ...parsed.data, ownerUserId: userId })
    .returning();
  res.status(201).json({ ...facility, description: facility.description ?? undefined });
});

router.put("/facilities/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = UpdateFacilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateFacilityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, params.data.id));
  if (!existing || existing.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [facility] = await db
    .update(facilitiesTable)
    .set(body.data)
    .where(eq(facilitiesTable.id, params.data.id))
    .returning();
  res.json({ ...facility, description: facility.description ?? undefined });
});

router.delete("/facilities/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = DeleteFacilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, params.data.id));
  if (!existing || existing.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(facilitiesTable).where(eq(facilitiesTable.id, params.data.id));
  res.status(204).send();
});

export default router;
