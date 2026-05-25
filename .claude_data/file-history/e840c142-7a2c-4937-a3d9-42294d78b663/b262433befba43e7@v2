/**
 * Seed sample bookings against the demo coaches so the coach bookings
 * inbox, dashboard, students list, and cancellation flow can be exercised
 * end-to-end without a real Stripe checkout.
 *
 * Idempotent: every row carries `notes = "__demo-seed-bookings__: <key>"` so
 * re-running wipes the previous batch first. Tags itself with the same
 * `demo-seed-` user prefix the rest of the demo seed uses.
 *
 * Run: `pnpm --filter @workspace/scripts run seed-demo-coach-bookings`
 */
import {
  db,
  bookingsTable,
  coachesTable,
  coachServicesTable,
  courtCoachesTable,
} from "@workspace/db";
import { and, eq, like } from "drizzle-orm";

// The tag goes into `recurringGroupId` (a text column not surfaced anywhere
// in the UI) so we can wipe-by-pattern on reseed without polluting the
// `notes` column — notes is rendered as visible italic copy on the booking
// cards, and a "__demo-seed-bookings__" string in there looks terrible.
const SEED_GROUP_PREFIX = "demo-seed-bookings:";

// Predictable guest/Clerk-looking user IDs. None of these correspond to real
// Clerk accounts — the inbox/students endpoints fall back to bookings.customerName
// when Clerk doesn't resolve them, so the UI still renders nicely.
const GUEST_USER_IDS = [
  "user_demo_seed_player_1",
  "user_demo_seed_player_2",
  "user_demo_seed_player_3",
  "user_demo_seed_player_4",
] as const;

interface BookingDraft {
  key: string;                  // used in the tag so we can find/wipe specific rows
  dayOffset: number;            // days from today; negative = past
  startTime: string;            // HH:MM
  endTime: string;
  courtId: number;
  bookerUserId: string | null;  // null = guest
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  status: "confirmed" | "awaiting_players" | "pending" | "cancelled";
  totalPriceEuro: number;       // cents/100; matches numeric(10,2)
  coachAmountCents: number | null;
  coachTransferId: string | null;
  refundEuro: number;
  shortNote?: string;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function applyOffset(base: Date, days: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

const KAUNAS_COURT_ID_HINT = "Teniso kortas A"; // demo-seed-courts use these names
const VILNIUS_COURT_ID_HINT = "Teniso kortas 1";

async function resolveCoachAndCourts(userId: string) {
  const [coach] = await db.select({
    id: coachesTable.id,
    userId: coachesTable.userId,
    name: coachesTable.name,
  })
    .from(coachesTable)
    .where(eq(coachesTable.userId, userId))
    .limit(1);
  if (!coach) {
    throw new Error(`Demo coach with userId=${userId} not found — run seed-demo-coaches first.`);
  }

  const affiliated = await db.select({
    courtId: courtCoachesTable.courtId,
  })
    .from(courtCoachesTable)
    .where(eq(courtCoachesTable.coachId, coach.id));
  if (affiliated.length === 0) {
    throw new Error(`Demo coach ${userId} has no affiliated courts.`);
  }

  const [service] = await db.select({
    id: coachServicesTable.id,
    durationMin: coachServicesTable.durationMin,
    priceCents: coachServicesTable.priceCents,
  })
    .from(coachServicesTable)
    .where(and(
      eq(coachServicesTable.coachId, coach.id),
      eq(coachServicesTable.isActive, true),
    ))
    .limit(1);

  return { coach, affiliatedCourtIds: affiliated.map((r) => r.courtId), service };
}

async function wipePreviousSeed(coachUserId: string) {
  // Pattern match the seed tag in recurringGroupId so re-running is safe.
  await db.delete(bookingsTable).where(and(
    eq(bookingsTable.coachId, coachUserId),
    like(bookingsTable.recurringGroupId, `${SEED_GROUP_PREFIX}%`),
  ));
}

async function main() {
  // Target coach. We only seed bookings for one coach in V1; an admin can use
  // /admin -> view-as to inspect the inbox from her perspective. To seed for
  // a different coach, pass their userId via $DEMO_COACH_USER_ID.
  const targetCoachUserId = process.env.DEMO_COACH_USER_ID
    ?? "demo-seed-coach-egle-tennis-kaunas";

  const { coach, affiliatedCourtIds, service } = await resolveCoachAndCourts(targetCoachUserId);
  if (affiliatedCourtIds.length < 1) {
    throw new Error(`No courts affiliated with ${coach.name}; aborting.`);
  }
  const courtA = affiliatedCourtIds[0]!;
  const courtB = affiliatedCourtIds[1] ?? courtA;

  console.log(`Seeding bookings for ${coach.name} (id=${coach.id}, userId=${coach.userId}).`);
  console.log(`Service: ${service ? `id=${service.id}, €${(service.priceCents / 100).toFixed(2)}` : "none active"}.`);

  await wipePreviousSeed(coach.userId);

  // The coach share = full price (no facility share split modeled here). Real
  // bookings going through Stripe Checkout would record the actual coach amount
  // at checkout time. For seeding, we use the active service price when set,
  // otherwise the legacy default of €30 / 60 min.
  const coachShareCents = service?.priceCents ?? 3000;
  const totalEuro = +(coachShareCents / 100).toFixed(2);

  const drafts: BookingDraft[] = [
    // ── PAST ─────────────────────────────────────────────────────────────────
    {
      key: "past-14d-paid-transferred",
      dayOffset: -14, startTime: "18:00", endTime: "19:00", courtId: courtA,
      bookerUserId: GUEST_USER_IDS[0], customerName: "Andrius Petraitis",
      customerEmail: "andrius.p@example.lt", customerPhone: "+37060011001",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_001",
      refundEuro: 0, shortNote: "Pirma pamoka su trenere",
    },
    {
      key: "past-7d-paid-transferred",
      dayOffset: -7, startTime: "10:00", endTime: "11:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[1], customerName: "Justė Kazlauskaitė",
      customerEmail: "juste.kaz@example.lt", customerPhone: "+37060011002",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_002",
      refundEuro: 0,
    },
    {
      key: "past-5d-paid-transferred",
      dayOffset: -5, startTime: "17:30", endTime: "18:30", courtId: courtA,
      bookerUserId: GUEST_USER_IDS[0], customerName: "Andrius Petraitis",
      customerEmail: "andrius.p@example.lt", customerPhone: "+37060011001",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_003",
      refundEuro: 0,
    },
    {
      key: "past-3d-cancelled-refunded",
      dayOffset: -3, startTime: "12:00", endTime: "13:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[2], customerName: "Tomas Vasilauskas",
      customerEmail: "tomasv@example.lt", customerPhone: "+37060011003",
      status: "cancelled", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: null,
      refundEuro: totalEuro, shortNote: "Mokinys atšaukė dėl ligos",
    },
    {
      key: "past-1d-manual",
      dayOffset: -1, startTime: "16:00", endTime: "17:00", courtId: courtA,
      bookerUserId: null, customerName: "Rasa Mikelionis (rankiniu)",
      customerEmail: "rasa.m@example.lt", customerPhone: null,
      status: "confirmed", totalPriceEuro: 0,
      coachAmountCents: null, coachTransferId: null,
      refundEuro: 0, shortNote: "Susitarta tiesiogiai",
    },

    // ── TODAY / NEAR FUTURE ──────────────────────────────────────────────────
    {
      key: "today-paid-transferred",
      dayOffset: 0, startTime: "19:00", endTime: "20:00", courtId: courtA,
      bookerUserId: GUEST_USER_IDS[1], customerName: "Justė Kazlauskaitė",
      customerEmail: "juste.kaz@example.lt", customerPhone: "+37060011002",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_006",
      refundEuro: 0,
    },
    {
      key: "today-awaiting-players",
      dayOffset: 0, startTime: "20:00", endTime: "21:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[3], customerName: "Mindaugas Bagdonas",
      customerEmail: "mindaugas.b@example.lt", customerPhone: "+37060011004",
      status: "awaiting_players", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: null,
      refundEuro: 0,
    },
    {
      key: "tomorrow-paid-pending-transfer",
      dayOffset: 1, startTime: "09:00", endTime: "10:00", courtId: courtA,
      bookerUserId: GUEST_USER_IDS[0], customerName: "Andrius Petraitis",
      customerEmail: "andrius.p@example.lt", customerPhone: "+37060011001",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: null,
      refundEuro: 0, shortNote: "Eitynių nešalia",
    },
    {
      key: "next-3d-paid",
      dayOffset: 3, startTime: "18:00", endTime: "19:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[2], customerName: "Tomas Vasilauskas",
      customerEmail: "tomasv@example.lt", customerPhone: "+37060011003",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_009",
      refundEuro: 0,
    },
    {
      key: "next-5d-manual",
      dayOffset: 5, startTime: "11:00", endTime: "12:00", courtId: courtA,
      bookerUserId: null, customerName: "Greta Bružaitė",
      customerEmail: "greta.b@example.lt", customerPhone: "+37060011005",
      status: "confirmed", totalPriceEuro: 0,
      coachAmountCents: null, coachTransferId: null,
      refundEuro: 0, shortNote: "Susitarta dėl 4 pamokų paketo",
    },
    {
      key: "next-7d-awaiting",
      dayOffset: 7, startTime: "17:00", endTime: "18:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[3], customerName: "Mindaugas Bagdonas",
      customerEmail: "mindaugas.b@example.lt", customerPhone: "+37060011004",
      status: "awaiting_players", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: null,
      refundEuro: 0,
    },
    {
      key: "next-10d-paid-transferred",
      dayOffset: 10, startTime: "19:30", endTime: "20:30", courtId: courtA,
      bookerUserId: GUEST_USER_IDS[1], customerName: "Justė Kazlauskaitė",
      customerEmail: "juste.kaz@example.lt", customerPhone: "+37060011002",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_012",
      refundEuro: 0,
    },
    {
      key: "next-14d-pending-checkout",
      dayOffset: 14, startTime: "08:00", endTime: "09:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[2], customerName: "Tomas Vasilauskas",
      customerEmail: "tomasv@example.lt", customerPhone: "+37060011003",
      status: "pending", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: null,
      refundEuro: 0,
    },
    {
      key: "next-21d-paid",
      dayOffset: 21, startTime: "18:00", endTime: "19:00", courtId: courtA,
      bookerUserId: GUEST_USER_IDS[0], customerName: "Andrius Petraitis",
      customerEmail: "andrius.p@example.lt", customerPhone: "+37060011001",
      status: "confirmed", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: "tr_demo_seed_014",
      refundEuro: 0, shortNote: "Pasirengimas regiono turnyrui",
    },
    {
      key: "next-30d-cancelled-advance",
      dayOffset: 30, startTime: "12:00", endTime: "13:00", courtId: courtB,
      bookerUserId: GUEST_USER_IDS[3], customerName: "Mindaugas Bagdonas",
      customerEmail: "mindaugas.b@example.lt", customerPhone: "+37060011004",
      status: "cancelled", totalPriceEuro: totalEuro,
      coachAmountCents: coachShareCents, coachTransferId: null,
      refundEuro: totalEuro, shortNote: "Atšaukta iš anksto — visiškas grąžinimas",
    },
  ];

  const today = new Date();
  let inserted = 0;
  for (const d of drafts) {
    const date = ymd(applyOffset(today, d.dayOffset));
    await db.insert(bookingsTable).values({
      courtId: d.courtId,
      bookerUserId: d.bookerUserId,
      customerName: d.customerName,
      customerEmail: d.customerEmail,
      customerPhone: d.customerPhone,
      date,
      startTime: d.startTime,
      endTime: d.endTime,
      totalPrice: d.totalPriceEuro.toFixed(2),
      status: d.status,
      notes: d.shortNote ?? null,
      recurringGroupId: `${SEED_GROUP_PREFIX}${d.key}`,
      refundAmount: d.refundEuro.toFixed(2),
      coachId: coach.userId,
      coachServiceId: service?.id ?? null,
      coachAmountCents: d.coachAmountCents,
      coachTransferId: d.coachTransferId,
    });
    inserted += 1;
  }

  console.log(`Inserted ${inserted} bookings for ${coach.name}.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
