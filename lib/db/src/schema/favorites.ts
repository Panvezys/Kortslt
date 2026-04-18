import { pgTable, text, integer, timestamp, primaryKey, serial } from "drizzle-orm/pg-core";

export const favoritesTable = pgTable("favorites", {
  userId: text("user_id").notNull(),
  courtId: integer("court_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.courtId] }),
}));

export type Favorite = typeof favoritesTable.$inferSelect;

export const coachFavoritesTable = pgTable("coach_favorites", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  coachId: integer("coach_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachFavorite = typeof coachFavoritesTable.$inferSelect;
