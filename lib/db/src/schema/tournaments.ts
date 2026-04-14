import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { courtsTable } from "./courts";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sport: text("sport").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  registrationDeadline: text("registration_deadline"),
  maxParticipants: integer("max_participants").notNull().default(16),
  entryFee: numeric("entry_fee", { precision: 10, scale: 2 }),
  prizeInfo: text("prize_info"),
  status: text("status").notNull().default("draft"),
  format: text("format").notNull().default("single_elimination"),
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
