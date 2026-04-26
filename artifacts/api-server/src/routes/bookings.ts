import { Router, type IRouter } from "express";
import { eq, and, inArray, or, sql } from "drizzle-orm";
import { db, bookingsTable, courtsTable, courtPricingTable, courtBlockedSlotsTable } from "@workspace/db";
import { sendNotification } from "../lib/notify";
import {
  ListBookingsQueryParams,
  CreateBookingBody,
  GetBookingParams,
  GetBookingResponse,
  CancelBookingParams,
  CancelBookingResponse,
  ListBookingsResponse,
} from "@workspace/api-zod";
import { requireAuth, isOwner, getCurrentUserId, getUserRole } from "../lib/auth";
import { z } from "zod";

function isPeakSlot(startTime: string, dayOfWeek: number): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const [h] = startTime.split(":").map(Number);
  return h >= 17 && h < 22;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotsBetween(startTime: string, endTime: string): string[] {
  const start = toMin(startTime);
  const end = toMin(endTime);
  const result: string[] = [];
  for (let m = start; m < end; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    result.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
  }
  return result;
}

const router: IRouter = Router();

function formatBooking(booking: typeof bookingsTable.$inferSelect, courtName?: string) {
  return {
    ...booking,
    totalPrice: Number(booking.totalPrice),
    rentedItems: booking.rentedItems ?? undefined,
    courtName: courtName ?? undefined,
  };
}

router.get("/bookings", requireAuth, async (req, res): Promise<void> => {
  const params = ListBookingsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getCurrentUserId(req)!;
  const role = await getUserRole(userId);

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

  if (role === "admin") {
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
  } else if (role === "owner") {
    conditions.push(eq(courtsTable.ownerUserId, userId));
    query = query.where(and(...conditions));
  } else {
    conditions.push(eq(bookingsTable.bookerUserId, userId));
    query = query.where(and(...conditions));
  }

  const rows = await query;
  res.json(ListBookingsResponse.parse(rows.map(r => formatBooking(r.booking, r.courtName ?? undefined))));
});

router.post("/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    console.error("[bookings] validation failed:", JSON.stringify(req.body), parsed.error.flatten());
    res.status(400).json({ error: parsed.error.message, details: parsed.error.flatten() });
    return;
  }

  const d0 = parsed.data.date;
  const dateStr0 = `${d0.getUTCFullYear()}-${String(d0.getUTCMonth() + 1).padStart(2, "0")}-${String(d0.getUTCDate()).padStart(2, "0")}`;
  const dayOfWeek = new Date(dateStr0 + "T00:00:00").getDay();
  const reqStart = parsed.data.startTime;
  const reqEnd = parsed.data.endTime;
  const reqStartMin = toMin(reqStart);
  const reqEndMin = toMin(reqEnd);

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, parsed.data.courtId));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  // ── Compute server-side price using per-slot pricing (same logic as availability endpoint) ──
  // This can be done outside the transaction since pricing config is owner-managed, not concurrent.
  const pricingEntries = await db.select()
    .from(courtPricingTable)
    .where(and(
      eq(courtPricingTable.courtId, parsed.data.courtId),
      eq(courtPricingTable.dayOfWeek, dayOfWeek),
    ));

  const pricingMap = new Map(pricingEntries.map(e => [e.startTime, Number(e.price)]));
  const defaultSlotPrice = Number(court.pricePerHour) / 2;
  const peakSlotPrice = court.peakPricePerHour != null ? Number(court.peakPricePerHour) / 2 : null;

  const slots = slotsBetween(reqStart, reqEnd);
  let courtPrice = 0;
  for (const slotStart of slots) {
    if (pricingMap.has(slotStart)) {
      courtPrice += pricingMap.get(slotStart)!;
    } else if (peakSlotPrice != null && isPeakSlot(slotStart, dayOfWeek)) {
      courtPrice += peakSlotPrice;
    } else {
      courtPrice += defaultSlotPrice;
    }
  }

  const durationMinutes = reqEndMin - reqStartMin;
  const slotCount = Math.round(durationMinutes / 30);
  const bufferMinutes = court.bufferMinutes ?? 0;
  const bookerUserId = getCurrentUserId(req);

  // ── Atomically check conflicts and insert within a serialized transaction ──
  // A PostgreSQL advisory lock (per court+date) blocks any concurrent booking attempt
  // for the same court on the same day, making the read-then-write conflict check atomic.
  class BookingConflictError extends Error {
    constructor(public readonly statusCode: number, public readonly body: any) {
      super("BookingConflict");
    }
  }

  let booking: typeof bookingsTable.$inferSelect;
  try {
    booking = await db.transaction(async (tx) => {
      // Acquire exclusive advisory lock for this court+date combination.
      // Released automatically at end of transaction.
      const dateInt = parseInt(dateStr0.replace(/-/g, ""), 10);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(parsed.data.courtId))}::int, ${sql.raw(String(dateInt))}::int)`);

      // ── Conflict check (inside lock) ──
      const [conflictingBookings, conflictingBlocked] = await Promise.all([
        tx.select({ startTime: bookingsTable.startTime, endTime: bookingsTable.endTime })
          .from(bookingsTable)
          .where(and(
            eq(bookingsTable.courtId, parsed.data.courtId),
            eq(bookingsTable.date, dateStr0),
            or(
              eq(bookingsTable.status, "confirmed"),
              eq(bookingsTable.status, "blocked"),
              and(
                eq(bookingsTable.status, "pending"),
                sql`${bookingsTable.createdAt} > NOW() - INTERVAL '10 minutes'`
              )
            )
          )),
        tx.select({ startTime: courtBlockedSlotsTable.startTime, endTime: courtBlockedSlotsTable.endTime })
          .from(courtBlockedSlotsTable)
          .where(and(
            eq(courtBlockedSlotsTable.courtId, parsed.data.courtId),
            eq(courtBlockedSlotsTable.date, dateStr0),
          )),
      ]);

      for (const b of conflictingBookings) {
        const bStart = toMin(b.startTime);
        const bEnd = toMin(b.endTime) + bufferMinutes;
        if (reqStartMin < bEnd && reqEndMin > bStart) {
          throw new BookingConflictError(409, { error: "Requested time slot is not available", code: "SLOT_UNAVAILABLE" });
        }
      }

      for (const b of conflictingBlocked) {
        const bStart = toMin(b.startTime);
        const bEnd = toMin(b.endTime);
        if (reqStartMin < bEnd && reqEndMin > bStart) {
          throw new BookingConflictError(409, { error: "Requested time slot is blocked", code: "SLOT_BLOCKED" });
        }
      }

      // ── Equipment availability (inside lock, same consistent snapshot) ──
      let equipmentCost = 0;
      let validatedRentedItems: string | null = null;
      if (parsed.data.rentedItems) {
        try {
          const clientItems: Array<{ name: string; quantity?: number }> = JSON.parse(parsed.data.rentedItems);
          const courtEquipment: Array<{ name: string; pricePerSlot?: number; pricePerBooking?: number; stock: number }> =
            court.rentableItems ? JSON.parse(court.rentableItems) : [];

          const existingBookings = await tx
            .select({ rentedItems: bookingsTable.rentedItems, startTime: bookingsTable.startTime, endTime: bookingsTable.endTime, status: bookingsTable.status })
            .from(bookingsTable)
            .where(and(eq(bookingsTable.courtId, parsed.data.courtId), eq(bookingsTable.date, dateStr0)));
          const bookedQty: Record<string, number> = {};
          for (const b of existingBookings) {
            if (!b.rentedItems || b.status === "cancelled") continue;
            const bStart = toMin(b.startTime);
            const bEnd = toMin(b.endTime);
            if (bEnd <= reqStartMin || bStart >= reqEndMin) continue;
            const items: Array<{ name: string; quantity: number }> = JSON.parse(b.rentedItems);
            for (const item of items) {
              bookedQty[item.name] = (bookedQty[item.name] ?? 0) + item.quantity;
            }
          }

          const serverValidated: Array<{ name: string; pricePerSlot: number; quantity: number }> = [];
          for (const ci of clientItems) {
            const canonical = courtEquipment.find(e => e.name === ci.name);
            if (!canonical) continue;
            const pricePerSlot = canonical.pricePerSlot ?? canonical.pricePerBooking ?? 0;
            const qty = Math.max(1, Math.min(Math.floor(ci.quantity ?? 1), 20));
            const alreadyBooked = bookedQty[ci.name] ?? 0;
            if (alreadyBooked + qty > canonical.stock) {
              throw new BookingConflictError(409, {
                error: `Įranga "${ci.name}" nebepasiekiama: likę ${Math.max(0, canonical.stock - alreadyBooked)} vnt.`,
                code: "EQUIPMENT_UNAVAILABLE",
                item: ci.name,
                available: Math.max(0, canonical.stock - alreadyBooked),
              });
            }
            serverValidated.push({ name: canonical.name, pricePerSlot, quantity: qty });
            equipmentCost += pricePerSlot * qty * slotCount;
          }
          if (serverValidated.length > 0) validatedRentedItems = JSON.stringify(serverValidated);
        } catch (e) {
          if (e instanceof BookingConflictError) throw e;
          console.error("[bookings] equipment validation error:", e);
        }
      }

      const totalPrice = courtPrice + equipmentCost;

      // ── Insert inside the same transaction ──
      const [inserted] = await tx.insert(bookingsTable).values({
        courtId: parsed.data.courtId,
        bookerUserId: bookerUserId ?? null,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        customerPhone: parsed.data.customerPhone ?? null,
        date: dateStr0,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        totalPrice: String(totalPrice),
        rentedItems: validatedRentedItems,
        status: "pending",
      }).returning();

      return inserted;
    });
  } catch (err) {
    if (err instanceof BookingConflictError) {
      res.status(err.statusCode).json(err.body);
      return;
    }
    throw err;
  }

  if (court.ownerUserId) {
    await sendNotification(
      court.ownerUserId,
      "booking_created",
      `Nauja rezervacija — ${court.name}`,
      `${parsed.data.customerName} užrezervavo ${dateStr0} ${parsed.data.startTime}–${parsed.data.endTime}.`,
      "/owner",
    );
  }

  res.status(201).json(GetBookingResponse.parse(formatBooking(booking, court.name)));
});

router.get("/bookings/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getCurrentUserId(req)!;

  const rows = await db
    .select({ booking: bookingsTable, courtName: courtsTable.name, courtOwnerUserId: courtsTable.ownerUserId })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const { booking, courtName, courtOwnerUserId } = rows[0];
  const role = await getUserRole(userId);
  const isBooker = booking.bookerUserId === userId;
  const isCourOwner = courtOwnerUserId === userId;

  if (role !== "admin" && !isBooker && !isCourOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetBookingResponse.parse(formatBooking(booking, courtName ?? undefined)));
});

router.delete("/bookings/:id", requireAuth, async (req, res): Promise<void> => {
  const params = CancelBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getCurrentUserId(req)!;

  const rows = await db
    .select({ booking: bookingsTable, courtOwnerUserId: courtsTable.ownerUserId })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, params.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const { booking, courtOwnerUserId } = rows[0];
  const role = await getUserRole(userId);
  const isBooker = booking.bookerUserId === userId;
  const isCourtOwner = courtOwnerUserId === userId;

  if (role !== "admin" && !isBooker && !isCourtOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [cancelled] = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  res.json(CancelBookingResponse.parse(formatBooking(cancelled)));
});

router.get("/bookings/:id/ics", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).send("Invalid booking id");
    return;
  }

  const userId = getCurrentUserId(req)!;

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
      courtOwnerUserId: courtsTable.ownerUserId,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, id));

  if (!rows[0]) {
    res.status(404).send("Booking not found");
    return;
  }

  const { booking, courtName, courtId, courtAddress, courtCity, courtOwnerUserId } = rows[0];
  const role = await getUserRole(userId);
  const isBooker = booking.bookerUserId === userId;
  const isCourtOwner = courtOwnerUserId === userId;

  if (role !== "admin" && !isBooker && !isCourtOwner) {
    res.status(403).send("Forbidden");
    return;
  }

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

// ─── Owner: block a court time slot ──────────────────────────────────────────
const BlockBookingBody = z.object({
  courtId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
});

router.post("/owner/bookings/block", requireAuth, async (req, res): Promise<void> => {
  const parsed = BlockBookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() }); return; }

  const { courtId, date, startTime, endTime, notes } = parsed.data;
  const ownerId = getCurrentUserId(req)!;

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }
  if (!(await isOwner(req, court.ownerUserId ?? ""))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const reqStartMin = toMin(startTime);
  const reqEndMin = toMin(endTime);

  const existing = await db
    .select({ startTime: bookingsTable.startTime, endTime: bookingsTable.endTime, status: bookingsTable.status })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.courtId, courtId),
      eq(bookingsTable.date, date),
      or(
        eq(bookingsTable.status, "confirmed"),
        and(
          eq(bookingsTable.status, "pending"),
          sql`${bookingsTable.createdAt} > NOW() - INTERVAL '10 minutes'`
        )
      )
    ));

  for (const b of existing) {
    const bStart = toMin(b.startTime);
    const bEnd = toMin(b.endTime);
    if (reqStartMin < bEnd && reqEndMin > bStart) {
      if (b.status === "confirmed") {
        res.status(409).json({ error: "Šiuo laiku yra patvirtinta rezervacija.", code: "CONFIRMED_EXISTS" });
        return;
      }
      if (b.status === "pending") {
        res.status(409).json({ error: "Šiuo metu klientas atlieka mokėjimą. Palaukite ir bandykite vėliau.", code: "PENDING_EXISTS" });
        return;
      }
    }
  }

  const [booking] = await db.insert(bookingsTable).values({
    courtId,
    bookerUserId: ownerId,
    customerName: "Savininkas (blokas)",
    customerEmail: `owner-block-${Date.now()}@korts.lt`,
    date,
    startTime,
    endTime,
    totalPrice: "0",
    status: "blocked",
    notes: notes ?? null,
  }).returning();

  res.status(201).json(booking);
});

// ─── Owner: create manual (free) booking ──────────────────────────────────────
const ManualBookingBody = z.object({
  courtId: z.number().int(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().optional(),
});

router.post("/owner/bookings/manual", requireAuth, async (req, res): Promise<void> => {
  const parsed = ManualBookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() }); return; }

  const { courtId, customerName, customerEmail, customerPhone, date, startTime, endTime, note } = parsed.data;

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  if (!(await isOwner(req, court.ownerUserId ?? ""))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [booking] = await db.insert(bookingsTable).values({
    courtId,
    bookerUserId: null,
    customerName,
    customerEmail,
    customerPhone: customerPhone ?? null,
    date,
    startTime,
    endTime,
    totalPrice: "0",
    status: "confirmed",
    rentedItems: note ? `Pastaba: ${note}` : null,
  }).returning();

  res.status(201).json(formatBooking(booking, court.name));
});

export default router;
