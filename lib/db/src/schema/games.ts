import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  creatorUserId: text("creator_user_id").notNull(),
  creatorName: text("creator_name").notNull(),
  creatorEmail: text("creator_email"),
  sport: text("sport").notNull(),
  city: text("city").notNull(),
  placeName: text("place_name"),
  facilityId: integer("facility_id"),
  courtId: integer("court_id"),
  playersNeeded: integer("players_needed").notNull().default(4),
  skillLevel: text("skill_level").notNull().default("any"),
  datetime: text("datetime").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  description: text("description"),
  status: text("status").notNull().default("open"),
  matchType: text("match_type").notNull().default("casual"),
  isPrivate: boolean("is_private").notNull().default(false),
  inviteToken: text("invite_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameParticipantsTable = pgTable("game_participants", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  team: text("team"),
  status: text("status").notNull().default("joined"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Game = typeof gamesTable.$inferSelect;
export type GameParticipant = typeof gameParticipantsTable.$inferSelect;
