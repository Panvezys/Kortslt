import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { courtsTable } from "./courts";

export const trainersTable = pgTable("trainers", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  sports: text("sports").array().notNull().default([]),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  availabilityJson: text("availability_json"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Trainer = typeof trainersTable.$inferSelect;
