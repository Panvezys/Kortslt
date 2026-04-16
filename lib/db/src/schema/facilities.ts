import { pgTable, text, serial, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  verificationStatus: text("verification_status").notNull().default("pending"),
  verificationDocUrl: text("verification_doc_url"),
  ownershipDocUrl: text("ownership_doc_url"),
  photos: text("photos").array().notNull().default([]),
  equipment: text("equipment").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFacilitySchema = createInsertSchema(facilitiesTable).omit({ id: true, createdAt: true });
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type Facility = typeof facilitiesTable.$inferSelect;
