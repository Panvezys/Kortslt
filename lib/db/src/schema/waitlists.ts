import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const waitlistsTable = pgTable("waitlists", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull(),
  date: text("date").notNull(),       // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),     // HH:MM
  userId: text("user_id"),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Waitlist = typeof waitlistsTable.$inferSelect;
