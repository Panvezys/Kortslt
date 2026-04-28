import { pgTable, text, boolean, timestamp, serial, integer, unique } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  activityPublic: boolean("activity_public").notNull().default(true),
  bio: text("bio"),
  imageUrl: text("image_url"),
  stripeAccountId: text("stripe_account_id"),
  stripeAccountStatus: text("stripe_account_status").notNull().default("not_connected"),
  reliabilityScore: integer("reliability_score").notNull().default(100),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSportProfilesTable = pgTable("user_sport_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sport: text("sport").notNull(),
  level: text("level").notNull().default("beginner"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique("user_sport_unique").on(t.userId, t.sport),
}));

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type UserSportProfile = typeof userSportProfilesTable.$inferSelect;
