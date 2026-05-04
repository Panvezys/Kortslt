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
import { sendAdminNotification, sendNotification } from "../lib/notify";
import {
  validateForVerification,
  computeNextStatusOnSubmit,
  isStripeAccountReady,
} from "../lib/facility-status";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

/**
 * Cheap readiness check using only the cached `stripeAccountStatus` on the
 * owner's profile. The webhook keeps this column accurate using the strict
 * isStripeAccountReady predicate, so 'active' implies the strict predicate
 * passed at the time of the last account.updated event.
 *
 * Used on the hot path of facility creation to avoid a Stripe round trip.
 */
async function ownerStripeReadyCached(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ stripeAccountId: userProfilesTable.stripeAccountId, stripeAccountStatus: userProfilesTable.stripeAccountStatus })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (!profile?.stripeAccountId) return false;
  return profile.stripeAccountStatus === "active";
}

/**
 * Source-of-truth readiness check that calls Stripe directly. Returns one of:
 *   - { ready: true }            — Stripe says the account is fully ready
 *   - { ready: false }           — Stripe says the account is NOT ready
 *   - { ready: false, error: … } — Stripe call failed; caller must NOT promote
 *
 * Used at the verification gate. Fail-closed by design: when we can't reach
 * Stripe, we refuse to advance the facility rather than trusting a possibly
 * stale cache. The caller surfaces a 503 so the owner retries later.
 */
async function ownerStripeReadyLive(
  userId: string,
): Promise<{ ready: boolean; error?: string }> {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (!profile?.stripeAccountId) return { ready: false };

  try {
    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);
    return { ready: isStripeAccountReady(account) };
  } catch (err: any) {
    logger.warn({ err, userId }, "ownerStripeReadyLive: Stripe call failed — failing closed");
    return { ready: false, error: err?.message ?? "Stripe unreachable" };
  }
}

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
          city: courtsTable.city,
          address: courtsTable.address,
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
  // If the owner already has a "ready" Stripe Connect account, pre-populate the new
  // facility's stripeOnboardingComplete=true so they don't get stuck in 'onboarding'
  // when they later submit it. We use the cached profile status here for speed; the
  // submit-for-verification endpoint does a live re-check so any cache drift is
  // corrected before the facility actually enters the verification queue.
  const stripeReady = await ownerStripeReadyCached(userId);

  const [facility] = await db
    .insert(facilitiesTable)
    .values({
      ...parsed.data,
      ownerUserId: userId,
      stripeOnboardingComplete: stripeReady,
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
    "cancellationWindow", "advanceBookingLimit", "businessHours"] as const;
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
 * Owner moves a facility out of 'draft' (or back into the queue from 'onboarding')
 * after filling in all required information. The "Gatekeeper" enforces:
 *   - minimum data quality (≥3 photos, lat/lng, address)
 *   - if Stripe Connect is not yet onboarded, status becomes 'onboarding'
 *   - otherwise status becomes 'pending_verification' and admin is notified
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

  const issues = validateForVerification(facility);
  if (issues.length > 0) {
    res.status(400).json({
      error: "Trūksta privalomų duomenų prieš pateikiant patvirtinimui.",
      issues,
    });
    return;
  }

  // Live Stripe sync — fail-closed. Re-check readiness against Stripe directly
  // before computing nextStatus so a missed webhook can't leave a facility stuck,
  // AND a stripe outage can't promote a stale-cached facility past the gate.
  const liveResult = await ownerStripeReadyLive(userId);
  if (liveResult.error) {
    // Stripe unreachable — refuse to advance. Owner retries when Stripe recovers.
    res.status(503).json({
      error: "Nepavyko pasiekti Stripe paslaugos. Bandykite dar kartą po kelių sekundžių.",
    });
    return;
  }
  if (liveResult.ready !== facility.stripeOnboardingComplete) {
    await db
      .update(facilitiesTable)
      .set({ stripeOnboardingComplete: liveResult.ready })
      .where(eq(facilitiesTable.id, id));
    facility.stripeOnboardingComplete = liveResult.ready;
  }

  const nextStatus = computeNextStatusOnSubmit(liveResult.ready);

  // Compare-and-set: only mutate if the row is STILL in the status we read. Prevents
  // a concurrent admin action or stripe webhook from getting clobbered by a stale submit.
  const [updated] = await db
    .update(facilitiesTable)
    .set({
      verificationStatus: nextStatus,
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

  if (nextStatus === "pending_verification") {
    await sendAdminNotification(
      "Objektas laukia patvirtinimo",
      `„${updated.name}" (${updated.city ?? "—"}) pateiktas peržiūrai.`,
      "/admin",
    );
  } else {
    // onboarding — let owner know they still need to finish Stripe Connect
    await sendNotification(
      userId,
      "facility_rejected",
      `„${updated.name}" — užbaikite Stripe Connect`,
      "Užbaikite Stripe Connect duomenis, kad objektas galėtų judėti į patvirtinimo eilę.",
      `/owner/facility/${updated.id}`,
    );
  }

  res.json({
    id: updated.id,
    verificationStatus: updated.verificationStatus,
    stripeOnboardingComplete: updated.stripeOnboardingComplete,
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
