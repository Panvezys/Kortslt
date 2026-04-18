import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, courtsTable, notificationsTable, facilitiesTable, coachesTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

const router: IRouter = Router();

/** GET /admin/courts — all courts with any status, newest first */
router.get("/admin/courts", requireAdmin, async (_req, res): Promise<void> => {
  const courts = await db
    .select()
    .from(courtsTable)
    .orderBy(desc(courtsTable.createdAt));

  res.json(
    courts.map((c) => ({
      ...c,
      pricePerHour: Number(c.pricePerHour),
      description: c.description ?? undefined,
      imageUrl: c.imageUrl ?? undefined,
      rating: c.rating ?? undefined,
      surface: c.surface ?? undefined,
      phone: c.phone ?? undefined,
      openingHours: c.openingHours ?? undefined,
      ownerUserId: c.ownerUserId ?? undefined,
      ownershipDocUrl: c.ownershipDocUrl ?? undefined,
      rejectionReason: c.rejectionReason ?? undefined,
    }))
  );
});

/** PUT /admin/courts/:id/approve */
router.put("/admin/courts/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [court] = await db
    .update(courtsTable)
    .set({ status: "approved", rejectionReason: null })
    .where(eq(courtsTable.id, id))
    .returning();

  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  if (court.ownerUserId) {
    await db.insert(notificationsTable).values({
      userId: court.ownerUserId,
      type: "court_approved",
      title: `Kortas patvirtintas: ${court.name}`,
      body: "Jūsų kortas patvirtintas ir dabar matomas klientams.",
      link: "/owner",
    }).catch(() => {});
  }

  res.json({ id: court.id, status: court.status });
});

/** PUT /admin/courts/:id/reject */
const RejectBody = z.object({ reason: z.string().optional() });

router.put("/admin/courts/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = RejectBody.safeParse(req.body);
  const reason = body.success ? (body.data.reason ?? null) : null;

  const [court] = await db
    .update(courtsTable)
    .set({ status: "rejected", rejectionReason: reason })
    .where(eq(courtsTable.id, id))
    .returning();

  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  if (court.ownerUserId) {
    await db.insert(notificationsTable).values({
      userId: court.ownerUserId,
      type: "court_rejected",
      title: `Kortas atmestas: ${court.name}`,
      body: reason ? `Priežastis: ${reason}` : "Jūsų kortas buvo atmestas administratoriaus.",
      link: "/owner",
    }).catch(() => {});
  }

  res.json({ id: court.id, status: court.status, rejectionReason: court.rejectionReason });
});

// ─── Facility management ─────────────────────────────────────────────────────

/** GET /admin/facilities — all facilities with any verification status */
router.get("/admin/facilities", requireAdmin, async (_req, res): Promise<void> => {
  const facilities = await db
    .select()
    .from(facilitiesTable)
    .orderBy(desc(facilitiesTable.createdAt));
  res.json(facilities);
});

/** PUT /admin/facilities/:id/approve — set verificationStatus = 'verified' */
router.put("/admin/facilities/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [facility] = await db
    .update(facilitiesTable)
    .set({ verificationStatus: "verified", rejectionReason: null })
    .where(eq(facilitiesTable.id, id))
    .returning();

  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }

  if (facility.ownerUserId) {
    await db.insert(notificationsTable).values({
      userId: facility.ownerUserId,
      type: "facility_approved",
      title: `Objektas patvirtintas: ${facility.name}`,
      body: "Jūsų objektas patvirtintas. Dabar galite priimti rezervacijas.",
      link: `/owner/facility/${facility.id}`,
    }).catch(() => {});
  }

  res.json({ id: facility.id, verificationStatus: facility.verificationStatus });
});

/** PUT /admin/facilities/:id/reject — set verificationStatus = 'rejected' */
const RejectFacilityBody = z.object({ reason: z.string().optional() });

router.put("/admin/facilities/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = RejectFacilityBody.safeParse(req.body);
  const reason = body.success ? (body.data.reason ?? null) : null;

  const [facility] = await db
    .update(facilitiesTable)
    .set({ verificationStatus: "rejected", rejectionReason: reason })
    .where(eq(facilitiesTable.id, id))
    .returning();

  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }

  if (facility.ownerUserId) {
    await db.insert(notificationsTable).values({
      userId: facility.ownerUserId,
      type: "facility_rejected",
      title: `Objektas atmestas: ${facility.name}`,
      body: reason ? `Priežastis: ${reason}` : "Jūsų objektas buvo atmestas.",
      link: "/owner",
    }).catch(() => {});
  }

  res.json({ id: facility.id, verificationStatus: facility.verificationStatus, rejectionReason: facility.rejectionReason });
});

/** GET /admin/coaches — all coaches with any status */
router.get("/admin/coaches", requireAdmin, async (_req, res): Promise<void> => {
  const coaches = await db
    .select()
    .from(coachesTable)
    .orderBy(desc(coachesTable.createdAt));

  res.json(coaches.map(c => ({
    ...c,
    pricePerHour: c.pricePerHour != null ? Number(c.pricePerHour) : null,
  })));
});

/** PUT /admin/coaches/:id/approve */
router.put("/admin/coaches/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [coach] = await db
    .update(coachesTable)
    .set({ approvalStatus: "approved", rejectionReason: null })
    .where(eq(coachesTable.id, id))
    .returning();

  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  await db.insert(notificationsTable).values({
    userId: coach.userId,
    type: "coach_approved",
    title: "Trenerio profilis patvirtintas",
    body: `Jūsų trenerio profilis „${coach.name}" patvirtintas.`,
    isRead: false,
  }).onConflictDoNothing();

  res.json({ id: coach.id, approvalStatus: coach.approvalStatus });
});

/** PUT /admin/coaches/:id/reject */
router.put("/admin/coaches/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { reason } = req.body as { reason?: string };

  const [coach] = await db
    .update(coachesTable)
    .set({ approvalStatus: "rejected", rejectionReason: reason ?? null })
    .where(eq(coachesTable.id, id))
    .returning();

  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  await db.insert(notificationsTable).values({
    userId: coach.userId,
    type: "coach_rejected",
    title: "Trenerio profilis atmestas",
    body: reason ? `Jūsų trenerio profilis atmestas. Priežastis: ${reason}` : "Jūsų trenerio profilis atmestas.",
    isRead: false,
  }).onConflictDoNothing();

  res.json({ id: coach.id, approvalStatus: coach.approvalStatus, rejectionReason: coach.rejectionReason });
});

/** POST /admin/seed-courts — seed courts from JSON file if DB is empty */
router.post("/admin/seed-courts", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const [{ value: courtCount }] = await db.select({ value: count() }).from(courtsTable);
    if (Number(courtCount) > 0) {
      res.json({ message: `Skipped — ${courtCount} courts already exist`, inserted: 0 });
      return;
    }

    const seedPath = join(__dirname, "data/courts-seed.json");
    const seedData: Array<Record<string, unknown>> = JSON.parse(readFileSync(seedPath, "utf-8"));

    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < seedData.length; i += BATCH) {
      const batch = seedData.slice(i, i + BATCH).map((c) => ({
        name: c.name as string,
        type: c.type as string,
        description: c.description as string | null,
        address: c.address as string,
        city: c.city as string,
        latitude: c.latitude as number,
        longitude: c.longitude as number,
        pricePerHour: String(c.price_per_hour),
        imageUrl: c.image_url as string | null,
        ownerName: (c.owner_name ?? "") as string,
        ownerEmail: (c.owner_email ?? "") as string,
        ownerUserId: c.owner_user_id as string | null,
        amenities: (Array.isArray(c.amenities) ? c.amenities : []) as string[],
        isIndoor: (c.is_indoor ?? false) as boolean,
        maxPlayers: (c.max_players ?? 4) as number,
        surface: c.surface as string | null,
        condition: (c.condition ?? "good") as string,
        rating: c.rating as number | null,
        totalBookings: (c.total_bookings ?? 0) as number,
        phone: c.phone as string | null,
        openingHours: (Array.isArray(c.opening_hours) ? c.opening_hours : null) as string[] | null,
        status: (c.status ?? "approved") as string,
        ownershipDocUrl: c.ownership_doc_url as string | null,
        rejectionReason: c.rejection_reason as string | null,
      }));
      await db.insert(courtsTable).values(batch).onConflictDoNothing();
      inserted += batch.length;
    }

    // Reset the sequence to avoid ID collisions with future inserts
    const maxId = Math.max(...seedData.map((c) => Number(c.id)));
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('courts', 'id'), ${maxId}, true)`);

    res.json({ message: "Courts seeded successfully", inserted });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ error: "Seed failed", detail: String(err) });
  }
});

export default router;
