import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id").notNull(),
  bookingId: integer("booking_id").notNull().unique(),
  rating: integer("rating").notNull(), // 1-5
  reviewText: text("review_text"),
  reviewerName: text("reviewer_name").notNull(),
  photos: text("photos"), // JSON array of photo URLs
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
