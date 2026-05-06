import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  facilitiesTable,
  courtsTable,
  userProfilesTable,
  bookingsTable,
  gamesTable,
  reviewsTable,
  courtPricingTable,
} from "@workspace/db";
import { inArray, gte, or } from "drizzle-orm";
import { CreateFacilityBody, UpdateFacilityParams, UpdateFacilityBody, DeleteFacilityParams } from "@workspace/api-zod";
import { requireAuth, getCurrentUserId, isOwner } from "../lib/auth";
import { sendAdminNotification } from "../lib/notify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Public: minimal facility list for pickers (e.g. coach apply form).
// Only fully-active facilities are exposed to avoid leaking unapproved owner data.
router.get("/facilities/public", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: facilitiesTable.id,
      name: facilitiesTable.name,
      city: facilitiesTable.city,
      address: facilitiesTable.address,
    })
    .from(facilitiesTable)
    .where(eq(facilitiesTable.verificationStatus, "active"))
    .orderBy(facilitiesTable.name);
  res.json(rows);
});

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
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid facility ID" });
    return;
  }

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, id));
  if (!facility) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await isOwner(req, facility.ownerUserId))) {
    res.status(403).json({ error: "Forbidden" });
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
    .values({
      ...parsed.data,
      ownerUserId: userId,
    })
    .returning();

  // Note: new facilities default to 'draft' and are NOT in the verification queue yet.
  // Admin notification fires only when the facility transitions into 'pending_verification'
  // (see POST /facilities/:id/submit-for-verification and the stripe webhook).

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
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await isOwner(req, existing.ownerUserId))) {
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

router.patch("/facilities/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await isOwner(req, existing.ownerUserId))) { res.status(403).json({ error: "Forbidden" }); return; }

  const allowed = ["name", "description", "address", "city", "phone", "email",
    "postcode", "latitude", "longitude",
    "cancellationWindow", "advanceBookingLimit", "businessHours",
    "websiteUrl", "socialFacebook", "socialInstagram", "socialWhatsapp"] as const;
  type AllowedKey = typeof allowed[number];
  const updates: Partial<typeof facilitiesTable.$inferInsert> = {};
  for (const key of allowed) {
    if (key in req.body && req.body[key] !== undefined) {
      (updates as Record<AllowedKey, unknown>)[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No updatable fields" }); return; }

  const [updated] = await db.update(facilitiesTable).set(updates).where(eq(facilitiesTable.id, id)).returning();
  res.json(updated);
});

/**
 * POST /facilities/:id/submit-for-verification
 *
 * Owner submits a facility for admin review. Requirements:
 *   - facility name + address + city filled
 *   - at least 1 court added
 * No Stripe gate — facility approval is purely admin-driven.
 */
router.post("/facilities/:id/submit-for-verification", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid facility ID" }); return; }

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, id));
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }
  if (!(await isOwner(req, facility.ownerUserId))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  if (facility.verificationStatus === "active") {
    res.status(400).json({ error: "Objektas jau aktyvus." });
    return;
  }
  if (facility.verificationStatus === "pending_verification") {
    res.status(400).json({ error: "Objektas jau laukia patvirtinimo." });
    return;
  }
  if (facility.verificationStatus === "suspended") {
    res.status(400).json({ error: "Objektas sustabdytas — kreipkitės į administratorių." });
    return;
  }

  // Validate minimum required fields.
  const issues: { field: string; message: string }[] = [];
  if (!facility.name || facility.name.trim().length < 2) {
    issues.push({ field: "name", message: "Pavadinimas privalomas (bent 2 simboliai)." });
  }
  if (!facility.address || facility.address.trim().length < 3) {
    issues.push({ field: "address", message: "Reikalingas pilnas adresas." });
  }
  if (!facility.city || facility.city.trim().length < 2) {
    issues.push({ field: "city", message: "Reikalingas miestas." });
  }
  if (issues.length > 0) {
    res.status(400).json({ error: "Trūksta privalomų duomenų.", issues });
    return;
  }

  // Require at least one court before submission.
  const [{ courtCount }] = await db
    .select({ courtCount: sql<number>`count(*)::int` })
    .from(courtsTable)
    .where(eq(courtsTable.facilityId, id));
  if (Number(courtCount) === 0) {
    res.status(400).json({ error: "Pridėkite bent vieną kortą prieš pateikiant patvirtinimui." });
    return;
  }

  // Compare-and-set to prevent concurrent race.
  const [updated] = await db
    .update(facilitiesTable)
    .set({
      verificationStatus: "pending_verification",
      verificationNotes: null,
      rejectionReason: null,
    })
    .where(and(
      eq(facilitiesTable.id, id),
      eq(facilitiesTable.verificationStatus, facility.verificationStatus),
    ))
    .returning();

  if (!updated) {
    res.status(409).json({
      error: "Objekto būsena pasikeitė. Atnaujinkite puslapį ir bandykite dar kartą.",
    });
    return;
  }

  await sendAdminNotification(
    "Objektas laukia patvirtinimo",
    `„${updated.name}" (${updated.city ?? "—"}) pateiktas peržiūrai.`,
    "/admin",
  );

  res.json({
    id: updated.id,
    verificationStatus: updated.verificationStatus,
  });
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

  // Collect every court that belongs to this facility — we need their IDs to
  // cascade-delete dependent rows that don't have a DB-level FK constraint
  // (court_pricing, reviews, bookings, games), as well as those that do but
  // would otherwise be orphaned because facilities → courts is ON DELETE SET NULL.
  const facilityCourts = await db
    .select({ id: courtsTable.id })
    .from(courtsTable)
    .where(eq(courtsTable.facilityId, params.data.id));
  const courtIds = facilityCourts.map((c) => c.id);

  // Safety guard: refuse to delete if there are upcoming PAID bookings that
  // would be silently dropped. The owner must refund/cancel them first.
  if (courtIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ count: futurePaid } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(
        and(
          inArray(bookingsTable.courtId, courtIds),
          gte(bookingsTable.date, today),
          eq(bookingsTable.status, "paid"),
        ),
      );
    if (futurePaid > 0) {
      res.status(409).json({
        error: `Negalima ištrinti: yra ${futurePaid} būsimų apmokėtų rezervacijų. Pirmiausia jas atšaukite ir grąžinkite pinigus.`,
      });
      return;
    }
  }

  // Manual cascade in a transaction. Order matters:
  //  1) Delete leaf rows that reference courts/facility without an FK.
  //  2) Delete the courts (DB CASCADE handles court_blocked_slots,
  //     court_coaches, court_photos, tournaments(court_id),
  //     court_memberships, user_memberships, court_coach_invitations).
  //  3) Delete the facility itself.
  await db.transaction(async (tx) => {
    if (courtIds.length > 0) {
      await tx.delete(reviewsTable).where(inArray(reviewsTable.courtId, courtIds));
      await tx.delete(courtPricingTable).where(inArray(courtPricingTable.courtId, courtIds));
      await tx.delete(bookingsTable).where(inArray(bookingsTable.courtId, courtIds));
      await tx
        .delete(gamesTable)
        .where(
          or(
            inArray(gamesTable.courtId, courtIds),
            eq(gamesTable.facilityId, params.data.id),
          ),
        );
      await tx.delete(courtsTable).where(inArray(courtsTable.id, courtIds));
    } else {
      // Even with no courts, games may still reference the facility directly.
      await tx.delete(gamesTable).where(eq(gamesTable.facilityId, params.data.id));
    }
    await tx.delete(facilitiesTable).where(eq(facilitiesTable.id, params.data.id));
  });

  req.log.info(
    { facilityId: params.data.id, ownerUserId: userId, deletedCourts: courtIds.length },
    "facility deleted by owner",
  );
  res.status(204).send();
});

export default router;
