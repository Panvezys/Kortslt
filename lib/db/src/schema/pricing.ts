import { pgTable, serial, integer, text, numeric } from "drizzle-orm/pg-core";

export const courtPricingTable = pgTable("court_pricing", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun 1=Mon … 6=Sat
  startTime: text("start_time").notNull(),     // "07:00" – "21:30"
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
});

export type CourtPricing = typeof courtPricingTable.$inferSelect;
