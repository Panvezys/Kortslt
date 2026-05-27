import { pgTable, text, serial, timestamp, doublePrecision, integer, boolean, smallint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Multi-stage verification workflow:
 *   draft                → Owner is still editing; not visible to public; no admin queue.
 *   pending_verification → Info complete + owner Stripe ready; awaiting admin approval.
 *   active               → Admin approved AND owner Stripe ready; visible in search.
 *   suspended            → Admin manually disabled.
 *
 * Stripe Connect readiness lives on the OWNER's user_profiles row (single source of
 * truth). The submit-for-verification endpoint refuses to advance a facility past
 * 'draft' until the owner has connected Stripe, so there is no per-facility Stripe
 * mirror column.
 */
export const FACILITY_STATUSES = [
  "draft",
  "pending_verification",
  "active",
  "suspended",
] as const;
export type FacilityStatus = (typeof FACILITY_STATUSES)[number];

export const CANCELLATION_POLICIES = ["standard", "strict"] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export const facilitiesTable = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: text("owner_user_id").notNull(),
  companyName: text("company_name"),
  registrationCode: text("registration_code"),
  address: text("address"),
  city: text("city"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  postcode: text("postcode"),
  phone: text("phone"),
  email: text("email"),
  verificationStatus: text("verification_status").notNull().default("draft"),
  verificationDocUrl: text("verification_doc_url"),
  ownershipDocUrl: text("ownership_doc_url"),
  /** Legacy field kept for backwards compatibility — mirrors verificationNotes. */
  rejectionReason: text("rejection_reason"),
  /** Admin feedback shown to the owner when status is reverted to 'draft'. */
  verificationNotes: text("verification_notes"),
  /** True once an admin has approved the facility. Combined with the owner's Stripe Connect status to gate 'active'. */
  adminVerified: boolean("admin_verified").notNull().default(false),
  photos: text("photos").array().notNull().default([]),
  equipment: text("equipment").array().notNull().default([]),
  cancellationPolicy: text("cancellation_policy").notNull().default("standard"),
  advanceBookingEnabled: boolean("advance_booking_enabled").notNull().default(false),
  advanceBookingLimit: integer("advance_booking_limit").default(30),
  businessHours: text("business_hours"),
  vatNumber: text("vat_number"),
  websiteUrl: text("website_url"),
  socialFacebook: text("social_facebook"),
  socialInstagram: text("social_instagram"),
  socialWhatsapp: text("social_whatsapp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  verificationStatusIdx: index("idx_facilities_verification_status").on(t.verificationStatus),
}));

export const insertFacilitySchema = createInsertSchema(facilitiesTable).omit({ id: true, createdAt: true });
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type Facility = typeof facilitiesTable.$inferSelect;
