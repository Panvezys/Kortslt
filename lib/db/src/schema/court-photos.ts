import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { courtsTable } from "./courts";

export const courtPhotosTable = pgTable("court_photos", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull().references(() => courtsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  displayOrder: integer("display_order").notNull().default(0),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CourtPhoto = typeof courtPhotosTable.$inferSelect;
export type InsertCourtPhoto = typeof courtPhotosTable.$inferInsert;
