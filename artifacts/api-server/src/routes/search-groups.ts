import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

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
  const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : null;

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
        BOOL_OR(fc.instant_booking_enabled)   AS instant_bookable
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

  // Merge photos from all matching courts
  const allPhotoResults = await db.execute(sql`
    SELECT url FROM court_photos
    WHERE court_id IN (
      SELECT id FROM courts
      WHERE facility_id = ${facilityId}
        AND REPLACE(type, '-', '_') = ${sport}
        AND status IN ('approved', 'active')
        ${indoorFilter}
        ${surfaceFilter}
        ${conditionFilter}
    )
    ORDER BY display_order
  `);
  const mergedPhotos = (allPhotoResults.rows as { url: string }[]).map(r => r.url);

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

export default router;
