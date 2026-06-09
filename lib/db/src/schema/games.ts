import { pgTable, text, serial, timestamp, integer, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings";
import { userMembershipsTable } from "./memberships";

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
  bookingId: integer("booking_id").references(() => bookingsTable.id, { onDelete: "set null" }),
  playersNeeded: integer("players_needed").notNull().default(4),
  skillLevel: text("skill_level").notNull().default("any"),
  datetime: text("datetime").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  description: text("description"),
  // status values: pending_payment | awaiting_players | open | full | pending_verification | completed | disputed | cancelling
  status: text("status").notNull().default("open"),
  matchType: text("match_type").notNull().default("casual"),
  isPrivate: boolean("is_private").notNull().default(false),
  // visibility: 'private' (invite-only via token) | 'public' (shown on open matches feed)
  visibility: text("visibility").notNull().default("private"),
  minSkillLevel: real("min_skill_level"),
  maxSkillLevel: real("max_skill_level"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  teamCount: integer("team_count").notNull().default(2),
  inviteToken: text("invite_token"),
  // Sport-specific structured score (SetScore[] for SET_BASED, {a,b} for POINT_BASED).
  resultData: jsonb("result_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameParticipantsTable = pgTable("game_participants", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  team: text("team"),
  status: text("status").notNull().default("joined"),
  // "join_request" = user asked to join; "invite" = creator invited user (requires user acceptance)
  source: text("source").notNull().default("join_request"),
  // Split-payment tracking
  paymentStatus: text("payment_status").notNull().default("paid"), // paid | pending
  stripeSessionId: text("stripe_session_id"),
  // Membership that discounted THIS participant's split share.
  appliedMembershipId: integer("applied_membership_id").references(() => userMembershipsTable.id, { onDelete: "set null" }),
  inviteEmail: text("invite_email"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameChatTable = pgTable("game_chat", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  senderUserId: text("sender_user_id").notNull(),
  senderName: text("sender_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Game = typeof gamesTable.$inferSelect;
export type GameParticipant = typeof gameParticipantsTable.$inferSelect;
export type GameChat = typeof gameChatTable.$inferSelect;
