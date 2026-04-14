import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { courtsTable } from "./courts";

export const courtBlockedSlotsTable = pgTable("court_blocked_slots", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),        // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),     // HH:MM
  reason: text("reason"),                  // Optional label e.g. "Maintenance"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CourtBlockedSlot = typeof courtBlockedSlotsTable.$inferSelect;
