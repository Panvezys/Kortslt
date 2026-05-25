/**
 * Coach services — bookable lesson types per coach.
 *
 * A coach has ONE shared availability schedule but MANY services (individual
 * lessons, group sessions, junior intro, etc.) each with its own duration and
 * price. The marketplace card surfaces the lowest priceCents as a "starting
 * from" rate (Invariant A — see lib/coach-pricing.ts).
 *
 * Endpoints:
 *   GET    /coaches/:id/services                — public; lists active
 *                                                  services. The owner sees
 *                                                  ALL services (incl. inactive).
 *   POST   /coaches/:id/services                — owner only
 *   PATCH  /coaches/:id/services/:sid           — owner only
 *   DELETE /coaches/:id/services/:sid           — owner only; soft-deletes
 *                                                  when bookings reference it
 *   GET    /coaches/:id/services/:sid/slots     — public; returns start times
 *                                                  for the given date that fit
 *                                                  the service's duration
 *
 * All mutating routes wrap the change AND syncCoachStartingPrice in a single
 * transaction so the denormalized pricePerHour can never drift out of sync
 * with the underlying services.
 */
import { Router, type IRouter } from "express";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  coachesTable,
  coachServicesTable,
  courtCoachesTable,
  bookingsTable,
} from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";
import { syncCoachStartingPrice } from "../lib/coach-pricing";
import { getCoachAvailability } from "../lib/coach-availability";

const router: IRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Shape returned to API consumers. Explicit projection — never spread the
 * raw DB row.
 */
function formatService(s: typeof coachServicesTable.$inferSelect) {
  return {
    id: s.id,
    coachId: s.coachId,
    name: s.name,
    description: s.description,
    sport: s.sport,
    courtId: s.courtId,
    durationMin: s.durationMin,
    priceCents: s.priceCents,
    maxParticipants: s.maxParticipants,
    audienceLevel: s.audienceLevel,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

const ALLOWED_DURATIONS = [30, 60, 90, 120] as const;

const serviceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  sport: z.string().trim().min(1).max(64),
  courtId: z.number().int().positive().optional().nullable(),
  durationMin: z.number().int().refine(v => (ALLOWED_DURATIONS as readonly number[]).includes(v), {
    message: "durationMin must be 30, 60, 90, or 120",
  }),
  priceCents: z.number().int().nonnegative(),
  maxParticipants: z.number().int().min(1).max(8).optional(),
  audienceLevel: z.string().trim().max(32).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// All fields optional for PATCH; same value rules as create.
const serviceUpdateSchema = serviceCreateSchema.partial();

type LoadedCoach =
  | { kind: "ok"; coach: { id: number; userId: string } }
  | { kind: "err"; status: number; body: { error: string } };

async function loadOwnedCoach(
  req: import("express").Request,
  coachId: number,
): Promise<LoadedCoach> {
  const userId = getCurrentUserId(req);
  if (!userId) return { kind: "err", status: 401, body: { error: "Unauthorized" } };
  const [coach] = await db
    .select({ id: coachesTable.id, userId: coachesTable.userId })
    .from(coachesTable)
    .where(eq(coachesTable.id, coachId));
  if (!coach) return { kind: "err", status: 404, body: { error: "Coach not found" } };
  if (coach.userId !== userId) {
    return { kind: "err", status: 403, body: { error: "Forbidden" } };
  }
  return { kind: "ok", coach };
}

/**
 * Confirm a service's courtId (when supplied) is one the coach is approved
 * at. Without this check a coach could bind a service to any court id in
 * the database, including courts of competitors.
 */
async function assertCoachOwnsCourt(coachId: number, courtId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: courtCoachesTable.id })
    .from(courtCoachesTable)
    .where(and(eq(courtCoachesTable.coachId, coachId), eq(courtCoachesTable.courtId, courtId)));
  return !!row;
}

// ─── GET /coaches/:id/services ─────────────────────────────────────────────

router.get("/coaches/:id/services", async (req, res): Promise<void> => {
  const coachId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(coachId)) {
    res.status(400).json({ error: "Invalid coach id" });
    return;
  }

  const [coach] = await db
    .select({ id: coachesTable.id, userId: coachesTable.userId, status: coachesTable.status })
    .from(coachesTable)
    .where(eq(coachesTable.id, coachId));
  if (!coach) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  const callerId = getCurrentUserId(req);
  const isOwnerCaller = callerId !== null && callerId === coach.userId;

  // Non-owners can only see services for an approved coach AND only active
  // services. The owner sees all services regardless of approval status —
  // they need to be able to manage their menu before going live.
  if (!isOwnerCaller && coach.status !== "approved") {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  const conditions = [eq(coachServicesTable.coachId, coachId)];
  if (!isOwnerCaller) conditions.push(eq(coachServicesTable.isActive, true));

  const rows = await db
    .select()
    .from(coachServicesTable)
    .where(and(...conditions))
    .orderBy(asc(coachServicesTable.sortOrder), asc(coachServicesTable.id));

  res.json(rows.map(formatService));
});

// ─── POST /coaches/:id/services ────────────────────────────────────────────

router.post("/coaches/:id/services", requireAuth, async (req, res): Promise<void> => {
  const coachId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(coachId)) {
    res.status(400).json({ error: "Invalid coach id" });
    return;
  }
  const owned = await loadOwnedCoach(req, coachId);
  if (owned.kind === "err") {
    res.status(owned.status).json(owned.body);
    return;
  }

  const parsed = serviceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const v = parsed.data;

  if (v.courtId != null) {
    const ok = await assertCoachOwnsCourt(coachId, v.courtId);
    if (!ok) {
      res.status(400).json({ error: "Coach is not approved at the supplied courtId" });
      return;
    }
  }

  // Catalog ceiling: 15 services per coach. Counts BOTH active and inactive
  // rows — a soft-deactivated service still occupies a catalog slot until
  // it's removed via DELETE.
  const SERVICE_CATALOG_LIMIT = 15;
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(coachServicesTable)
    .where(eq(coachServicesTable.coachId, coachId));
  if (count >= SERVICE_CATALOG_LIMIT) {
    res.status(422).json({
      error: "service_catalog_full",
      message: `Maksimalus paslaugų skaičius (${SERVICE_CATALOG_LIMIT}) pasiektas`,
    });
    return;
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(coachServicesTable)
        .values({
          coachId,
          name: v.name,
          description: v.description ?? null,
          sport: v.sport,
          courtId: v.courtId ?? null,
          durationMin: v.durationMin,
          priceCents: v.priceCents,
          maxParticipants: v.maxParticipants ?? 1,
          audienceLevel: v.audienceLevel ?? null,
          isActive: v.isActive ?? true,
          sortOrder: v.sortOrder ?? 0,
          updatedAt: new Date(),
        })
        .returning();
      await syncCoachStartingPrice(coachId, tx);
      return row;
    });
    res.status(201).json(formatService(created));
  } catch (err) {
    console.error("[coach-services] POST failed", err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

// ─── PATCH /coaches/:id/services/:sid ──────────────────────────────────────

router.patch("/coaches/:id/services/:sid", requireAuth, async (req, res): Promise<void> => {
  const coachId = parseInt(String(req.params.id), 10);
  const serviceId = parseInt(String(req.params.sid), 10);
  if (!Number.isFinite(coachId) || !Number.isFinite(serviceId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const owned = await loadOwnedCoach(req, coachId);
  if (owned.kind === "err") {
    res.status(owned.status).json(owned.body);
    return;
  }

  const parsed = serviceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const v = parsed.data;

  // Confirm the service belongs to this coach (object-level authz).
  const [existing] = await db
    .select({ id: coachServicesTable.id, coachId: coachServicesTable.coachId })
    .from(coachServicesTable)
    .where(eq(coachServicesTable.id, serviceId));
  if (!existing || existing.coachId !== coachId) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  if (v.courtId != null) {
    const ok = await assertCoachOwnsCourt(coachId, v.courtId);
    if (!ok) {
      res.status(400).json({ error: "Coach is not approved at the supplied courtId" });
      return;
    }
  }

  // Build only the columns the caller actually supplied. This keeps the
  // PATCH partial (Invariant B-friendly — we never silently rewrite columns
  // the client didn't touch).
  const patch: Partial<typeof coachServicesTable.$inferInsert> = { updatedAt: new Date() };
  if (v.name !== undefined) patch.name = v.name;
  if (v.description !== undefined) patch.description = v.description ?? null;
  if (v.sport !== undefined) patch.sport = v.sport;
  if (v.courtId !== undefined) patch.courtId = v.courtId ?? null;
  if (v.durationMin !== undefined) patch.durationMin = v.durationMin;
  if (v.priceCents !== undefined) patch.priceCents = v.priceCents;
  if (v.maxParticipants !== undefined) patch.maxParticipants = v.maxParticipants;
  if (v.audienceLevel !== undefined) patch.audienceLevel = v.audienceLevel ?? null;
  if (v.isActive !== undefined) patch.isActive = v.isActive;
  if (v.sortOrder !== undefined) patch.sortOrder = v.sortOrder;

  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(coachServicesTable)
        .set(patch)
        .where(eq(coachServicesTable.id, serviceId))
        .returning();
      await syncCoachStartingPrice(coachId, tx);
      return row;
    });
    if (!updated) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json(formatService(updated));
  } catch (err) {
    console.error("[coach-services] PATCH failed", err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

// ─── DELETE /coaches/:id/services/:sid ─────────────────────────────────────

router.delete("/coaches/:id/services/:sid", requireAuth, async (req, res): Promise<void> => {
  const coachId = parseInt(String(req.params.id), 10);
  const serviceId = parseInt(String(req.params.sid), 10);
  if (!Number.isFinite(coachId) || !Number.isFinite(serviceId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const owned = await loadOwnedCoach(req, coachId);
  if (owned.kind === "err") {
    res.status(owned.status).json(owned.body);
    return;
  }

  const [existing] = await db
    .select({ id: coachServicesTable.id, coachId: coachServicesTable.coachId })
    .from(coachServicesTable)
    .where(eq(coachServicesTable.id, serviceId));
  if (!existing || existing.coachId !== coachId) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  // Vulnerability check (Invariant B): if any booking still references this
  // service we MUST NOT hard-delete — that would lose the historical link
  // between the booking and the lesson type the student bought. Soft-delete
  // by flipping isActive=false so it disappears from the marketplace and
  // booking flows, but the row stays for analytics / refund decisions.
  const [refBooking] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(eq(bookingsTable.coachServiceId, serviceId))
    .limit(1);
  const hasBookings = !!refBooking;

  try {
    const result = await db.transaction(async (tx) => {
      if (hasBookings) {
        const [row] = await tx
          .update(coachServicesTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(coachServicesTable.id, serviceId))
          .returning();
        await syncCoachStartingPrice(coachId, tx);
        return { mode: "soft" as const, row };
      } else {
        await tx
          .delete(coachServicesTable)
          .where(eq(coachServicesTable.id, serviceId));
        await syncCoachStartingPrice(coachId, tx);
        return { mode: "hard" as const };
      }
    });
    res.json({ deleted: result.mode === "hard", deactivated: result.mode === "soft" });
  } catch (err) {
    console.error("[coach-services] DELETE failed", err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

// ─── GET /coaches/:id/services/:sid/slots?date=YYYY-MM-DD ──────────────────

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

router.get("/coaches/:id/services/:sid/slots", async (req, res): Promise<void> => {
  const coachId = parseInt(String(req.params.id), 10);
  const serviceId = parseInt(String(req.params.sid), 10);
  const date = String(req.query.date ?? "");
  if (!Number.isFinite(coachId) || !Number.isFinite(serviceId) || !dateRe.test(date)) {
    res.status(400).json({ error: "Invalid request — expect numeric ids and YYYY-MM-DD date" });
    return;
  }

  // Service load — we need duration + courtId. Inactive services don't
  // expose slots (so a coach can pull a service from the menu without
  // breaking the existing /coach/:id page rendering it).
  const [service] = await db
    .select({
      id: coachServicesTable.id,
      coachId: coachServicesTable.coachId,
      courtId: coachServicesTable.courtId,
      durationMin: coachServicesTable.durationMin,
      isActive: coachServicesTable.isActive,
    })
    .from(coachServicesTable)
    .where(eq(coachServicesTable.id, serviceId));
  if (!service || service.coachId !== coachId || !service.isActive) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  // Step 1 — coach-side 30-min availability slots for the day.
  const coachSlots = await getCoachAvailability(coachId, date);
  if (coachSlots.length === 0) {
    res.json({ slots: [] });
    return;
  }

  // Step 2 — if the service is court-bound, drop coach slots whose window
  // overlaps a court booking on that date. Bookings store HH:MM in Europe/
  // Vilnius local time on the supplied date, same convention as the coach
  // slot labels — string compare is enough.
  let courtBookedRanges: Array<{ startTime: string; endTime: string }> = [];
  if (service.courtId != null) {
    courtBookedRanges = await db
      .select({ startTime: bookingsTable.startTime, endTime: bookingsTable.endTime })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.courtId, service.courtId),
          eq(bookingsTable.date, date),
          ne(bookingsTable.status, "cancelled"),
        ),
      );
  }

  function isCourtBlockedAtLabel(hhmm: string): boolean {
    // half-open [start, end) overlap — slot starting at hhmm covers the 30
    // minutes hhmm..(hhmm+30). Easiest: compare HH:MM strings since they
    // sort lexicographically when zero-padded.
    const slotStart = hhmm;
    const [hh, mm] = hhmm.split(":").map(Number);
    const endMins = hh * 60 + mm + 30;
    const slotEnd = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    for (const r of courtBookedRanges) {
      // Overlap if r.startTime < slotEnd AND r.endTime > slotStart
      if (r.startTime < slotEnd && r.endTime > slotStart) return true;
    }
    return false;
  }

  // Step 3 — collapse to start times where the next N consecutive 30-min
  // slots are all available. N = durationMin / 30.
  const slotsNeeded = Math.ceil(service.durationMin / 30);
  const labelToIdx = new Map<string, number>();
  coachSlots.forEach((s, i) => labelToIdx.set(s.label, i));

  function nextLabel(hhmm: string): string {
    const [hh, mm] = hhmm.split(":").map(Number);
    const t = hh * 60 + mm + 30;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  const result: Array<{ start: string; end: string; label: string }> = [];
  for (let i = 0; i < coachSlots.length; i++) {
    const startSlot = coachSlots[i];
    if (isCourtBlockedAtLabel(startSlot.label)) continue;
    // Walk forward by 30-min steps in label space and confirm each successor
    // both exists in the coach's free-slot set AND isn't court-blocked.
    let ok = true;
    let cursor = startSlot.label;
    for (let k = 1; k < slotsNeeded; k++) {
      cursor = nextLabel(cursor);
      const idx = labelToIdx.get(cursor);
      if (idx === undefined) { ok = false; break; }
      if (isCourtBlockedAtLabel(cursor)) { ok = false; break; }
    }
    if (!ok) continue;
    // The end timestamp is the start of the slot durationMin minutes later.
    const endIdx = i + slotsNeeded - 1;
    const lastSlot = coachSlots[endIdx];
    result.push({
      start: startSlot.start,
      end: lastSlot.end,
      label: startSlot.label,
    });
  }

  res.json({ slots: result });
});

export default router;
