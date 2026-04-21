import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, sportsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

export const INITIAL_SPORTS = [
  { slug: "tennis", ltName: "Tenisas", icon: "🎾" },
  { slug: "basketball", ltName: "Krepšinis", icon: "🏀" },
  { slug: "football", ltName: "Futbolas", icon: "⚽" },
  { slug: "padel", ltName: "Padelis", icon: "🏸" },
  { slug: "badminton", ltName: "Badmintonas", icon: "🏸" },
  { slug: "table-tennis", ltName: "Stalo tenisas", icon: "🏓" },
  { slug: "volleyball", ltName: "Tinklinis", icon: "🏐" },
  { slug: "squash", ltName: "Skvošas", icon: "🟡" },
  { slug: "golf", ltName: "Golfo", icon: "⛳" },
  { slug: "bowling", ltName: "Boulingas", icon: "🎳" },
  { slug: "pickleball", ltName: "Pikliboulas", icon: "🏓" },
  { slug: "hockey", ltName: "Ledo ritulys", icon: "🏒" },
  { slug: "futsal", ltName: "Futsalas", icon: "⚽" },
  { slug: "floorball", ltName: "Florbolai", icon: "🏒" },
  { slug: "beach-volleyball", ltName: "Paplūdimio tinklinis", icon: "🏐" },
];

/** Seed sports if table is empty (runs once, idempotent) */
export async function seedSportsIfEmpty(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(sportsTable);
  if (Number(count) > 0) return;
  for (const sport of INITIAL_SPORTS) {
    await db.insert(sportsTable).values(sport).onConflictDoNothing();
  }
}

/** GET /sports — list active sports, auto-seed if empty */
router.get("/sports", async (_req, res): Promise<void> => {
  await seedSportsIfEmpty();
  const rows = await db.select().from(sportsTable).where(eq(sportsTable.isActive, true)).orderBy(sportsTable.ltName);
  res.json(rows);
});

/** POST /admin/sports/seed — seed initial sports */
router.post("/admin/sports/seed", requireAdmin, async (_req, res): Promise<void> => {
  const inserted: typeof INITIAL_SPORTS[0][] = [];
  for (const sport of INITIAL_SPORTS) {
    const [existing] = await db.select().from(sportsTable).where(eq(sportsTable.slug, sport.slug));
    if (!existing) {
      await db.insert(sportsTable).values(sport);
      inserted.push(sport);
    }
  }
  res.json({ seeded: inserted.length, sports: INITIAL_SPORTS.length });
});

export default router;
