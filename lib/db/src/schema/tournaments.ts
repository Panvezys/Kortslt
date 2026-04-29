import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { courtsTable } from "./courts";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  // Legacy single-court reference (kept nullable so we can keep current FK behaviour but allow multi-court rows)
  courtId: integer("court_id").references(() => courtsTable.id, { onDelete: "cascade" }),
  // New multi-court support — primary source of truth for which courts the tournament uses.
  // Stored as Postgres int[]; defaults to empty array for backward compatibility.
  courtIds: integer("court_ids").array().notNull().default(sql`ARRAY[]::integer[]`),
  facilityId: integer("facility_id"),
  // Original creator on the legacy single-court flow (kept for back-compat, equals organizerId for new rows)
  ownerUserId: text("owner_user_id").notNull(),
  // The coach/user who is hosting the tournament. Distinct from facility owner who must approve.
  organizerId: text("organizer_id"),
  name: text("name").notNull(),
  description: text("description"),
  sport: text("sport").notNull(),
  coverPhotoUrl: text("cover_photo_url"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  registrationDeadline: text("registration_deadline"),
  maxParticipants: integer("max_participants").notNull().default(16),
  entryFee: numeric("entry_fee", { precision: 10, scale: 2 }),
  prizeInfo: text("prize_info"),
  // Registration lifecycle: draft / open / closed / completed
  status: text("status").notNull().default("draft"),
  // Facility-owner approval lifecycle: pending / approved / rejected
  approvalStatus: text("approval_status").notNull().default("approved"),
  approvalMessage: text("approval_message"),
  format: text("format").notNull().default("single_elimination"),
  // Single-elimination bracket structure produced by /generate-bracket
  bracketData: jsonb("bracket_data"),
  isFeatured: boolean("is_featured").notNull().default(false),
  featuredUntil: timestamp("featured_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tournamentRegistrationsTable = pgTable("tournament_registrations", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournamentsTable.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  playerEmail: text("player_email").notNull(),
  playerPhone: text("player_phone"),
  userId: text("user_id"),
  status: text("status").notNull().default("confirmed"),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tournament = typeof tournamentsTable.$inferSelect;
export type TournamentRegistration = typeof tournamentRegistrationsTable.$inferSelect;
