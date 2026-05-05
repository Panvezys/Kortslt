import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, courtMembershipsTable, userMembershipsTable, courtsTable, facilitiesTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner } from "../lib/auth";

const router = Router();

router.get("/courts/:id/memberships", async (req, res): Promise<void> => {
  const courtId = parseInt(String(req.params.id));
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const plans = await db.select().from(courtMembershipsTable)
    .where(and(eq(courtMembershipsTable.courtId, courtId), eq(courtMembershipsTable.isActive, true)));
  res.json(plans);
});

router.post("/courts/:id/memberships", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(String(req.params.id));
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Not found" }); return; }
  const [mbFacility] = await db.select({ ownerUserId: facilitiesTable.ownerUserId }).from(facilitiesTable).where(eq(facilitiesTable.id, court.facilityId));
  if (!(await isOwner(req, mbFacility?.ownerUserId ?? null))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, description, pricePerYear, weeklySlots } = req.body as any;
  if (!name || !pricePerYear) { res.status(400).json({ error: "name and pricePerYear required" }); return; }
  const [plan] = await db.insert(courtMembershipsTable).values({ courtId, name, description, pricePerYear: Number(pricePerYear), weeklySlots: Number(weeklySlots ?? 1) }).returning();
  res.status(201).json(plan);
});

router.patch("/courts/:id/memberships/:planId", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(String(req.params.id));
  const planId = parseInt(String(req.params.planId));
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Not found" }); return; }
  const [mbFacility2] = await db.select({ ownerUserId: facilitiesTable.ownerUserId }).from(facilitiesTable).where(eq(facilitiesTable.id, court.facilityId));
  if (!(await isOwner(req, mbFacility2?.ownerUserId ?? null))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [plan] = await db.select().from(courtMembershipsTable).where(and(eq(courtMembershipsTable.id, planId), eq(courtMembershipsTable.courtId, courtId)));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  const { name, description, pricePerYear, weeklySlots, isActive } = req.body as any;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (pricePerYear !== undefined) update.pricePerYear = Number(pricePerYear);
  if (weeklySlots !== undefined) update.weeklySlots = Number(weeklySlots);
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  const [updated] = await db.update(courtMembershipsTable).set(update).where(and(eq(courtMembershipsTable.id, planId), eq(courtMembershipsTable.courtId, courtId))).returning();
  res.json(updated);
});

router.post("/courts/:id/memberships/:planId/subscribe", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(String(req.params.id));
  const planId = parseInt(String(req.params.planId));
  const userId = await getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [plan] = await db.select().from(courtMembershipsTable).where(eq(courtMembershipsTable.id, planId));
  if (!plan || plan.courtId !== courtId) { res.status(404).json({ error: "Plan not found" }); return; }
  const { dayOfWeek, startTime } = req.body as any;
  if (dayOfWeek === undefined || !startTime) { res.status(400).json({ error: "dayOfWeek and startTime required" }); return; }
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const [membership] = await db.insert(userMembershipsTable).values({
    userId, courtId, membershipPlanId: planId, dayOfWeek: Number(dayOfWeek), startTime, status: "active", expiresAt,
  }).returning();
  res.status(201).json(membership);
});

router.get("/users/memberships", requireAuth, async (req, res): Promise<void> => {
  const userId = await getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const memberships = await db.select({
    id: userMembershipsTable.id,
    courtId: userMembershipsTable.courtId,
    dayOfWeek: userMembershipsTable.dayOfWeek,
    startTime: userMembershipsTable.startTime,
    status: userMembershipsTable.status,
    expiresAt: userMembershipsTable.expiresAt,
    planName: courtMembershipsTable.name,
    planPrice: courtMembershipsTable.pricePerYear,
  }).from(userMembershipsTable)
    .innerJoin(courtMembershipsTable, eq(userMembershipsTable.membershipPlanId, courtMembershipsTable.id))
    .where(eq(userMembershipsTable.userId, userId));
  res.json(memberships);
});

export default router;
