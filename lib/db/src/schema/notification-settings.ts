import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationSettingsTable = pgTable("notification_settings", {
  userId: text("user_id").primaryKey(),
  gameJoinRequest: boolean("game_join_request").notNull().default(true),
  gameCancelled: boolean("game_cancelled").notNull().default(true),
  bookingCreated: boolean("booking_created").notNull().default(true),
  bookingCancelled: boolean("booking_cancelled").notNull().default(true),
  courtApproved: boolean("court_approved").notNull().default(true),
  messageReceived: boolean("message_received").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationSettings = typeof notificationSettingsTable.$inferSelect;
