import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db, sportIconsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

/**
 * Default per-sport icon config. The SVG art for each `iconKey` lives in the
 * frontend (`sport-icon.tsx`); this is only the editable metadata. Mirrors the
 * code defaults so a freshly seeded DB matches the hardcoded fallbacks.
 */
export const INITIAL_SPORT_ICONS: Array<{
  sport: string;
  iconKey: string;
  color: string;
  label: string;
  sortOrder: number;
}> = [
  { sport: "tennis",            iconKey: "tennis",            color: "#84cc16", label: "Tenisas",              sortOrder: 10 },
  { sport: "basketball",        iconKey: "basketball",        color: "#f97316", label: "Krepšinis",            sortOrder: 20 },
  { sport: "padel",             iconKey: "padel",             color: "#3b82f6", label: "Padelis",              sortOrder: 30 },
  { sport: "football",          iconKey: "football",          color: "#22c55e", label: "Futbolas",             sortOrder: 40 },
  { sport: "badminton",         iconKey: "badminton",         color: "#a855f7", label: "Badmintonas",          sortOrder: 50 },
  { sport: "squash",            iconKey: "squash",            color: "#06b6d4", label: "Skvošas",              sortOrder: 60 },
  { sport: "table_tennis",      iconKey: "table_tennis",      color: "#f43f5e", label: "Stalo tenisas",        sortOrder: 70 },
  { sport: "golf",              iconKey: "golf",              color: "#ca8a04", label: "Golfas",               sortOrder: 80 },
  { sport: "snooker",           iconKey: "snooker",           color: "#0d9488", label: "Snukeris",             sortOrder: 90 },
  { sport: "bowling",           iconKey: "bowling",           color: "#dc2626", label: "Boulingas",            sortOrder: 100 },
  { sport: "volleyball",        iconKey: "volleyball",        color: "#eab308", label: "Tinklinis",            sortOrder: 110 },
  { sport: "hockey",            iconKey: "hockey",            color: "#6366f1", label: "Ledo ritulys",         sortOrder: 120 },
  { sport: "futsal",            iconKey: "futsal",            color: "#10b981", label: "Futsalas",             sortOrder: 130 },
  { sport: "floorball",         iconKey: "floorball",         color: "#e11d48", label: "Florbolas",            sortOrder: 140 },
  { sport: "beach-volleyball",  iconKey: "beach-volleyball",  color: "#0ea5e9", label: "Paplūdimio tinklinis", sortOrder: 150 },
  { sport: "pickleball",        iconKey: "pickleball",        color: "#65a30d", label: "Pickleball",           sortOrder: 160 },
];

/** Seed the sport_icons table from code defaults if empty (idempotent). */
export async function seedSportIconsIfEmpty(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(sportIconsTable);
  if (Number(count) > 0) return;
  for (const row of INITIAL_SPORT_ICONS) {
    await db.insert(sportIconsTable).values(row).onConflictDoNothing();
  }
}

/** GET /sport-icons — public list of enabled per-sport icon config, ordered. */
router.get("/sport-icons", async (_req, res): Promise<void> => {
  await seedSportIconsIfEmpty();
  const rows = await db
    .select({
      sport: sportIconsTable.sport,
      iconKey: sportIconsTable.iconKey,
      color: sportIconsTable.color,
      label: sportIconsTable.label,
      sortOrder: sportIconsTable.sortOrder,
    })
    .from(sportIconsTable)
    .where(eq(sportIconsTable.enabled, true))
    .orderBy(asc(sportIconsTable.sortOrder), asc(sportIconsTable.sport));
  // Cacheable — config changes rarely.
  res.set("Cache-Control", "public, max-age=300");
  res.json(rows);
});

/** POST /admin/sport-icons/seed — (re)seed any missing default rows. */
router.post("/admin/sport-icons/seed", requireAdmin, async (_req, res): Promise<void> => {
  let inserted = 0;
  for (const row of INITIAL_SPORT_ICONS) {
    const [existing] = await db.select({ sport: sportIconsTable.sport }).from(sportIconsTable).where(eq(sportIconsTable.sport, row.sport));
    if (!existing) {
      await db.insert(sportIconsTable).values(row);
      inserted++;
    }
  }
  res.json({ seeded: inserted, total: INITIAL_SPORT_ICONS.length });
});

export default router;
