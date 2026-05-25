/**
 * Coach Command Center — read-only aggregates for the coach dashboard.
 *
 * All endpoints are `requireCoach`-gated and view-as-aware via
 * resolveCoachUserId so an admin impersonating a coach sees that coach's
 * data, not their own.
 *
 *   GET /coaches/me/dashboard-stats   — header KPIs + next-up bookings
 *   GET /coaches/me/students          — unique students with totals
 *   GET /coaches/me/bookings          — paginated booking list with filters
 */
import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  bookingsTable,
  coachServicesTable,
  courtsTable,
  facilitiesTable,
} from "@workspace/db";
import { requireCoach, resolveCoachUserId } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Date helpers (Europe/Vilnius local) ────────────────────────────────────
//
// bookings.date is stored as `YYYY-MM-DD` in Vilnius local time and
// bookings.startTime/endTime as `HH:MM` in the same zone, so we can compute
// the week/month boundaries using local-date math without any UTC conversion.
// Lexicographic string comparison on YYYY-MM-DD matches chronological order.

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentWeekRange(now = new Date()): { from: string; to: string } {
  // ISO week boundaries: Monday → Sunday. JS getDay returns 0..6 with 0=Sun.
  const dow = now.getDay() || 7; // Sunday → 7 so Monday → -0 days
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: ymd(monday), to: ymd(sunday) };
}

function currentMonthRange(now = new Date()): { from: string; to: string } {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}

// "HH:MM" → minutes since midnight.
function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

// Minutes between two HH:MM strings on the same date. Returns 0 for malformed
// input so a corrupt booking doesn't crash the aggregate.
function bookingDurationMin(start: string, end: string): number {
  const s = hmToMin(start);
  const e = hmToMin(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return e - s;
}

// Chunked Clerk lookup. Mirrors the pattern in admin.ts so a failing chunk
// degrades gracefully (those rows just resolve to null name/email/imageUrl).
async function batchResolveClerkUsers(userIds: string[]): Promise<
  Record<string, { name: string | null; email: string | null; imageUrl: string | null }>
> {
  const result: Record<string, { name: string | null; email: string | null; imageUrl: string | null }> = {};
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    try {
      const resp = await clerkClient.users.getUserList({ userId: chunk, limit: CHUNK });
      for (const u of resp.data) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        result[u.id] = {
          name,
          email: u.emailAddresses?.[0]?.emailAddress ?? null,
          imageUrl: u.imageUrl ?? null,
        };
      }
    } catch {
      // Skip failed chunks; consumers get null fields and the page still renders.
    }
  }
  return result;
}

// ─── GET /coaches/me/dashboard-stats ────────────────────────────────────────

router.get("/coaches/me/dashboard-stats", requireCoach, async (req, res): Promise<void> => {
  const userId = (await resolveCoachUserId(req))!;
  const week = currentWeekRange();
  const month = currentMonthRange();

  // KPIs are computed with three small grouped queries so we don't pull rows
  // into Node. The "upcoming" list is the only raw-row fetch — capped at 5.
  // Booking statuses we count: 'confirmed' and 'awaiting_players' for the
  // active funnel; we explicitly exclude 'cancelled' and 'blocked'.
  const ACTIVE_STATUSES = ["confirmed", "awaiting_players"] as const;

  const [weekRow, distinctStudentsRow, monthDurationRows, upcomingRows] = await Promise.all([
    // Lessons this week — count of bookings within Mon..Sun in the active funnel.
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.coachId, userId),
        gte(bookingsTable.date, week.from),
        lte(bookingsTable.date, week.to),
        inArray(bookingsTable.status, ACTIVE_STATUSES as unknown as string[]),
      )),

    // Active students all-time. Confirmed bookings only; treat each unique
    // bookerUserId as one student, plus distinct customerEmail for the guest
    // tail (bookerUserId IS NULL).
    db.select({
      count: sql<number>`
        COUNT(DISTINCT COALESCE(${bookingsTable.bookerUserId}, ${bookingsTable.customerEmail}))::int
      `,
    })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.coachId, userId),
        eq(bookingsTable.status, "confirmed"),
      )),

    // Total lesson minutes this month. We sum (endTime - startTime) in
    // application code — Postgres has no built-in HH:MM diff and casting to
    // interval/timestamp would obscure the simple math.
    db.select({
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
    })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.coachId, userId),
        gte(bookingsTable.date, month.from),
        lte(bookingsTable.date, month.to),
        inArray(bookingsTable.status, ACTIVE_STATUSES as unknown as string[]),
      )),

    // Upcoming bookings — date >= today, confirmed funnel, ordered by date+start.
    db.select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      facilityName: facilitiesTable.name,
      serviceName: coachServicesTable.name,
    })
      .from(bookingsTable)
      .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
      .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
      .leftJoin(coachServicesTable, eq(bookingsTable.coachServiceId, coachServicesTable.id))
      .where(and(
        eq(bookingsTable.coachId, userId),
        gte(bookingsTable.date, ymd(new Date())),
        inArray(bookingsTable.status, ACTIVE_STATUSES as unknown as string[]),
      ))
      .orderBy(asc(bookingsTable.date), asc(bookingsTable.startTime))
      .limit(5),
  ]);

  const totalMinutesThisMonth = monthDurationRows.reduce(
    (acc, r) => acc + bookingDurationMin(r.startTime, r.endTime),
    0,
  );

  res.json({
    lessonsThisWeek: weekRow[0]?.count ?? 0,
    activeStudents: distinctStudentsRow[0]?.count ?? 0,
    totalMinutesThisMonth,
    week: { from: week.from, to: week.to },
    upcomingBookings: upcomingRows.map((r) => ({
      id: r.booking.id,
      date: r.booking.date,
      startTime: r.booking.startTime,
      endTime: r.booking.endTime,
      status: r.booking.status,
      courtId: r.booking.courtId,
      courtName: r.courtName,
      facilityName: r.facilityName,
      serviceName: r.serviceName,
      customerName: r.booking.customerName,
      // Manual = guest-style booking the coach created off-platform.
      isManual: r.booking.bookerUserId === null && Number(r.booking.totalPrice) === 0,
    })),
  });
});

// ─── GET /coaches/me/students ───────────────────────────────────────────────

router.get("/coaches/me/students", requireCoach, async (req, res): Promise<void> => {
  const userId = (await resolveCoachUserId(req))!;

  // Group by booker. COALESCE keys so guest rows (bookerUserId null) collapse
  // by email — the same dedup rule used in dashboard-stats' activeStudents.
  // We pull both raw columns so the response can show the real name + email
  // even when the booker is a guest.
  const rows = await db.select({
    bookerUserId: bookingsTable.bookerUserId,
    customerName: sql<string>`(array_agg(${bookingsTable.customerName} ORDER BY ${bookingsTable.date} DESC))[1]`,
    customerEmail: bookingsTable.customerEmail,
    totalLessons: sql<number>`COUNT(*)::int`,
    lastLessonDate: sql<string>`MAX(${bookingsTable.date})`,
  })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.coachId, userId),
      ne(bookingsTable.status, "cancelled"),
    ))
    .groupBy(bookingsTable.bookerUserId, bookingsTable.customerEmail)
    .orderBy(desc(sql`MAX(${bookingsTable.date})`));

  // Resolve Clerk profiles for non-guest bookers in one batch.
  const clerkIds = rows.map((r) => r.bookerUserId).filter((v): v is string => !!v);
  const clerkMap = await batchResolveClerkUsers(clerkIds);

  res.json(rows.map((r) => {
    const clerk = r.bookerUserId ? clerkMap[r.bookerUserId] : undefined;
    const name = clerk?.name ?? r.customerName ?? null;
    const email = clerk?.email ?? r.customerEmail ?? null;
    return {
      // Key is the bookerUserId when known, otherwise the email — matches the
      // GROUP BY above and is stable for React list keys.
      key: r.bookerUserId ?? `guest:${r.customerEmail}`,
      bookerUserId: r.bookerUserId,
      isGuest: r.bookerUserId === null,
      name,
      email,
      imageUrl: clerk?.imageUrl ?? null,
      totalLessons: r.totalLessons,
      lastLessonDate: r.lastLessonDate,
    };
  }));
});

// ─── GET /coaches/me/bookings ───────────────────────────────────────────────

const ListBookingsQuery = z.object({
  scope: z.enum(["all", "upcoming", "past"]).default("all"),
  status: z.enum(["all", "confirmed", "awaiting_players", "pending", "cancelled"]).default("all"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(["date", "price"]).default("date"),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/coaches/me/bookings", requireCoach, async (req, res): Promise<void> => {
  const parsed = ListBookingsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
    return;
  }
  const q = parsed.data;
  const userId = (await resolveCoachUserId(req))!;
  const today = ymd(new Date());

  // Build the predicate. We always scope to the coach's bookings, and we
  // never include the `blocked` synthetic status (those are owner-side
  // court blocks, not coach lessons even though they share the table).
  const filters = [eq(bookingsTable.coachId, userId), ne(bookingsTable.status, "blocked")];

  if (q.scope === "upcoming") {
    filters.push(gte(bookingsTable.date, today));
  } else if (q.scope === "past") {
    filters.push(lt(bookingsTable.date, today));
  }

  if (q.status !== "all") {
    filters.push(eq(bookingsTable.status, q.status));
  }

  if (q.from) filters.push(gte(bookingsTable.date, q.from));
  if (q.to) filters.push(lte(bookingsTable.date, q.to));

  if (q.search) {
    const pattern = `%${q.search}%`;
    // Pre-coalesce phone NULL → '' so ilike doesn't drop rows with no phone.
    filters.push(
      or(
        ilike(bookingsTable.customerName, pattern),
        ilike(bookingsTable.customerEmail, pattern),
        ilike(sql<string>`COALESCE(${bookingsTable.customerPhone}, '')`, pattern),
      )!,
    );
  }

  // Sort: for upcoming, default ascending (nearest first); past defaults to
  // descending (most recent first); explicit `order` always wins.
  const dir = q.order
    ? (q.order === "asc" ? asc : desc)
    : (q.scope === "past" ? desc : asc);

  const orderByColumns = q.sort === "price"
    ? [dir(bookingsTable.totalPrice), dir(bookingsTable.date), dir(bookingsTable.startTime)]
    : [dir(bookingsTable.date), dir(bookingsTable.startTime), dir(bookingsTable.id)];

  const whereExpr = and(...filters);

  const [rows, totalRow] = await Promise.all([
    db.select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      facilityName: facilitiesTable.name,
      serviceName: coachServicesTable.name,
      serviceDurationMin: coachServicesTable.durationMin,
    })
      .from(bookingsTable)
      .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
      .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
      .leftJoin(coachServicesTable, eq(bookingsTable.coachServiceId, coachServicesTable.id))
      .where(whereExpr)
      .orderBy(...orderByColumns)
      .limit(q.limit)
      .offset(q.offset),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(bookingsTable)
      .where(whereExpr),
  ]);

  const total = totalRow[0]?.count ?? 0;

  res.json({
    items: rows.map((r) => {
      const totalPriceCents = Math.round(Number(r.booking.totalPrice) * 100);
      const durationMin = bookingDurationMin(r.booking.startTime, r.booking.endTime);
      const isManual = r.booking.bookerUserId === null && totalPriceCents === 0;
      // Refund tracking: bookings.refundAmount is a numeric string in EUR;
      // anything > 0 means a refund was issued. We don't surface partial vs
      // full here — the caller can compare against totalPriceCents if needed.
      const refundCents = Math.round(Number(r.booking.refundAmount ?? 0) * 100);
      return {
        id: r.booking.id,
        date: r.booking.date,
        startTime: r.booking.startTime,
        endTime: r.booking.endTime,
        durationMin,
        status: r.booking.status,
        courtId: r.booking.courtId,
        courtName: r.courtName,
        facilityName: r.facilityName,
        serviceId: r.booking.coachServiceId,
        serviceName: r.serviceName,
        customerName: r.booking.customerName,
        customerEmail: r.booking.customerEmail,
        customerPhone: r.booking.customerPhone,
        bookerUserId: r.booking.bookerUserId,
        isManual,
        totalPriceCents,
        coachAmountCents: r.booking.coachAmountCents,
        coachTransferId: r.booking.coachTransferId,
        refundCents,
        notes: r.booking.notes,
        createdAt: r.booking.createdAt.toISOString(),
      };
    }),
    total,
    hasMore: q.offset + rows.length < total,
    limit: q.limit,
    offset: q.offset,
  });
});

export default router;
