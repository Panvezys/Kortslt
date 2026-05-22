import { db, platformSettingsTable } from "@workspace/db";
import { logger } from "./logger";

// Ensures singleton rows that the rest of the app relies on always exist.
// Idempotent: safe to run on every boot.
export async function initDatabase(): Promise<void> {
  try {
    await db
      .insert(platformSettingsTable)
      .values({ id: 1 })
      .onConflictDoNothing({ target: platformSettingsTable.id });
  } catch (err) {
    logger.error({ err }, "Database initialization failed");
    throw err;
  }
}
