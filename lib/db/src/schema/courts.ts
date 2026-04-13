import { pgTable, text, serial, timestamp, numeric, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const courtsTable = pgTable("courts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'tennis' | 'basketball'
  description: text("description"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  pricePerHour: numeric("price_per_hour", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  amenities: text("amenities").array().notNull().default([]),
  isIndoor: boolean("is_indoor").notNull().default(false),
  maxPlayers: integer("max_players").notNull().default(4),
  rating: real("rating"),
  totalBookings: integer("total_bookings").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCourtSchema = createInsertSchema(courtsTable).omit({ id: true, createdAt: true });
export type InsertCourt = z.infer<typeof insertCourtSchema>;
export type Court = typeof courtsTable.$inferSelect;
