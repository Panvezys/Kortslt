import { pgTable, serial, integer, text, numeric } from "drizzle-orm/pg-core";

export const courtPricingRulesTable = pgTable("court_pricing_rules", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull(),
  type: text("type").notNull(),          // 'holiday'
  startTime: text("start_time"),         // "HH:MM" — null means applies to all slots (legacy)
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
});

export type CourtPricingRule = typeof courtPricingRulesTable.$inferSelect;
