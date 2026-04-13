import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const favoritesTable = pgTable("favorites", {
  userId: text("user_id").notNull(),
  courtId: integer("court_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.courtId] }),
}));

export type Favorite = typeof favoritesTable.$inferSelect;
