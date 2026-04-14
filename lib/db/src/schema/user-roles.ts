import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const USER_ROLES = ["admin", "owner", "player"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const userRolesTable = pgTable("user_roles", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("player"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRoleRow = typeof userRolesTable.$inferSelect;

export const userRoleSchema = z.enum(["admin", "owner", "player"]);
