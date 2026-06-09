import { pgTable, text, serial, timestamp, numeric, integer, boolean, index } from "drizzle-orm/pg-core";
import { userMembershipsTable } from "./memberships";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  courtId: integer("court_id"),
  bookerUserId: text("booker_user_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending | awaiting_players | confirmed | cancelled | blocked
  rentedItems: text("rented_items"),
  notes: text("notes"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  stripeRefundId: text("stripe_refund_id"),
  // Opaque token allowing a guest (no Clerk session) to view & cancel their booking.
  managementToken: text("management_token").unique(),
  // Split payment fields
  isSplit: boolean("is_split").notNull().default(false),
  totalSlots: integer("total_slots"),
  pricePerSlot: numeric("price_per_slot", { precision: 10, scale: 2 }),
  splitInviteToken: text("split_invite_token").unique(),
  // Host Guarantee: saved Stripe customer + payment method for off-session charge
  hostStripeCustomerId: text("host_stripe_customer_id"),
  hostStripePaymentMethodId: text("host_stripe_payment_method_id"),
  // Smart lock access code (delivered post-payment)
  accessCode: text("access_code"),
  // Recurring booking group (null = one-off, uuid string = part of a weekly series)
  recurringGroupId: text("recurring_group_id"),
  // Membership that discounted this booking's totalPrice (whole-booking
  // discounts only — split shares track theirs on game_participants).
  // Counted against the plan's weeklySlots cap for the play-date's ISO week.
  appliedMembershipId: integer("applied_membership_id").references(() => userMembershipsTable.id, { onDelete: "set null" }),
  // Coach userId when this booking represents a coaching lesson. Nullable
  // because regular court bookings have no coach attached. Mirrors the
  // bookerUserId text-no-FK pattern in this table.
  coachId: text("coach_id"),
  // Coach service (lesson type) this booking covers, when applicable. Nullable
  // for legacy coach bookings and non-coach bookings. The booking-time
  // priceCents/durationMin/maxParticipants are SNAPSHOTTED into the booking
  // (Invariant B) — this FK is kept for analytics / "what did the student
  // book" reporting only, NOT as the source of truth for billing.
  coachServiceId: integer("coach_service_id"),
  // Coach's share of the booking, in integer cents — captured at checkout
  // so the post-payment transfer to the coach's Stripe account knows how
  // much to move without recomputing from coach.pricePerHour (which could
  // drift between checkout and confirmation).
  coachAmountCents: integer("coach_amount_cents"),
  // Set after stripe.transfers.create fires successfully. Used as an
  // idempotency marker so /payments/confirm and the webhook can't issue
  // the same transfer twice on a race.
  coachTransferId: text("coach_transfer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Admin Command Center: list/aggregate bookings within a date range and
  // status filter (e.g. SUM(price) WHERE date BETWEEN ... AND status='confirmed').
  byDateStatus: index("bookings_date_status_idx").on(t.date, t.status),
  // Per-court occupancy aggregations.
  byCourtDate: index("bookings_court_date_idx").on(t.courtId, t.date),
  // Per-coach occupancy aggregations (coachId is nullable; partial scan is fine).
  byCoachDate: index("bookings_coach_date_idx").on(t.coachId, t.date),
}));

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
