import { and, eq, gte, lt, ne } from "drizzle-orm";
import {
  db,
  coachAvailabilitiesTable,
  coachBlockedSlotsTable,
  coachesTable,
  bookingsTable,
} from "@workspace/db";

const COACH_TZ = "Europe/Vilnius";
const SLOT_MINUTES = 30;

/**
 * A single availability slot returned to clients. `start` and `end` are full
 * ISO timestamps (UTC) so callers can render them in any timezone. `label`
 * is the HH:MM Europe/Vilnius local time the slot starts — what coaches and
 * students actually think of as "the 14:00 slot".
 */
export interface CoachAvailabilitySlot {
  start: string;
  end: string;
  label: string;
}

// ─── Timezone helpers ────────────────────────────────────────────────────────
//
// We deliberately avoid pulling in luxon / date-fns-tz for one function. The
// trick: format a UTC instant into the target zone and parse the parts back
// out — that gives us "what time is it in Vilnius right now". Building a
// UTC timestamp from a Vilnius wall-clock time is the reverse: pick a UTC
// candidate, format it back into Vilnius, compare wall clocks, and adjust.

const TZ_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: COACH_TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
}

function partsAtVilnius(d: Date): WallClock {
  const parts = TZ_FORMATTER.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const minute = Number(map.minute);
  // JavaScript's getUTCDay() returns 0..6 with Sunday=0 — same convention as
  // we store in coach_availabilities.day_of_week. We compute it from the
  // formatted date so a 23:30 UTC instant maps to "tomorrow" in Vilnius.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, dayOfWeek: dow };
}

/**
 * Build a UTC instant representing `YYYY-MM-DD HH:MM` Europe/Vilnius local
 * time. DST-safe: we iterate twice so that when the first offset correction
 * lands on the wrong side of a DST jump (e.g. 02:30 spring-forward day where
 * the naive candidate falls in EEST instead of EET) the second pass nudges
 * it back. Two iterations are always enough — the worst-case correction is
 * exactly one hour.
 */
export function vilniusToUtc(date: string, hhmm: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const wantMinutes = hh * 60 + mm;
  const wantDay = y * 10000 + m * 100 + d;
  // First guess: pretend Vilnius is UTC. The loop corrects offsets and DST.
  let candidate = new Date(Date.UTC(y, m - 1, d, hh, mm));
  for (let iter = 0; iter < 2; iter++) {
    const got = partsAtVilnius(candidate);
    const gotMinutes = got.hour * 60 + got.minute;
    const gotDay = got.year * 10000 + got.month * 100 + got.day;
    let dayDeltaMinutes = 0;
    if (gotDay > wantDay) dayDeltaMinutes = 24 * 60;
    else if (gotDay < wantDay) dayDeltaMinutes = -24 * 60;
    const offsetMinutes = gotMinutes + dayDeltaMinutes - wantMinutes;
    if (offsetMinutes === 0) break;
    candidate = new Date(candidate.getTime() - offsetMinutes * 60_000);
  }
  return candidate;
}

export function hhmmInVilnius(d: Date): string {
  const p = partsAtVilnius(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

// ─── Slot math ───────────────────────────────────────────────────────────────

export interface Range {
  start: number; // ms epoch
  end: number;
}

/**
 * Subtract a set of blocking ranges from a single open range. Returns 0..n
 * sub-ranges that survived. Inputs need not be sorted; we sort the blockers
 * once and sweep linearly.
 */
export function subtractRanges(open: Range, blockers: Range[]): Range[] {
  const active = blockers
    .filter((b) => b.end > open.start && b.start < open.end)
    .map((b) => ({ start: Math.max(b.start, open.start), end: Math.min(b.end, open.end) }))
    .sort((a, b) => a.start - b.start);

  const out: Range[] = [];
  let cursor = open.start;
  for (const b of active) {
    if (b.start > cursor) out.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < open.end) out.push({ start: cursor, end: open.end });
  return out;
}

/**
 * Slice a continuous range into back-to-back 30-min slots, dropping any
 * trailing remainder that's shorter than a full slot.
 */
export function explodeIntoSlots(r: Range): CoachAvailabilitySlot[] {
  const step = SLOT_MINUTES * 60_000;
  const slots: CoachAvailabilitySlot[] = [];
  for (let t = r.start; t + step <= r.end; t += step) {
    const startD = new Date(t);
    const endD = new Date(t + step);
    slots.push({
      start: startD.toISOString(),
      end: endD.toISOString(),
      label: hhmmInVilnius(startD),
    });
  }
  return slots;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the 30-minute slots a coach is available on the given `date`
 * (YYYY-MM-DD, interpreted in Europe/Vilnius). The set is computed from
 *   • coach_availabilities for this weekday, minus
 *   • coach_blocked_slots overlapping the date, minus
 *   • bookings.coachId = this coach with status != 'cancelled' on this date.
 */
export async function getCoachAvailability(
  coachId: number,
  date: string,
): Promise<CoachAvailabilitySlot[]> {
  // Anchor the day window: 00:00 Vilnius local through 00:00 next-day Vilnius
  // local. Both ends are real UTC instants — the day is 23, 24, or 25 hours
  // long depending on DST, and that's fine because we compute the wall-clock
  // bounds from coach_availabilities below.
  const dayStartUtc = vilniusToUtc(date, "00:00");
  const dow = partsAtVilnius(dayStartUtc).dayOfWeek;

  // bookings.coachId stores the coach's Clerk userId (mirrors bookerUserId
  // pattern). Resolve it once so the bookings subtraction can filter by it.
  const [coachRow] = await db
    .select({ userId: coachesTable.userId })
    .from(coachesTable)
    .where(eq(coachesTable.id, coachId));
  const coachUserId = coachRow?.userId ?? null;

  const [hours, blocks, bookings] = await Promise.all([
    db.select()
      .from(coachAvailabilitiesTable)
      .where(and(
        eq(coachAvailabilitiesTable.coachId, coachId),
        eq(coachAvailabilitiesTable.dayOfWeek, dow),
      )),
    db.select()
      .from(coachBlockedSlotsTable)
      .where(and(
        eq(coachBlockedSlotsTable.coachId, coachId),
        // Window the blocker query so we don't load all-time blocks for one
        // day's lookup. We use a generous +1-day upper bound to catch blocks
        // that cross midnight.
        gte(coachBlockedSlotsTable.endTime, dayStartUtc),
        lt(coachBlockedSlotsTable.startTime, new Date(dayStartUtc.getTime() + 36 * 3600 * 1000)),
      )),
    coachUserId
      ? db.select({
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
        })
          .from(bookingsTable)
          .where(and(
            eq(bookingsTable.coachId, coachUserId),
            eq(bookingsTable.date, date),
            ne(bookingsTable.status, "cancelled"),
          ))
      : Promise.resolve([] as Array<{ startTime: string; endTime: string }>),
  ]);

  if (hours.length === 0) return [];

  const blockers: Range[] = [
    ...blocks.map((b) => ({ start: b.startTime.getTime(), end: b.endTime.getTime() })),
    // Bookings store HH:MM in Vilnius local time on `date`; convert through
    // the same DST-safe path used by availabilities so a 02:30 booking on
    // spring-forward day occupies the right UTC range.
    ...bookings.map((b) => ({
      start: vilniusToUtc(date, b.startTime).getTime(),
      end: vilniusToUtc(date, b.endTime).getTime(),
    })),
  ];

  const slots: CoachAvailabilitySlot[] = [];
  for (const h of hours) {
    const openStart = vilniusToUtc(date, h.startTime).getTime();
    const openEnd = vilniusToUtc(date, h.endTime).getTime();
    if (openEnd <= openStart) continue;
    for (const sub of subtractRanges({ start: openStart, end: openEnd }, blockers)) {
      slots.push(...explodeIntoSlots(sub));
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return slots;
}
