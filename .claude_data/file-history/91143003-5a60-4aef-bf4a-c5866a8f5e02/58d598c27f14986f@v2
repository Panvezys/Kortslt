import { z as zod } from "zod";

// Hand-rolled (i.e. not generated from openapi.yaml) Zod schemas for the
// Strike 7 Admin Command Center. Lives outside the orval-generated module
// because admin endpoints are intentionally absent from the public OpenAPI
// surface but still need shared validation between the api-server response
// builder and the courtbook React client.

export const AdminDashboardKpis = zod.object({
  todayBookings: zod.number().int().nonnegative(),
  monthlyRevenueCents: zod.number().int().nonnegative(),
  activeUsers: zod.number().int().nonnegative(),
});

export const AdminDashboardOccupancyEntry = zod.object({
  id: zod.number().int(),
  name: zod.string(),
  bookedHours: zod.number().nonnegative(),
  // 0–100 — represents occupancy in the queried window.
  utilizationPercentage: zod.number().min(0).max(100),
});

export const AdminDashboardOccupancy = zod.object({
  courts: zod.array(AdminDashboardOccupancyEntry),
  coaches: zod.array(AdminDashboardOccupancyEntry),
});

export const AdminDashboardReservation = zod.object({
  id: zod.number().int(),
  // pending | awaiting_players | confirmed | cancelled | blocked
  status: zod.string(),
  date: zod.string(), // YYYY-MM-DD
  startTime: zod.string(), // HH:MM
  endTime: zod.string(),
  priceCents: zod.number().int().nonnegative(),
  // Either the court name (for court bookings) or the coach name (for coach
  // lessons). Coach bookings still have a courtId, so the formatter prefers
  // the coach context when the booking has a coachId attached.
  targetName: zod.string().nullable(),
  targetType: zod.enum(["court", "coach"]),
  bookerName: zod.string().nullable(),
  bookerEmail: zod.string().nullable(),
});

export const AdminDashboardMetricsResponse = zod.object({
  // Echoed back so the client knows which window was used (date defaults are
  // computed server-side when the request omits them).
  startDate: zod.string(),
  endDate: zod.string(),
  kpis: AdminDashboardKpis,
  occupancy: AdminDashboardOccupancy,
  recentReservations: zod.array(AdminDashboardReservation),
});

export type AdminDashboardKpis = zod.infer<typeof AdminDashboardKpis>;
export type AdminDashboardOccupancyEntry = zod.infer<typeof AdminDashboardOccupancyEntry>;
export type AdminDashboardOccupancy = zod.infer<typeof AdminDashboardOccupancy>;
export type AdminDashboardReservation = zod.infer<typeof AdminDashboardReservation>;
export type AdminDashboardMetricsResponse = zod.infer<typeof AdminDashboardMetricsResponse>;
