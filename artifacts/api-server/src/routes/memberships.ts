import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
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
  const { name, description, pricePerYear, pricePerMonth, weeklySlots, conditions, discountPercent } = req.body as any;
  if (!name || pricePerYear == null) { res.status(400).json({ error: "name and pricePerYear required" }); return; }
  const [plan] = await db.insert(courtMembershipsTable).values({
    courtId,
    facilityId: court.facilityId,
    sport: court.type,
    name,
    description: description ?? null,
    pricePerYear: Number(pricePerYear),
    pricePerMonth: pricePerMonth != null && pricePerMonth !== "" ? Number(pricePerMonth) : null,
    weeklySlots: Number(weeklySlots ?? 1),
    conditions: conditions ?? null,
    discountPercent: discountPercent != null && discountPercent !== "" ? Number(discountPercent) : null,
  }).returning();
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
  const { name, description, pricePerYear, pricePerMonth, weeklySlots, conditions, discountPercent, isActive } = req.body as any;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (pricePerYear !== undefined) update.pricePerYear = Number(pricePerYear);
  if (pricePerMonth !== undefined) update.pricePerMonth = pricePerMonth === null || pricePerMonth === "" ? null : Number(pricePerMonth);
  if (weeklySlots !== undefined) update.weeklySlots = Number(weeklySlots);
  if (conditions !== undefined) update.conditions = conditions;
  if (discountPercent !== undefined) update.discountPercent = discountPercent === null || discountPercent === "" ? null : Number(discountPercent);
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  const [updated] = await db.update(courtMembershipsTable).set(update).where(and(eq(courtMembershipsTable.id, planId), eq(courtMembershipsTable.courtId, courtId))).returning();
  res.json(updated);
});

router.post("/courts/:id/memberships/:planId/subscribe", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(String(req.params.id));
  const planId = parseInt(String(req.params.planId));
  const userId = await getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }
  const [plan] = await db.select().from(courtMembershipsTable).where(eq(courtMembershipsTable.id, planId));
  if (!plan || plan.courtId !== courtId || !plan.isActive) { res.status(404).json({ error: "Plan not found" }); return; }
  const [existing] = await db.select({ id: userMembershipsTable.id })
    .from(userMembershipsTable)
    .where(and(
      eq(userMembershipsTable.userId, userId),
      eq(userMembershipsTable.membershipPlanId, planId),
      eq(userMembershipsTable.status, "active"),
    ));
  if (existing) { res.status(409).json({ error: "Already subscribed" }); return; }
  // dayOfWeek/startTime are optional relics of the reserved-slot model.
  const { dayOfWeek, startTime } = req.body as any;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const [membership] = await db.insert(userMembershipsTable).values({
    userId, courtId, facilityId: court.facilityId, sport: court.type, membershipPlanId: planId,
    dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
    startTime: startTime || null,
    status: "active", expiresAt,
  }).returning();
  res.status(201).json(membership);
});

// ── Group-level (facility + sport) plan list ─────────────────────────────────
// Includes legacy court-scoped plans of the same facility+sport (they carry
// facilityId/sport too), so the owner manages one list per group.

router.get("/facilities/:facilityId/:sport/memberships", async (req, res): Promise<void> => {
  const facilityId = parseInt(String(req.params.facilityId));
  const sportNorm = String(req.params.sport).replace(/-/g, "_");
  if (isNaN(facilityId) || !sportNorm) { res.status(400).json({ error: "Invalid parameters" }); return; }
  const plans = await db.select().from(courtMembershipsTable)
    .where(and(
      eq(courtMembershipsTable.facilityId, facilityId),
      sql`REPLACE(${courtMembershipsTable.sport}, '-', '_') = ${sportNorm}`,
      eq(courtMembershipsTable.isActive, true),
    ));
  res.json(plans);
});

// ── Group-level (facility + sport) plan update / deactivate ──────────────────
// Group plans have courtId NULL, so the court-scoped PATCH can never match
// them — this is the only way to edit or deactivate them.

router.patch("/facilities/:facilityId/:sport/memberships/:planId", requireAuth, async (req, res): Promise<void> => {
  const facilityId = parseInt(String(req.params.facilityId));
  const sportNorm = String(req.params.sport).replace(/-/g, "_");
  const planId = parseInt(String(req.params.planId));
  if (isNaN(facilityId) || isNaN(planId) || !sportNorm) { res.status(400).json({ error: "Invalid parameters" }); return; }
  const [facility] = await db.select({ ownerUserId: facilitiesTable.ownerUserId }).from(facilitiesTable).where(eq(facilitiesTable.id, facilityId));
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }
  if (!(await isOwner(req, facility.ownerUserId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [plan] = await db.select().from(courtMembershipsTable)
    .where(and(
      eq(courtMembershipsTable.id, planId),
      eq(courtMembershipsTable.facilityId, facilityId),
      sql`REPLACE(${courtMembershipsTable.sport}, '-', '_') = ${sportNorm}`,
    ));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  const { name, description, pricePerYear, pricePerMonth, weeklySlots, conditions, discountPercent, isActive } = req.body as any;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (pricePerYear !== undefined) update.pricePerYear = Number(pricePerYear);
  if (pricePerMonth !== undefined) update.pricePerMonth = pricePerMonth === null || pricePerMonth === "" ? null : Number(pricePerMonth);
  if (weeklySlots !== undefined) update.weeklySlots = Number(weeklySlots);
  if (conditions !== undefined) update.conditions = conditions;
  if (discountPercent !== undefined) update.discountPercent = discountPercent === null || discountPercent === "" ? null : Number(discountPercent);
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  const [updated] = await db.update(courtMembershipsTable).set(update).where(eq(courtMembershipsTable.id, planId)).returning();
  res.json(updated);
});

// ── Group-level (facility + sport) plan creation ─────────────────────────────

router.post("/facilities/:facilityId/:sport/memberships", requireAuth, async (req, res): Promise<void> => {
  const facilityId = parseInt(String(req.params.facilityId));
  const sport = String(req.params.sport);
  if (isNaN(facilityId)) { res.status(400).json({ error: "Invalid facilityId" }); return; }
  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, facilityId));
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }
  if (!(await isOwner(req, facility.ownerUserId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [sportCourt] = await db.select({ id: courtsTable.id }).from(courtsTable)
    .where(and(eq(courtsTable.facilityId, facilityId), eq(courtsTable.type, sport)));
  if (!sportCourt) { res.status(400).json({ error: "No courts of this sport in facility" }); return; }
  const { name, description, pricePerYear, pricePerMonth, weeklySlots, conditions, discountPercent } = req.body as any;
  if (!name || pricePerYear == null) { res.status(400).json({ error: "name and pricePerYear required" }); return; }
  const [plan] = await db.insert(courtMembershipsTable).values({
    courtId: null,
    facilityId,
    sport,
    name,
    description: description ?? null,
    pricePerYear: Number(pricePerYear),
    pricePerMonth: pricePerMonth != null && pricePerMonth !== "" ? Number(pricePerMonth) : null,
    weeklySlots: Number(weeklySlots ?? 1),
    conditions: conditions ?? null,
    discountPercent: discountPercent != null && discountPercent !== "" ? Number(discountPercent) : null,
  }).returning();
  res.status(201).json(plan);
});

// ── Group-level (facility + sport) subscribe ──────────────────────────────────

router.post("/facilities/:facilityId/:sport/memberships/:planId/subscribe", requireAuth, async (req, res): Promise<void> => {
  const facilityId = parseInt(String(req.params.facilityId));
  const sport = String(req.params.sport);
  const planId = parseInt(String(req.params.planId));
  if (isNaN(facilityId) || isNaN(planId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = await getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [plan] = await db.select().from(courtMembershipsTable).where(eq(courtMembershipsTable.id, planId));
  if (!plan || plan.facilityId !== facilityId || plan.sport !== sport || !plan.isActive) { res.status(404).json({ error: "Plan not found" }); return; }
  const [existing] = await db.select({ id: userMembershipsTable.id })
    .from(userMembershipsTable)
    .where(and(
      eq(userMembershipsTable.userId, userId),
      eq(userMembershipsTable.membershipPlanId, planId),
      eq(userMembershipsTable.status, "active"),
    ));
  if (existing) { res.status(409).json({ error: "Already subscribed" }); return; }
  // dayOfWeek/startTime are optional relics of the reserved-slot model.
  const { dayOfWeek, startTime } = req.body as any;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const [membership] = await db.insert(userMembershipsTable).values({
    userId, courtId: null, facilityId, sport, membershipPlanId: planId,
    dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
    startTime: startTime || null,
    status: "active", expiresAt,
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
