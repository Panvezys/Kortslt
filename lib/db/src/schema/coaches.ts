import { pgTable, text, serial, timestamp, numeric, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { courtsTable } from "./courts";

export const coachesTable = pgTable("coaches", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  videoUrl: text("video_url"),
  pricePerHour: numeric("price_per_hour", { precision: 10, scale: 2 }),
  sports: text("sports").array().notNull().default([]),
  availabilityDescription: text("availability_description"),
  phone: text("phone"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courtCoachesTable = pgTable("court_coaches", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqCourtCoach: uniqueIndex("court_coaches_court_id_coach_id_unique").on(t.courtId, t.coachId),
}));

export const courtCoachInvitationsTable = pgTable("court_coach_invitations", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  targetUserId: text("target_user_id"),
  targetEmail: text("target_email"),
  targetName: text("target_name"),
  initiatedBy: text("initiated_by").notNull().default("owner"),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coach = typeof coachesTable.$inferSelect;
export type CourtCoach = typeof courtCoachesTable.$inferSelect;
export type CourtCoachInvitation = typeof courtCoachInvitationsTable.$inferSelect;
