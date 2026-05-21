import { Router, type IRouter } from "express";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  coachesTable,
  coachAvailabilitiesTable,
  coachBlockedSlotsTable,
  coachSportsTable,
  courtCoachesTable,
  courtsTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, requireCoach, getCurrentUserId } from "../lib/auth";
import { getCoachAvailability, vilniusToUtc } from "../lib/coach-availability";

const router: IRouter = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const AvailabilityEntrySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(HHMM, "Time must be HH:MM"),
  endTime: z.string().regex(HHMM, "Time must be HH:MM"),
}).refine((e) => e.startTime < e.endTime, {
  message: "endTime must be after startTime",
  path: ["endTime"],
});

const AvailabilityReplaceBody = z.object({
  entries: z.array(AvailabilityEntrySchema),
});

const BlockedSlotCreateBody = z.object({
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  reason: z.string().max(280).optional().nullable(),
}).refine((b) => new Date(b.startTime) < new Date(b.endTime), {
  message: "endTime must be after startTime",
  path: ["endTime"],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getMyCoachId(userId: string): Promise<number | null> {
  const [coach] = await db
    .select({ id: coachesTable.id })
    .from(coachesTable)
    .where(eq(coachesTable.userId, userId));
  return coach?.id ?? null;
}

async function getCoachOwnerUserId(coachId: number): Promise<string | null> {
  const [c] = await db
    .select({ userId: coachesTable.userId })
    .from(coachesTable)
    .where(eq(coachesTable.id, coachId));
  return c?.userId ?? null;
}

// ─── Weekly availability ─────────────────────────────────────────────────────

// GET /coaches/me/availability — coach's own weekly schedule
router.get("/coaches/me/availability", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const coachId = await getMyCoachId(userId);
  if (coachId == null) { res.json([]); return; }

  const rows = await db
    .select()
    .from(coachAvailabilitiesTable)
    .where(eq(coachAvailabilitiesTable.coachId, coachId))
    .orderBy(asc(coachAvailabilitiesTable.dayOfWeek), asc(coachAvailabilitiesTable.startTime));

  res.json(rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
  })));
});

// PUT /coaches/me/availability — replace the full weekly schedule atomically
router.put("/coaches/me/availability", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const coachId = await getMyCoachId(userId);
  if (coachId == null) { res.status(400).json({ error: "Create your coach profile first" }); return; }

  const parsed = AvailabilityReplaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  // Replace-all semantics: delete existing rows and re-insert the new set.
  // Cheap because the per-coach row count is tiny (typically <30).
  await db.transaction(async (tx) => {
    await tx.delete(coachAvailabilitiesTable).where(eq(coachAvailabilitiesTable.coachId, coachId));
    if (parsed.data.entries.length > 0) {
      await tx.insert(coachAvailabilitiesTable).values(
        parsed.data.entries.map((e) => ({
          coachId,
          dayOfWeek: e.dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      );
    }
  });

  const rows = await db
    .select()
    .from(coachAvailabilitiesTable)
    .where(eq(coachAvailabilitiesTable.coachId, coachId))
    .orderBy(asc(coachAvailabilitiesTable.dayOfWeek), asc(coachAvailabilitiesTable.startTime));

  res.json(rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
  })));
});

// ─── Blocked slots ───────────────────────────────────────────────────────────

// GET /coaches/me/blocked-slots?from=ISO&to=ISO
router.get("/coaches/me/blocked-slots", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const coachId = await getMyCoachId(userId);
  if (coachId == null) { res.json([]); return; }

  // Default window: today (UTC) through +180 days, so the UI gets the
  // upcoming-blocks view without having to specify a range.
  const from = req.query.from ? new Date(String(req.query.from)) : new Date();
  const to = req.query.to
    ? new Date(String(req.query.to))
    : new Date(from.getTime() + 180 * 24 * 3600 * 1000);

  const rows = await db
    .select()
    .from(coachBlockedSlotsTable)
    .where(and(
      eq(coachBlockedSlotsTable.coachId, coachId),
      gte(coachBlockedSlotsTable.endTime, from),
      lte(coachBlockedSlotsTable.startTime, to),
    ))
    .orderBy(asc(coachBlockedSlotsTable.startTime));

  res.json(rows.map((r) => ({
    id: r.id,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    reason: r.reason,
  })));
});

// POST /coaches/me/blocked-slots
router.post("/coaches/me/blocked-slots", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const coachId = await getMyCoachId(userId);
  if (coachId == null) { res.status(400).json({ error: "Create your coach profile first" }); return; }

  const parsed = BlockedSlotCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const [row] = await db.insert(coachBlockedSlotsTable).values({
    coachId,
    startTime: new Date(parsed.data.startTime),
    endTime: new Date(parsed.data.endTime),
    reason: parsed.data.reason ?? null,
  }).returning();

  res.status(201).json({
    id: row.id,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    reason: row.reason,
  });
});

// DELETE /coaches/me/blocked-slots/:id
router.delete("/coaches/me/blocked-slots/:id", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const coachId = await getMyCoachId(userId);
  if (coachId == null) { res.status(404).json({ error: "Coach not found" }); return; }

  const blockId = Number(req.params.id);
  if (!Number.isFinite(blockId)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Bind ownership server-side — never trust the path id alone.
  const deleted = await db.delete(coachBlockedSlotsTable)
    .where(and(
      eq(coachBlockedSlotsTable.id, blockId),
      eq(coachBlockedSlotsTable.coachId, coachId),
    ))
    .returning({ id: coachBlockedSlotsTable.id });

  if (deleted.length === 0) { res.status(404).json({ error: "Block not found" }); return; }
  res.json({ ok: true });
});

// ─── Availability matrix (read-only) ─────────────────────────────────────────

// GET /coaches/:id/availability?date=YYYY-MM-DD
// Returns the 30-min slots a coach is available on a given date, in
// Europe/Vilnius local time. Blocked slots subtracted; bookings will be
// subtracted by a later strike when coach bookings ship.
router.get("/coaches/:id/availability", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid coach id" }); return; }

  const ownerUserId = await getCoachOwnerUserId(id);
  if (!ownerUserId) { res.status(404).json({ error: "Coach not found" }); return; }

  const date = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" }); return;
  }

  const slots = await getCoachAvailability(id, date);
  res.json({ date, slots });
});

// ─── Available coaches for a court+window ────────────────────────────────────
//
// GET /courts/:id/available-coaches?date=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM
//
// Returns the coaches a player can attach to a [startTime, endTime] booking
// at this court. A coach qualifies only if ALL of:
//   1. status='approved' and isAcceptingStudents=true
//   2. courtPaymentModel='student_pays_court'  (Strike 2 scope)
//   3. Their user_profile has stripeAccountStatus='active'
//   4. travelPolicy='any_court' OR they have an approved courtCoachesTable
//      row for this courtId
//   5. getCoachAvailability covers every 30-min slot in [startTime, endTime)
//      for the given Europe/Vilnius date
//
// The window MUST align to 30-minute boundaries (the slot granularity).
router.get("/courts/:id/available-coaches", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  if (!Number.isFinite(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const date = String(req.query.date ?? "");
  const startTime = String(req.query.startTime ?? "");
  const endTime = String(req.query.endTime ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" }); return;
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    res.status(400).json({ error: "startTime/endTime must be HH:MM" }); return;
  }

  const [court] = await db
    .select({ id: courtsTable.id, status: courtsTable.status })
    .from(courtsTable)
    .where(eq(courtsTable.id, courtId));
  if (!court || court.status !== "active") {
    res.status(404).json({ error: "Court not found" }); return;
  }

  const requestStartUtc = vilniusToUtc(date, startTime).getTime();
  const requestEndUtc = vilniusToUtc(date, endTime).getTime();
  if (requestEndUtc <= requestStartUtc) {
    res.status(400).json({ error: "endTime must be after startTime" }); return;
  }
  const STEP_MS = 30 * 60_000;
  if ((requestEndUtc - requestStartUtc) % STEP_MS !== 0) {
    res.status(400).json({ error: "Window must align to 30-minute slots" }); return;
  }

  // Static filter on coaches that could theoretically take this booking.
  const candidates = await db
    .select({
      id: coachesTable.id,
      userId: coachesTable.userId,
      name: coachesTable.name,
      photoUrl: coachesTable.photoUrl,
      pricePerHour: coachesTable.pricePerHour,
      travelPolicy: coachesTable.travelPolicy,
      cancellationPolicy: coachesTable.cancellationPolicy,
      sports: coachesTable.sports,
      experienceYears: coachesTable.experienceYears,
    })
    .from(coachesTable)
    .innerJoin(userProfilesTable, eq(coachesTable.userId, userProfilesTable.userId))
    .where(and(
      eq(coachesTable.status, "approved"),
      eq(coachesTable.isAcceptingStudents, true),
      eq(coachesTable.courtPaymentModel, "student_pays_court"),
      eq(userProfilesTable.stripeAccountStatus, "active"),
    ));

  if (candidates.length === 0) { res.json({ coaches: [] }); return; }

  // Travel-policy filter: any_court passes always; affiliated_only requires
  // an approved courtCoachesTable row for THIS court.
  const candidateIds = candidates.map((c) => c.id);
  const affiliations = await db
    .select({ coachId: courtCoachesTable.coachId })
    .from(courtCoachesTable)
    .where(and(
      eq(courtCoachesTable.courtId, courtId),
      inArray(courtCoachesTable.coachId, candidateIds),
    ));
  const affiliatedSet = new Set(affiliations.map((a) => a.coachId));
  const eligible = candidates.filter((c) =>
    c.travelPolicy === "any_court" || affiliatedSet.has(c.id),
  );

  // Pre-load per-sport audiences for the eligible coach set in one query so
  // the picker can render audience pills. We don't filter on (sport, audience)
  // here — the picker is court-level; the player applies sport/audience
  // filters by visual inspection of the rendered tags.
  const eligibleIds = eligible.map((c) => c.id);
  const sportsRows = eligibleIds.length > 0
    ? await db.select({
        coachId: coachSportsTable.coachId,
        sport: coachSportsTable.sport,
        audiences: coachSportsTable.audiences,
      })
        .from(coachSportsTable)
        .where(inArray(coachSportsTable.coachId, eligibleIds))
    : [];
  const sportsByCoach = new Map<number, Array<{ sport: string; audiences: string[] }>>();
  for (const r of sportsRows) {
    if (!sportsByCoach.has(r.coachId)) sportsByCoach.set(r.coachId, []);
    sportsByCoach.get(r.coachId)!.push({ sport: r.sport, audiences: r.audiences });
  }

  // Per-coach continuous-coverage check. Each getCoachAvailability call is
  // 2 small queries; we run them in parallel. Typical N is tiny (<20).
  const checks = await Promise.all(eligible.map(async (c) => {
    const slots = await getCoachAvailability(c.id, date);
    const slotMs = new Set(slots.map((s) => new Date(s.start).getTime()));
    for (let t = requestStartUtc; t < requestEndUtc; t += STEP_MS) {
      if (!slotMs.has(t)) return null;
    }
    return {
      id: c.id,
      name: c.name,
      photoUrl: c.photoUrl ?? null,
      pricePerHour: c.pricePerHour ?? null,
      sports: c.sports,
      experienceYears: c.experienceYears ?? null,
      cancellationPolicy: c.cancellationPolicy,
      sportsAudiences: sportsByCoach.get(c.id) ?? [],
    };
  }));

  res.json({ coaches: checks.filter((c): c is NonNullable<typeof c> => c !== null) });
});

export default router;
