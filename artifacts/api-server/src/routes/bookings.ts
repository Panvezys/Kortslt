import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bookingsTable, courtsTable, notificationsTable } from "@workspace/db";
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
    rentedItems: booking.rentedItems ?? undefined,
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
  if (params.data.customerEmail) {
    conditions.push(eq(bookingsTable.customerEmail, params.data.customerEmail));
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
    console.error("[bookings] validation failed:", JSON.stringify(req.body), parsed.error.flatten());
    res.status(400).json({ error: parsed.error.message, details: parsed.error.flatten() });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, parsed.data.courtId));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  const startHour = parseInt(parsed.data.startTime.split(":")[0], 10);
  const startMin  = parseInt(parsed.data.startTime.split(":")[1] ?? "0", 10);
  const endHour   = parseInt(parsed.data.endTime.split(":")[0], 10);
  const endMin    = parseInt(parsed.data.endTime.split(":")[1] ?? "0", 10);
  const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  let totalPrice = Number(court.pricePerHour) * (durationMinutes / 60);

  let equipmentCost = 0;
  let validatedRentedItems: string | null = null;
  if (parsed.data.rentedItems) {
    try {
      const clientItems: Array<{ name: string; pricePerBooking?: number; quantity?: number }> = JSON.parse(parsed.data.rentedItems);
      const courtEquipment: Array<{ name: string; pricePerBooking: number }> = court.rentableItems ? JSON.parse(court.rentableItems) : [];
      const serverValidated: Array<{ name: string; pricePerBooking: number; quantity: number }> = [];
      for (const ci of clientItems) {
        const canonical = courtEquipment.find(e => e.name === ci.name);
        if (!canonical) continue;
        const qty = Math.max(1, Math.min(Math.floor(ci.quantity ?? 1), 20));
        serverValidated.push({ name: canonical.name, pricePerBooking: canonical.pricePerBooking, quantity: qty });
        equipmentCost += canonical.pricePerBooking * qty;
      }
      if (serverValidated.length > 0) validatedRentedItems = JSON.stringify(serverValidated);
    } catch {}
  }
  totalPrice += equipmentCost;

  // Normalise date to YYYY-MM-DD (the Zod schema coerces it to Date)
  const d = parsed.data.date;
  const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const [booking] = await db.insert(bookingsTable).values({
    courtId: parsed.data.courtId,
    customerName: parsed.data.customerName,
    customerEmail: parsed.data.customerEmail,
    customerPhone: parsed.data.customerPhone ?? null,
    date: dateStr,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    totalPrice: String(totalPrice),
    rentedItems: validatedRentedItems,
    status: "pending",
  }).returning();

  // Notify court owner about the new booking
  if (court.ownerUserId) {
    await db.insert(notificationsTable).values({
      userId: court.ownerUserId,
      type: "booking_created",
      title: `Nauja rezervacija — ${court.name}`,
      body: `${parsed.data.customerName} užrezervavo ${dateStr} ${parsed.data.startTime}–${parsed.data.endTime}.`,
      link: "/owner",
    }).catch(() => {});
  }

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

router.get("/bookings/:id/ics", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).send("Invalid booking id");
    return;
  }

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, id));

  if (!rows[0]) {
    res.status(404).send("Booking not found");
    return;
  }

  const { booking, courtName, courtId, courtAddress, courtCity } = rows[0];
  const siteUrl = process.env.SITE_URL || "https://korts.lt";

  function icsDateTime(date: string, time: string): string {
    return date.replace(/-/g, "") + "T" + time.slice(0, 5).replace(":", "") + "00";
  }

  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//korts.lt//Court Booking//LT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@korts.lt`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Vilnius:${icsDateTime(booking.date, booking.startTime)}`,
    `DTEND;TZID=Europe/Vilnius:${icsDateTime(booking.date, booking.endTime)}`,
    `SUMMARY:Korto rezervacija – ${courtName ?? "Kortas"}`,
    `DESCRIPTION:Rezervacija #${booking.id} per korts.lt\\n${siteUrl}/courts/${courtId}`,
    `LOCATION:${courtAddress ?? ""}, ${courtCity ?? ""}, Lietuva`,
    `URL:${siteUrl}/courts/${courtId}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="booking-${booking.id}.ics"`);
  res.send(ics);
});

export default router;
