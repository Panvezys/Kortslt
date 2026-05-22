import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, platformSettingsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const PLATFORM_SETTINGS_ID = 1;

function serializeSettings(row: typeof platformSettingsTable.$inferSelect) {
  return {
    id: row.id,
    coachBumpPriceCents: row.coachBumpPriceCents,
    courtBumpPriceCents: row.courtBumpPriceCents,
    tournamentBumpPriceCents: row.tournamentBumpPriceCents,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readOrSeedSettings(): Promise<typeof platformSettingsTable.$inferSelect> {
  const [existing] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.id, PLATFORM_SETTINGS_ID))
    .limit(1);
  if (existing) return existing;

  await db
    .insert(platformSettingsTable)
    .values({ id: PLATFORM_SETTINGS_ID })
    .onConflictDoNothing({ target: platformSettingsTable.id });

  const [seeded] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.id, PLATFORM_SETTINGS_ID))
    .limit(1);
  if (!seeded) throw new Error("Failed to seed platform_settings row");
  return seeded;
}

/** GET /platform/settings — public, returns the singleton row. */
router.get("/platform/settings", async (_req, res): Promise<void> => {
  const row = await readOrSeedSettings();
  res.json(serializeSettings(row));
});

const UpdateSettingsBody = z
  .object({
    coachBumpPriceCents: z.number().int().min(0).max(1_000_000).optional(),
    courtBumpPriceCents: z.number().int().min(0).max(1_000_000).optional(),
    tournamentBumpPriceCents: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine(
    (b) =>
      b.coachBumpPriceCents !== undefined ||
      b.courtBumpPriceCents !== undefined ||
      b.tournamentBumpPriceCents !== undefined,
    { message: "At least one price field is required" },
  );

/** PATCH /admin/platform/settings — admin only, updates the singleton row. */
router.patch("/admin/platform/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  await readOrSeedSettings();

  const [updated] = await db
    .update(platformSettingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(platformSettingsTable.id, PLATFORM_SETTINGS_ID))
    .returning();

  if (!updated) {
    res.status(500).json({ error: "update_failed" });
    return;
  }

  res.json(serializeSettings(updated));
});

export default router;
