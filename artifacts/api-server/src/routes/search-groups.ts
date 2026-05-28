import { Router, type IRouter } from "express";
import { sql, eq, and, or, inArray, desc } from "drizzle-orm";
import { db, bookingsTable, courtsTable, courtBlockedSlotsTable, reviewsTable } from "@workspace/db";
import { buildDayPriceMap } from "../lib/pricing";
import { generateManagementToken } from "./bookings";
import { getCurrentUserId } from "../lib/auth";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchGroupResult {
  facilityId: number;
  facilityName: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cancellationPolicy: "standard" | "strict";
  sport: string;
  courtCount: number;
  startingPrice: number | null;
  photos: string[];
  isPromoted: boolean;
  groupRating: number | null;
  instantBookable: boolean;
  isIndoorAvailable: boolean;
  isOutdoorAvailable: boolean;
}

export interface GroupDetailCourt {
  id: number;
  name: string;
  surface: string | null;
  isIndoor: boolean;
  maxPlayers: number;
  effectiveHourlyPrice: number;
  instantBookingEnabled: boolean;
  rating: number | null;
  photos: string[];
  amenities: string[];
  workingHours: string | null;
  hasSmartLock: boolean;
  accessInstructions: string | null;
}

export interface GroupDetailResult {
  facility: {
    id: number;
    name: string;
    city: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    cancellationPolicy: "standard" | "strict";
    businessHours: string | null;
    phone: string | null;
    email: string | null;
    equipment: string[];
    socialFacebook: string | null;
    socialInstagram: string | null;
    socialWhatsapp: string | null;
  };
  sport: string;
  courtCount: number;
  startingPrice: number | null;
  groupRating: number | null;
  mergedPhotos: string[];
  mergedAmenities: string[];
  surfacesAvailable: string[];
  isIndoorAvailable: boolean;
  isOutdoorAvailable: boolean;
  availableSports: string[];
  courts: GroupDetailCourt[];
}

// Raw row shape returned by postgres driver (snake_case, bigint as string)
interface SearchGroupRow {
  facility_id: number;
  facility_name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cancellation_policy: string;
  sport: string;
  court_count: string;        // pg returns COUNT as string
  starting_price: string | null;
  group_rating: string | null;
  is_promoted: boolean;
  instant_bookable: boolean;
  is_indoor_available: boolean;
  is_outdoor_available: boolean;
  photos: string[] | null;
}

function formatGroup(row: SearchGroupRow): SearchGroupResult {
  return {
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    city: row.city,
    address: row.address,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    cancellationPolicy: (row.cancellation_policy ?? "standard") as "standard" | "strict",
    sport: row.sport,
    courtCount: parseInt(row.court_count, 10),
    startingPrice: row.starting_price != null ? Number(row.starting_price) : null,
    photos: row.photos ?? [],
    isPromoted: row.is_promoted ?? false,
    groupRating: row.group_rating != null ? Number(row.group_rating) : null,
    instantBookable: row.instant_bookable ?? false,
    isIndoorAvailable: row.is_indoor_available ?? false,
    isOutdoorAvailable: row.is_outdoor_available ?? false,
  };
}

// ── GET /api/search/groups ────────────────────────────────────────────────────
// Public grouped search. All per-court filters are applied BEFORE GROUP BY so
// courtCount and startingPrice reflect only the courts matching the filters.

router.get("/search/groups", async (req, res): Promise<void> => {
  const sport    = typeof req.query.sport    === "string" ? req.query.sport.trim()    : null;
  const city     = typeof req.query.city     === "string" ? req.query.city.trim()     : null;
  const surface  = typeof req.query.surface  === "string" ? req.query.surface.trim()  : null;
  const condition = typeof req.query.condition === "string" ? req.query.condition.trim() : null;
  const isIndoor = req.query.isIndoor === "true" ? true : req.query.isIndoor === "false" ? false : null;
  const minPrice = typeof req.query.minPrice === "string" && req.query.minPrice.trim() !== "" && isFinite(Number(req.query.minPrice)) ? Number(req.query.minPrice) : null;
  const maxPrice = typeof req.query.maxPrice === "string" && req.query.maxPrice.trim() !== "" && isFinite(Number(req.query.maxPrice)) ? Number(req.query.maxPrice) : null;

  const sportFilter    = sport    != null ? sql`AND REPLACE(c.type, '-', '_') = ${sport}`    : sql``;
  const cityFilter     = city     != null ? sql`AND f.city = ${city}`                         : sql``;
  const surfaceFilter  = surface  != null ? sql`AND c.surface = ${surface}`                   : sql``;
  const conditionFilter= condition != null ? sql`AND c.condition = ${condition}`              : sql``;
  const indoorFilter   = isIndoor != null ? sql`AND c.is_indoor = ${isIndoor}`               : sql``;
  const minPriceFilter = minPrice != null ? sql`AND eff_price >= ${minPrice}`                 : sql``;
  const maxPriceFilter = maxPrice != null ? sql`AND eff_price <= ${maxPrice}`                 : sql``;

  const query = sql`
    WITH matching_courts AS (
      SELECT
        c.id,
        c.facility_id,
        REPLACE(c.type, '-', '_')                                        AS sport,
        c.is_indoor,
        c.surface,
        c.condition,
        c.rating,
        c.instant_booking_enabled,
        c.promoted_until,
        COALESCE(
          (SELECT MIN(cp.price)::numeric * 2
           FROM court_pricing cp WHERE cp.court_id = c.id),
          c.price_per_hour::numeric
        )                                                                AS eff_price
      FROM courts c
      JOIN facilities f ON c.facility_id = f.id
      WHERE c.status IN ('approved', 'active')
        AND f.verification_status = 'active'
        ${sportFilter}
        ${cityFilter}
        ${surfaceFilter}
        ${conditionFilter}
        ${indoorFilter}
    ),
    filtered_courts AS (
      SELECT * FROM matching_courts
      WHERE TRUE
        ${minPriceFilter}
        ${maxPriceFilter}
    ),
    grouped AS (
      SELECT
        fc.facility_id,
        fc.sport,
        COUNT(fc.id)                          AS court_count,
        MIN(fc.eff_price)                     AS starting_price,
        ARRAY_AGG(fc.id)                      AS court_ids,
        AVG(fc.rating)                        AS group_rating,
        BOOL_OR(fc.promoted_until > NOW())    AS is_promoted,
        BOOL_OR(fc.instant_booking_enabled)   AS instant_bookable,
        BOOL_OR(fc.is_indoor)                 AS is_indoor_available,
        BOOL_OR(NOT fc.is_indoor)             AS is_outdoor_available
      FROM filtered_courts fc
      GROUP BY fc.facility_id, fc.sport
    )
    SELECT
      g.facility_id,
      f.name                                  AS facility_name,
      f.city,
      f.address,
      f.latitude,
      f.longitude,
      f.cancellation_policy,
      g.sport,
      g.court_count,
      g.starting_price,
      g.group_rating,
      g.is_promoted,
      g.instant_bookable,
      g.is_indoor_available,
      g.is_outdoor_available,
      (
        SELECT ARRAY_AGG(p.url ORDER BY p.display_order)
        FROM (
          SELECT url, display_order
          FROM court_photos
          WHERE court_id = ANY(g.court_ids)
          ORDER BY display_order
          LIMIT 5
        ) p
      )                                       AS photos
    FROM grouped g
    JOIN facilities f ON g.facility_id = f.id
    ORDER BY g.is_promoted DESC NULLS LAST, g.group_rating DESC NULLS LAST
  `;

  const result = await db.execute(query);
  const rows = result.rows as unknown as SearchGroupRow[];
  res.json(rows.map(formatGroup));
});

router.get("/search/groups/:facilityId/:sport", async (req, res): Promise<void> => {
  const facilityId = parseInt(req.params.facilityId, 10);
  const sportRaw   = req.params.sport;
  if (isNaN(facilityId) || !sportRaw) {
    res.status(400).json({ error: "Invalid facilityId or sport" });
    return;
  }
  const sport = sportRaw.replace(/-/g, "_");

  const isIndoor  = req.query.isIndoor  === "true" ? true : req.query.isIndoor  === "false" ? false : null;
  const surface   = typeof req.query.surface  === "string" ? req.query.surface  : null;
  const condition = typeof req.query.condition === "string" ? req.query.condition : null;

  // ── Pass 1: full group metadata (unfiltered, visibility gate only) ──────────
  const metaResult = await db.execute(sql`
    SELECT
      ARRAY_AGG(DISTINCT REPLACE(c.type, '-', '_')) FILTER (WHERE c.type IS NOT NULL) AS available_sports,
      ARRAY_AGG(DISTINCT c.surface)                 FILTER (WHERE c.surface IS NOT NULL) AS surfaces_available,
      BOOL_OR(c.is_indoor)                                                               AS is_indoor_available,
      BOOL_OR(NOT c.is_indoor)                                                           AS is_outdoor_available
    FROM courts c
    JOIN facilities f ON c.facility_id = f.id
    WHERE c.facility_id = ${facilityId}
      AND c.status IN ('approved', 'active')
      AND f.verification_status = 'active'
  `);

  const meta = metaResult.rows[0] as {
    available_sports: string[] | null;
    surfaces_available: string[] | null;
    is_indoor_available: boolean;
    is_outdoor_available: boolean;
  } | undefined;

  if (!meta || !meta.available_sports?.length) {
    res.status(404).json({ error: "Facility not found or no active courts" });
    return;
  }

  if (!meta.available_sports.includes(sport)) {
    res.status(404).json({ error: "Sport not available at this facility" });
    return;
  }

  // ── Fetch facility details ───────────────────────────────────────────────────
  const facilityResult = await db.execute(sql`
    SELECT id, name, city, address, latitude, longitude,
           cancellation_policy, business_hours, phone, email,
           equipment, social_facebook, social_instagram, social_whatsapp
    FROM facilities
    WHERE id = ${facilityId}
      AND verification_status = 'active'
  `);

  const facilityRow = facilityResult.rows[0] as {
    id: number; name: string; city: string | null; address: string | null;
    latitude: number | null; longitude: number | null;
    cancellation_policy: string; business_hours: string | null;
    phone: string | null; email: string | null;
    equipment: string[] | null;
    social_facebook: string | null; social_instagram: string | null;
    social_whatsapp: string | null;
  } | undefined;

  if (!facilityRow) {
    res.status(404).json({ error: "Facility not found" });
    return;
  }

  // ── Pass 2: filtered courts ──────────────────────────────────────────────────
  const indoorFilter    = isIndoor  != null  ? sql`AND c.is_indoor = ${isIndoor}`    : sql``;
  const surfaceFilter   = surface   != null  ? sql`AND c.surface = ${surface}`       : sql``;
  const conditionFilter = condition != null  ? sql`AND c.condition = ${condition}`   : sql``;

  const courtsResult = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.surface,
      c.is_indoor,
      c.max_players,
      COALESCE(
        (SELECT MIN(cp.price)::numeric * 2 FROM court_pricing cp WHERE cp.court_id = c.id),
        c.price_per_hour::numeric
      )                             AS effective_hourly_price,
      c.instant_booking_enabled,
      c.rating,
      c.amenities,
      c.working_hours,
      c.has_smart_lock,
      c.access_instructions,
      COALESCE(
        (SELECT ARRAY_AGG(url ORDER BY display_order)
         FROM court_photos WHERE court_id = c.id),
        ARRAY[]::text[]
      )                             AS photos
    FROM courts c
    WHERE c.facility_id = ${facilityId}
      AND REPLACE(c.type, '-', '_') = ${sport}
      AND c.status IN ('approved', 'active')
      ${indoorFilter}
      ${surfaceFilter}
      ${conditionFilter}
    ORDER BY c.rating DESC NULLS LAST
  `);

  type CourtRow = {
    id: number; name: string; surface: string | null; is_indoor: boolean;
    max_players: number; effective_hourly_price: string; instant_booking_enabled: boolean;
    rating: number | null; amenities: string[] | null; working_hours: string | null;
    has_smart_lock: boolean; access_instructions: string | null; photos: string[] | null;
  };

  const courtRows = courtsResult.rows as unknown as CourtRow[];

  // Merge photos — courtRows already fetches per-court photos; flatten here
  const mergedPhotos = courtRows.flatMap(c => c.photos ?? []);

  const amenitySet = new Set<string>();
  for (const c of courtRows) {
    for (const a of (c.amenities ?? [])) amenitySet.add(a);
  }

  const courts: GroupDetailCourt[] = courtRows.map(c => ({
    id: c.id,
    name: c.name,
    surface: c.surface,
    isIndoor: c.is_indoor,
    maxPlayers: c.max_players,
    effectiveHourlyPrice: Number(c.effective_hourly_price),
    instantBookingEnabled: c.instant_booking_enabled,
    rating: c.rating != null ? Number(c.rating) : null,
    photos: c.photos ?? [],
    amenities: c.amenities ?? [],
    workingHours: c.working_hours,
    hasSmartLock: c.has_smart_lock,
    accessInstructions: c.access_instructions,
  }));

  const startingPrice = courts.length > 0
    ? Math.min(...courts.map(c => c.effectiveHourlyPrice))
    : null;

  const ratedCourts = courts.filter(c => c.rating != null);
  const groupRating = ratedCourts.length > 0
    ? ratedCourts.reduce((sum, c) => sum + (c.rating ?? 0), 0) / ratedCourts.length
    : null;

  const response: GroupDetailResult = {
    facility: {
      id: facilityRow.id,
      name: facilityRow.name,
      city: facilityRow.city,
      address: facilityRow.address,
      latitude: facilityRow.latitude != null ? Number(facilityRow.latitude) : null,
      longitude: facilityRow.longitude != null ? Number(facilityRow.longitude) : null,
      cancellationPolicy: (facilityRow.cancellation_policy ?? "standard") as "standard" | "strict",
      businessHours: facilityRow.business_hours,
      phone: facilityRow.phone,
      email: facilityRow.email,
      equipment: facilityRow.equipment ?? [],
      socialFacebook: facilityRow.social_facebook,
      socialInstagram: facilityRow.social_instagram,
      socialWhatsapp: facilityRow.social_whatsapp,
    },
    sport,
    courtCount: courts.length,
    startingPrice,
    groupRating,
    mergedPhotos,
    mergedAmenities: [...amenitySet],
    surfacesAvailable: meta.surfaces_available ?? [],
    isIndoorAvailable: meta.is_indoor_available,
    isOutdoorAvailable: meta.is_outdoor_available,
    availableSports: meta.available_sports ?? [],
    courts,
  };

  res.json(response);
});

// ── GET /search/groups/:facilityId/:sport/availability?date=YYYY-MM-DD ─────────
// Returns per-slot availability for the whole group: a slot is available if at
// least one court in the group is free for it. Price = min across group courts.

router.get("/search/groups/:facilityId/:sport/availability", async (req, res): Promise<void> => {
  const facilityId = parseInt(req.params.facilityId, 10);
  const sport = (req.params.sport ?? "").replace(/-/g, "_");
  const date = typeof req.query.date === "string" ? req.query.date.trim() : "";

  if (isNaN(facilityId) || !sport || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  // Get all active courts for this facility+sport
  const courts = await db
    .select({ id: courtsTable.id, name: courtsTable.name, surface: courtsTable.surface, pricePerHour: courtsTable.pricePerHour })
    .from(courtsTable)
    .where(and(
      eq(courtsTable.facilityId, facilityId),
      sql`REPLACE(${courtsTable.type}, '-', '_') = ${sport}`,
      sql`${courtsTable.status} IN ('approved', 'active')`,
    ));

  if (courts.length === 0) {
    res.status(404).json({ error: "No active courts found for this group" });
    return;
  }

  const courtIds = courts.map(c => c.id);
  const minDefaultSlotPrice = Math.min(...courts.map(c => Number(c.pricePerHour) / 2));

  // Fetch all bookings and blocked slots for all courts on this date in parallel
  const [allBookings, allBlocked] = await Promise.all([
    db.select({ courtId: bookingsTable.courtId, startTime: bookingsTable.startTime, endTime: bookingsTable.endTime })
      .from(bookingsTable)
      .where(and(
        inArray(bookingsTable.courtId, courtIds),
        eq(bookingsTable.date, date),
        or(
          eq(bookingsTable.status, "confirmed"),
          eq(bookingsTable.status, "blocked"),
          eq(bookingsTable.status, "awaiting_players"),
          and(
            eq(bookingsTable.status, "pending"),
            sql`${bookingsTable.createdAt} > NOW() - INTERVAL '15 minutes'`
          )
        )
      )),
    db.select({ courtId: courtBlockedSlotsTable.courtId, startTime: courtBlockedSlotsTable.startTime, endTime: courtBlockedSlotsTable.endTime })
      .from(courtBlockedSlotsTable)
      .where(and(
        inArray(courtBlockedSlotsTable.courtId, courtIds),
        eq(courtBlockedSlotsTable.date, date),
      )),
  ]);

  // Per-court occupied slot set: { courtId -> Set<startTime> }
  const occupiedByCourtId = new Map<number, Set<string>>(courtIds.map(id => [id, new Set()]));
  function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

  for (const b of [...allBookings, ...allBlocked]) {
    if (b.courtId == null) continue;
    const set = occupiedByCourtId.get(b.courtId);
    if (!set) continue;
    const bStart = toMin(b.startTime);
    const bEnd = toMin(b.endTime);
    for (let m = bStart; m < bEnd; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      set.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }

  // Build slot grid 06:00-23:00
  const slots: { startTime: string; endTime: string; isAvailable: boolean; price: number }[] = [];
  for (let h = 6; h < 23; h++) {
    for (const m of [0, 30]) {
      const startTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const endMin = h * 60 + m + 30;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      const isAvailable = courtIds.some(id => !occupiedByCourtId.get(id)?.has(startTime));
      slots.push({ startTime, endTime, isAvailable, price: minDefaultSlotPrice });
    }
  }

  const courtList = courts.map(c => ({ id: c.id, name: c.name, surface: c.surface }));
  res.json({ facilityId, sport, date, slots, courts: courtList });
});

// ── POST /search/groups/:facilityId/:sport/book ───────────────────────────────
// Auto-allocation: iterate courts, pick the first free one, create a booking.

router.post("/search/groups/:facilityId/:sport/book", async (req, res): Promise<void> => {
  const facilityId = parseInt(req.params.facilityId, 10);
  const sport = (req.params.sport ?? "").replace(/-/g, "_");

  if (isNaN(facilityId) || !sport) {
    res.status(400).json({ error: "Invalid facilityId or sport" });
    return;
  }

  const { date, startTime, endTime, customerName, customerEmail, customerPhone } = req.body ?? {};

  if (
    typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof startTime !== "string" || !/^\d{2}:\d{2}$/.test(startTime) ||
    typeof endTime !== "string" || !/^\d{2}:\d{2}$/.test(endTime) ||
    typeof customerName !== "string" || customerName.trim() === "" ||
    typeof customerEmail !== "string" || customerEmail.trim() === ""
  ) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const bookerUserId = getCurrentUserId(req);

  // Get all active courts for this group, ordered by least-used first (wear & tear balancer).
  // The subquery counts active bookings in the rolling 7-day window so the court with the
  // lightest recent load is tried first, spreading physical surface wear evenly.
  const courtsRaw = await db.execute(sql`
    SELECT
      c.id,
      c.price_per_hour AS "pricePerHour",
      COUNT(b.id) FILTER (
        WHERE b.status IN ('confirmed', 'awaiting_players')
           OR (b.status = 'pending' AND b.created_at > NOW() - INTERVAL '15 minutes')
      ) AS booking_count
    FROM courts c
    LEFT JOIN bookings b
      ON b.court_id = c.id
     AND b.created_at >= NOW() - INTERVAL '7 days'
    WHERE c.facility_id = ${facilityId}
      AND REPLACE(c.type, '-', '_') = ${sport}
      AND c.status IN ('approved', 'active')
    GROUP BY c.id, c.price_per_hour
    ORDER BY booking_count ASC, c.id ASC
  `);
  const courts = (courtsRaw.rows as { id: number; pricePerHour: string; booking_count: string }[])
    .map(r => ({ id: r.id, pricePerHour: r.pricePerHour }));

  if (courts.length === 0) {
    res.status(404).json({ error: "No active courts found for this group" });
    return;
  }

  function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
  const reqStartMin = toMin(startTime);
  const reqEndMin = toMin(endTime);
  const dateInt = parseInt(date.replace(/-/g, ""), 10);

  function slotsBetween(s: string, e: string): string[] {
    const result: string[] = [];
    for (let m = toMin(s); m < toMin(e); m += 30) {
      result.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return result;
  }

  class ConflictError extends Error {
    constructor(public readonly body: unknown) { super("Conflict"); }
  }

  // Try each court in turn; first one without a conflict wins.
  for (const court of courts) {
    const defaultSlotPrice = Number(court.pricePerHour) / 2;

    try {
      const booking = await db.transaction(async (tx) => {
        // Advisory lock per court+date — blocks concurrent requests for same slot
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(court.id))}::int, ${sql.raw(String(dateInt))}::int)`);

        const [conflictingBookings, conflictingBlocked] = await Promise.all([
          tx.select({ startTime: bookingsTable.startTime, endTime: bookingsTable.endTime })
            .from(bookingsTable)
            .where(and(
              eq(bookingsTable.courtId, court.id),
              eq(bookingsTable.date, date),
              or(
                eq(bookingsTable.status, "confirmed"),
                eq(bookingsTable.status, "blocked"),
                eq(bookingsTable.status, "awaiting_players"),
                and(
                  eq(bookingsTable.status, "pending"),
                  sql`${bookingsTable.createdAt} > NOW() - INTERVAL '15 minutes'`
                )
              )
            )),
          tx.select({ startTime: courtBlockedSlotsTable.startTime, endTime: courtBlockedSlotsTable.endTime })
            .from(courtBlockedSlotsTable)
            .where(and(
              eq(courtBlockedSlotsTable.courtId, court.id),
              eq(courtBlockedSlotsTable.date, date),
            )),
        ]);

        for (const b of [...conflictingBookings, ...conflictingBlocked]) {
          const bStart = toMin(b.startTime);
          const bEnd = toMin(b.endTime);
          if (reqStartMin < bEnd && reqEndMin > bStart) {
            throw new ConflictError({ courtId: court.id });
          }
        }

        // Court is free — compute price and insert
        const { priceMap } = await buildDayPriceMap(court.id, date, defaultSlotPrice);
        let courtPrice = 0;
        for (const s of slotsBetween(startTime, endTime)) {
          courtPrice += priceMap.get(s) ?? defaultSlotPrice;
        }

        const managementToken = bookerUserId ? null : generateManagementToken();

        const [inserted] = await tx.insert(bookingsTable).values({
          courtId: court.id,
          bookerUserId: bookerUserId ?? null,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerPhone: customerPhone?.trim() ?? null,
          date,
          startTime,
          endTime,
          totalPrice: String(courtPrice),
          status: "pending",
          managementToken,
        }).returning();

        return inserted;
      });

      // Successfully booked — return the booking
      res.status(201).json({
        id: booking.id,
        courtId: booking.courtId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalPrice: Number(booking.totalPrice),
        status: booking.status,
        managementToken: booking.managementToken ?? undefined,
      });
      return;
    } catch (err) {
      if (err instanceof ConflictError) continue; // try next court
      throw err;
    }
  }

  // All courts were busy
  res.status(409).json({ error: "No available court for the selected time slot", code: "SLOT_UNAVAILABLE" });
});

// ── GET /search/groups/:facilityId/:sport/reviews ─────────────────────────────
// Paginated published reviews for all courts in this facility+sport group.

router.get("/search/groups/:facilityId/:sport/reviews", async (req, res): Promise<void> => {
  const facilityId = parseInt(req.params.facilityId, 10);
  const sportRaw   = req.params.sport;
  if (isNaN(facilityId) || !sportRaw) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  const sport = sportRaw.replace(/-/g, "_");

  const rawLimit = Number(req.query.limit ?? 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 10;
  const rawPage = Number(req.query.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;
  const offset = (page - 1) * limit;

  // Resolve court IDs for this facility+sport
  const courts = await db
    .select({ id: courtsTable.id, rating: courtsTable.rating, reviewCount: courtsTable.reviewCount })
    .from(courtsTable)
    .where(and(
      eq(courtsTable.facilityId, facilityId),
      sql`REPLACE(${courtsTable.type}, '-', '_') = ${sport}`,
      sql`${courtsTable.status} IN ('approved', 'active')`,
    ));

  if (courts.length === 0) {
    res.json({ averageRating: null, reviewCount: 0, items: [], hasMore: false });
    return;
  }

  const courtIds = courts.map(c => c.id);

  // Aggregate rating from denormalized court columns (weighted average)
  const totalReviews = courts.reduce((sum, c) => sum + (c.reviewCount ?? 0), 0);
  const weightedSum  = courts.reduce((sum, c) => sum + (c.rating ?? 0) * (c.reviewCount ?? 0), 0);
  const averageRating = totalReviews > 0 ? weightedSum / totalReviews : null;

  const rowsPlusOne = await db
    .select({
      id:                  reviewsTable.id,
      reviewerUserId:      reviewsTable.reviewerUserId,
      rating:              reviewsTable.rating,
      comment:             reviewsTable.comment,
      ownerReplyText:      reviewsTable.ownerReplyText,
      ownerReplyCreatedAt: reviewsTable.ownerReplyCreatedAt,
      createdAt:           reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .where(and(
      inArray(reviewsTable.courtId, courtIds),
      eq(reviewsTable.status, "published"),
    ))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rowsPlusOne.length > limit;
  const rows = hasMore ? rowsPlusOne.slice(0, limit) : rowsPlusOne;

  const userIds = Array.from(new Set(rows.map(r => r.reviewerUserId)));
  const nameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const list = await clerkClient.users.getUserList({ userId: userIds, limit: userIds.length });
      for (const u of list.data) {
        const first = (u.firstName ?? "").trim();
        const last  = (u.lastName  ?? "").trim();
        const initial = last ? `${last[0]}.` : "";
        const display = [first, initial].filter(Boolean).join(" ");
        nameByUserId.set(u.id, display || "Vartotojas");
      }
    } catch { /* fall back */ }
  }

  res.json({
    averageRating: averageRating != null ? Math.round(averageRating * 10) / 10 : null,
    reviewCount: totalReviews,
    items: rows.map(r => ({
      id:                  r.id,
      rating:              r.rating,
      comment:             r.comment ?? null,
      reviewerName:        nameByUserId.get(r.reviewerUserId) ?? "Vartotojas",
      ownerReplyText:      r.ownerReplyText ?? null,
      ownerReplyCreatedAt: r.ownerReplyCreatedAt ? r.ownerReplyCreatedAt.toISOString() : null,
      createdAt:           r.createdAt.toISOString(),
    })),
    hasMore,
  });
});

export default router;
