import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const courtPriceOverridesTable = pgTable("court_price_overrides", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull(),
  date: text("date").notNull(),       // YYYY-MM-DD — the specific date this override applies to
  startTime: text("start_time").notNull(), // "08:00"
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CourtPriceOverride = typeof courtPriceOverridesTable.$inferSelect;
