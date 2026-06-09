import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Editable per-sport icon configuration. The SVG art itself lives in code
 * (`sport-icon.tsx`, keyed by `iconKey`) — this table only stores the
 * overridable metadata (which icon, color, label, ordering, enabled), so
 * defaults can be changed later without a redeploy and without ever storing
 * raw markup in the database.
 *
 * `sport` is the canonical sport slug (e.g. "tennis", "table_tennis").
 */
export const sportIconsTable = pgTable("sport_icons", {
  sport: text("sport").primaryKey(),
  iconKey: text("icon_key").notNull(),
  color: text("color").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SportIcon = typeof sportIconsTable.$inferSelect;
