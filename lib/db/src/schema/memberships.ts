import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { courtsTable } from "./courts";

export const courtMembershipsTable = pgTable("court_memberships", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  pricePerYear: integer("price_per_year").notNull(),
  weeklySlots: integer("weekly_slots").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userMembershipsTable = pgTable("user_memberships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  membershipPlanId: integer("membership_plan_id").notNull().references(() => courtMembershipsTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  status: text("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CourtMembership = typeof courtMembershipsTable.$inferSelect;
export type UserMembership = typeof userMembershipsTable.$inferSelect;
