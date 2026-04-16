import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderUserId: text("sender_user_id").notNull(),
  senderName: text("sender_name").notNull(),
  recipientUserId: text("recipient_user_id").notNull(),
  body: text("body").notNull(),
  contextType: text("context_type"),
  contextId: integer("context_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
