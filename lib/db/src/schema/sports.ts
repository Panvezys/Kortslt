import { pgTable, text, serial, boolean, timestamp, integer, unique, real } from "drizzle-orm/pg-core";
import { gamesTable, gameParticipantsTable } from "./games";

export const sportsTable = pgTable("sports", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  ltName: text("lt_name").notNull(),
  icon: text("icon").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRatingsTable = pgTable("user_ratings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sportSlug: text("sport_slug").notNull(),
  elo: integer("elo").notNull().default(1200),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique("user_ratings_unique").on(t.userId, t.sportSlug),
}));

export const matchInvitesTable = pgTable("match_invites", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  userId: text("user_id"),
  name: text("name"),
  team: text("team"),
  status: text("status").notNull().default("pending"),
  inviteToken: text("invite_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameResultsTable = pgTable("game_results", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }).unique(),
  reportedByUserId: text("reported_by_user_id").notNull(),
  scoreTeamA: integer("score_team_a").notNull().default(0),
  scoreTeamB: integer("score_team_b").notNull().default(0),
  status: text("status").notNull().default("pending_verification"),
  autoConfirmAt: timestamp("auto_confirm_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eloHistoryTable = pgTable("elo_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sportSlug: text("sport_slug").notNull(),
  elo: integer("elo").notNull(),
  delta: integer("delta").notNull().default(0),
  gameId: integer("game_id").references(() => gamesTable.id, { onDelete: "set null" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameResultConfirmationsTable = pgTable("game_result_confirmations", {
  id: serial("id").primaryKey(),
  gameResultId: integer("game_result_id").notNull().references(() => gameResultsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique("game_result_confirmation_unique").on(t.gameResultId, t.userId),
}));

export type Sport = typeof sportsTable.$inferSelect;
export type UserRating = typeof userRatingsTable.$inferSelect;
export type MatchInvite = typeof matchInvitesTable.$inferSelect;
export type GameResult = typeof gameResultsTable.$inferSelect;
export type EloHistory = typeof eloHistoryTable.$inferSelect;
export type GameResultConfirmation = typeof gameResultConfirmationsTable.$inferSelect;
