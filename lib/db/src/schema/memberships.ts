import { pgTable, text, serial, timestamp, integer, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { courtsTable } from "./courts";
import { facilitiesTable } from "./facilities";

export const courtMembershipsTable = pgTable("court_memberships", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").references(() => courtsTable.id, { onDelete: "cascade" }),
  facilityId: integer("facility_id").references(() => facilitiesTable.id, { onDelete: "cascade" }),
  sport: text("sport"),
  name: text("name").notNull(),
  description: text("description"),
  pricePerYear: integer("price_per_year").notNull(),
  pricePerMonth: integer("price_per_month"),
  weeklySlots: integer("weekly_slots").notNull().default(1),
  conditions: text("conditions"),
  discountPercent: integer("discount_percent"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ([
  check("court_memberships_scope_check", sql`${t.courtId} IS NOT NULL OR ${t.facilityId} IS NOT NULL`),
]));

export const userMembershipsTable = pgTable("user_memberships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  courtId: integer("court_id").references(() => courtsTable.id, { onDelete: "cascade" }),
  facilityId: integer("facility_id").references(() => facilitiesTable.id, { onDelete: "cascade" }),
  sport: text("sport"),
  membershipPlanId: integer("membership_plan_id").notNull().references(() => courtMembershipsTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  status: text("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ([
  check("user_memberships_scope_check", sql`${t.courtId} IS NOT NULL OR ${t.facilityId} IS NOT NULL`),
]));

export type CourtMembership = typeof courtMembershipsTable.$inferSelect;
export type UserMembership = typeof userMembershipsTable.$inferSelect;
