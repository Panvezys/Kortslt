import { pgTable, text, serial, timestamp, numeric, boolean, integer, real } from "drizzle-orm/pg-core";
import { facilitiesTable } from "./facilities";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const courtsTable = pgTable("courts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  pricePerHour: numeric("price_per_hour", { precision: 10, scale: 2 }).notNull(),
  rentableItems: text("rentable_items"),
  imageUrl: text("image_url"),
  amenities: text("amenities").array().notNull().default([]),
  isIndoor: boolean("is_indoor").notNull().default(false),
  maxPlayers: integer("max_players").notNull().default(4),
  surface: text("surface"),
  // Surface performance specs
  surfaceSpeed: text("surface_speed"),  // 'slow' | 'medium' | 'fast'
  surfaceBounce: text("surface_bounce"), // 'low' | 'medium' | 'high'
  condition: text("condition").notNull().default("good"),
  rating: real("rating"),
  totalBookings: integer("total_bookings").notNull().default(0),
  phone: text("phone"),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  socialFacebook: text("social_facebook"),
  socialInstagram: text("social_instagram"),
  socialWhatsapp: text("social_whatsapp"),
  socialWebsite: text("social_website"),
  instantBookingEnabled: boolean("instant_booking_enabled").notNull().default(true),
  facilityId: integer("facility_id").notNull().references(() => facilitiesTable.id, { onDelete: "cascade" }),
  workingHours: text("working_hours"),
  amenityPhotos: text("amenity_photos"),
  // Smart lock / unmanned facility access
  hasSmartLock: boolean("has_smart_lock").notNull().default(false),
  accessInstructions: text("access_instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCourtSchema = createInsertSchema(courtsTable).omit({ id: true, createdAt: true });
export type InsertCourt = z.infer<typeof insertCourtSchema>;
export type Court = typeof courtsTable.$inferSelect;
