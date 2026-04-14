import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, courtsTable } from "@workspace/db";
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
  res.json({ id: court.id, status: court.status, rejectionReason: court.rejectionReason });
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
