import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, facilitiesTable, ownerEditRequestsTable } from "@workspace/db";
import { requireAuth, requireAdmin, getCurrentUserId } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const formatBizInfo = (f: typeof facilitiesTable.$inferSelect) => ({
  id: f.id,
  companyName: f.companyName ?? null,
  registrationCode: f.registrationCode ?? null,
  vatNumber: (f as any).vatNumber ?? null,
  websiteUrl: (f as any).websiteUrl ?? null,
  address: f.address ?? null,
  city: f.city ?? null,
  postcode: f.postcode ?? null,
  latitude: f.latitude ?? null,
  longitude: f.longitude ?? null,
  phone: f.phone ?? null,
  email: f.email ?? null,
  description: f.description ?? null,
});

router.get("/owner/business-info", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [facility] = await db
    .select()
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, userId))
    .limit(1);

  if (!facility) { res.status(404).json({ error: "No facility found" }); return; }

  const pendingEdits = await db
    .select()
    .from(ownerEditRequestsTable)
    .where(and(
      eq(ownerEditRequestsTable.ownerUserId, userId),
      eq(ownerEditRequestsTable.status, "pending"),
    ))
    .orderBy(desc(ownerEditRequestsTable.createdAt))
    .limit(1);

  res.json({
    ...formatBizInfo(facility),
    hasPendingEdit: pendingEdits.length > 0,
    pendingEdit: pendingEdits[0] ?? null,
  });
});

const PatchBizInfoBody = z.object({
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")),
  companyName: z.string().min(2).optional(),
  registrationCode: z.string().min(2).optional(),
  vatNumber: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  address: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  postcode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
});

router.patch("/owner/business-info", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = PatchBizInfoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [facility] = await db
    .select()
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, userId))
    .limit(1);
  if (!facility) { res.status(404).json({ error: "No facility found" }); return; }

  const { phone, email, ...reviewFields } = parsed.data;

  const directUpdates: Record<string, unknown> = {};
  if (phone !== undefined) directUpdates.phone = phone ?? null;
  if (email !== undefined) directUpdates.email = email ?? null;

  if (Object.keys(directUpdates).length > 0) {
    await db.update(facilitiesTable).set(directUpdates).where(eq(facilitiesTable.id, facility.id));
  }

  const reviewKeys = Object.keys(reviewFields).filter(k => reviewFields[k as keyof typeof reviewFields] !== undefined);
  if (reviewKeys.length > 0) {
    const requestedData: Record<string, unknown> = {};
    const currentData: Record<string, unknown> = {};
    for (const key of reviewKeys) {
      requestedData[key] = reviewFields[key as keyof typeof reviewFields];
      currentData[key] = (facility as any)[key] ?? null;
    }

    await db.insert(ownerEditRequestsTable).values({
      ownerUserId: userId,
      entityType: "owner_business",
      requestedData: JSON.stringify(requestedData),
      currentData: JSON.stringify(currentData),
      status: "pending",
    });
  }

  const [updated] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, facility.id));
  res.json({ ...formatBizInfo(updated!), directUpdated: Object.keys(directUpdates), reviewSubmitted: reviewKeys });
});

router.get("/admin/edit-requests", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(ownerEditRequestsTable)
    .orderBy(desc(ownerEditRequestsTable.createdAt));
  res.json(rows);
});

router.post("/admin/edit-requests/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [request] = await db.select().from(ownerEditRequestsTable).where(eq(ownerEditRequestsTable.id, id));
  if (!request || request.status !== "pending") {
    res.status(404).json({ error: "Not found or not pending" }); return;
  }

  let requestedData: Record<string, unknown> = {};
  try { requestedData = JSON.parse(request.requestedData); } catch { /**/ }

  const [facility] = await db
    .select()
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, request.ownerUserId))
    .limit(1);

  if (facility) {
    const allowedFields: (keyof typeof facilitiesTable.$inferSelect)[] = [
      "companyName", "registrationCode", "address", "city", "postcode",
      "latitude", "longitude", "description",
    ];
    const updateSet: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in requestedData) updateSet[key] = requestedData[key];
    }
    if ("vatNumber" in requestedData) updateSet.vatNumber = requestedData.vatNumber;
    if ("websiteUrl" in requestedData) updateSet.websiteUrl = requestedData.websiteUrl;
    if (Object.keys(updateSet).length > 0) {
      await db.update(facilitiesTable).set(updateSet).where(eq(facilitiesTable.id, facility.id));
    }
  }

  const [updated] = await db
    .update(ownerEditRequestsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(ownerEditRequestsTable.id, id))
    .returning();
  res.json(updated);
});

router.post("/admin/edit-requests/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { notes } = req.body;

  const [updated] = await db
    .update(ownerEditRequestsTable)
    .set({ status: "rejected", adminNotes: notes ?? null, updatedAt: new Date() })
    .where(and(eq(ownerEditRequestsTable.id, id), eq(ownerEditRequestsTable.status, "pending")))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found or not pending" }); return; }
  res.json(updated);
});

export default router;
