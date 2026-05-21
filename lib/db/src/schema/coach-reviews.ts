import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { coachesTable } from "./coaches";
import { bookingsTable } from "./bookings";

/**
 * Verified-purchase reviews for coaches. One row per booking — a coach can
 * accumulate many reviews but each underlying booking can only be reviewed
 * once (enforced by the unique constraint on bookingId).
 *
 * Invariant C (verified purchase) is enforced application-side in the
 * POST /coach-reviews handler: the reviewerUserId must own the booking,
 * the booking's coachId must resolve to the submitted coachId, and the
 * booking's scheduled end must be in the past. The unique(bookingId) here
 * is the last-line defense against double-submission races.
 *
 * Invariant D (denormalized aggregate sync) is enforced application-side
 * by the syncCoachAverageRating helper, which recomputes avg + count from
 * this table inside the same transaction that mutates a row, and writes
 * the result back to coachesTable.averageRating / reviewCount.
 */
export const coachReviewsTable = pgTable(
  "coach_reviews",
  {
    id: serial("id").primaryKey(),
    // Clerk user id — text/no-FK to mirror bookings.bookerUserId.
    reviewerUserId: text("reviewer_user_id").notNull(),
    coachId: integer("coach_id")
      .notNull()
      .references(() => coachesTable.id, { onDelete: "cascade" }),
    bookingId: integer("booking_id")
      .notNull()
      .unique()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ratingRange: check("coach_reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
    byCoachCreated: index("coach_reviews_coach_created_idx").on(
      t.coachId,
      t.createdAt,
    ),
  }),
);

export type CoachReview = typeof coachReviewsTable.$inferSelect;
