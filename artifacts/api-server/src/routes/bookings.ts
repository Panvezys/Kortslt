import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bookingsTable, courtsTable } from "@workspace/db";
import {
  ListBookingsQueryParams,
  CreateBookingBody,
  GetBookingParams,
  GetBookingResponse,
  CancelBookingParams,
  CancelBookingResponse,
  ListBookingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatBooking(booking: typeof bookingsTable.$inferSelect, courtName?: string) {
  return {
    ...booking,
    totalPrice: Number(booking.totalPrice),
    courtName: courtName ?? undefined,
  };
}

router.get("/bookings", async (req, res): Promise<void> => {
  const params = ListBookingsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.courtId != null) {
    conditions.push(eq(bookingsTable.courtId, params.data.courtId));
  }
  if (params.data.status) {
    conditions.push(eq(bookingsTable.status, params.data.status));
  }

  let query = db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query;
  res.json(ListBookingsResponse.parse(rows.map(r => formatBooking(r.booking, r.courtName ?? undefined))));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, parsed.data.courtId));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  const startHour = parseInt(parsed.data.startTime.split(":")[0], 10);
  const endHour = parseInt(parsed.data.endTime.split(":")[0], 10);
  const hours = endHour - startHour;
  const totalPrice = Number(court.pricePerHour) * hours;

  const [booking] = await db.insert(bookingsTable).values({
    ...parsed.data,
    totalPrice: String(totalPrice),
    status: "pending",
  }).returning();

  res.status(201).json(GetBookingResponse.parse(formatBooking(booking, court.name)));
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const params = GetBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({ booking: bookingsTable, courtName: courtsTable.name })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(GetBookingResponse.parse(formatBooking(rows[0].booking, rows[0].courtName ?? undefined)));
});

router.delete("/bookings/:id", async (req, res): Promise<void> => {
  const params = CancelBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [booking] = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(CancelBookingResponse.parse(formatBooking(booking)));
});

export default router;
