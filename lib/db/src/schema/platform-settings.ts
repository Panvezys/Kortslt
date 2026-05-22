import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";

// Singleton row: id is always 1. Enforced by app code (seed inserts id=1) and
// by the singleton check constraint below — any attempt to insert a second
// row will fail at the DB level.
export const platformSettingsTable = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  coachBumpPriceCents: integer("coach_bump_price_cents").notNull().default(1000),
  courtBumpPriceCents: integer("court_bump_price_cents").notNull().default(500),
  tournamentBumpPriceCents: integer("tournament_bump_price_cents").notNull().default(2000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformSettings = typeof platformSettingsTable.$inferSelect;
