import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { coachesTable } from "./coaches";

export const coachPhotosTable = pgTable("coach_photos", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachPhoto = typeof coachPhotosTable.$inferSelect;
export type InsertCoachPhoto = typeof coachPhotosTable.$inferInsert;
