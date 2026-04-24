import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, facilitiesTable, courtsTable } from "@workspace/db";
import { CreateFacilityBody, UpdateFacilityParams, UpdateFacilityBody, DeleteFacilityParams } from "@workspace/api-zod";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import { sendAdminNotification } from "../lib/notify";

const router: IRouter = Router();

router.get("/facilities", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db.select().from(facilitiesTable).where(eq(facilitiesTable.ownerUserId, userId));

  const facilitiesWithCourts = await Promise.all(
    rows.map(async (f) => {
      const courts = await db
        .select({
          id: courtsTable.id,
          name: courtsTable.name,
          type: courtsTable.type,
          status: courtsTable.status,
          pricePerHour: courtsTable.pricePerHour,
          city: courtsTable.city,
          address: courtsTable.address,
          imageUrl: courtsTable.imageUrl,
          isIndoor: courtsTable.isIndoor,
          rating: courtsTable.rating,
        })
        .from(courtsTable)
        .where(eq(courtsTable.facilityId, f.id));

      const sportTypes = [...new Set(courts.map(c => c.type))];

      return {
        ...f,
        description: f.description ?? undefined,
        courtCount: courts.length,
        sportTypes,
        courts,
      };
    })
  );

  res.json(facilitiesWithCourts);
});

router.get("/facilities/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid facility ID" });
    return;
  }

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, id));
  if (!facility || facility.ownerUserId !== userId) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const courts = await db.select().from(courtsTable).where(eq(courtsTable.facilityId, facility.id));
  const sportTypes = [...new Set(courts.map(c => c.type))];

  res.json({
    ...facility,
    description: facility.description ?? undefined,
    courtCount: courts.length,
    sportTypes,
    courts,
  });
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

  await sendAdminNotification(
    "Naujas objektas laukia patvirtinimo",
    `„${facility.name}" (${facility.city ?? "—"}) pateiktas peržiūrai.`,
    "/admin",
  );

  res.status(201).json({ ...facility, description: facility.description ?? undefined, courtCount: 0, sportTypes: [], courts: [] });
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
