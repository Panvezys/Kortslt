import { pgTable, text, serial, timestamp, doublePrecision, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Multi-stage verification workflow:
 *   draft                → Owner is still editing; not visible to public; no admin queue.
 *   onboarding           → Owner submitted; owner-level Stripe Connect not yet completed.
 *   pending_verification → Info complete + owner Stripe ready; awaiting admin approval.
 *   active               → Admin approved AND owner Stripe ready; visible in search.
 *   suspended            → Admin manually disabled.
 */
export const FACILITY_STATUSES = [
  "draft",
  "onboarding",
  "pending_verification",
  "active",
  "suspended",
] as const;
export type FacilityStatus = (typeof FACILITY_STATUSES)[number];

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
  /** True once an admin has approved the facility. Combined with stripeOnboardingComplete to gate 'active'. */
  adminVerified: boolean("admin_verified").notNull().default(false),
  /** True once the owner's Stripe Connect account is fully ready (synced from owner profile via webhook cascade). */
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").notNull().default(false),
  photos: text("photos").array().notNull().default([]),
  equipment: text("equipment").array().notNull().default([]),
  cancellationWindow: integer("cancellation_window"),
  advanceBookingLimit: integer("advance_booking_limit"),
  businessHours: text("business_hours"),
  vatNumber: text("vat_number"),
  websiteUrl: text("website_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFacilitySchema = createInsertSchema(facilitiesTable).omit({ id: true, createdAt: true });
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type Facility = typeof facilitiesTable.$inferSelect;
