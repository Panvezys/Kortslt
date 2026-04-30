import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const OWNER_EDIT_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type OwnerEditRequestStatus = (typeof OWNER_EDIT_REQUEST_STATUSES)[number];

export const ownerEditRequestsTable = pgTable("owner_edit_requests", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  entityType: text("entity_type").notNull().default("owner_business"),
  requestedData: text("requested_data").notNull(),
  currentData: text("current_data"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OwnerEditRequest = typeof ownerEditRequestsTable.$inferSelect;
