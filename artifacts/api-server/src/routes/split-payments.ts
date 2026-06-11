/**
 * Split Payment routes
 *
 * POST /api/games/checkout-split  — host initiates a split booking + game + pays their share
 * GET  /api/bookings/share/:token — public: get split booking info (for invite page)
 * POST /api/bookings/share/:token/checkout — invitee pays their share
 * GET  /api/bookings/:bookingId/split-status — host/participant: see all payment statuses
 */
import { Router, type IRouter } from "express";
import { and, eq, ne, sql, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  courtsTable,
  facilitiesTable,
  gamesTable,
  gameParticipantsTable,
  userProfilesTable,
  userSportProfilesTable,
  courtBlockedSlotsTable,
  userMembershipsTable,
  courtMembershipsTable,
} from "@workspace/db";
import { buildDayPriceMap } from "../lib/pricing";
import { vilniusLocalToUtcMs } from "./bookings";

import { requireAuth, getCurrentUserId } from "../lib/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import {
  sendSplitBookingCreatedEmail,
  sendSplitPlayerJoinedEmail,
  sendSplitParticipantConfirmationEmail,
  sendSplitGuaranteeChargedEmail,
  sendSplitGuaranteeFailedEmail,
  sendSplitParticipantRefundedEmail,
} from "../lib/email";
import { sendNotification } from "../lib/notify";
import { applyMembershipDiscount } from "../lib/membership-pricing";
import { z } from "zod";
import crypto from "node:crypto";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotsBetween(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  let cur = toMin(startTime);
  const end = toMin(endTime);
  while (cur < end) {
    const h = Math.floor(cur / 60).toString().padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    cur += 30;
  }
  return slots;
}

// ─── POST /api/games/checkout-split ──────────────────────────────────────────

const SplitCheckoutBody = z.object({
  courtId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  totalSlots: z.number().int().min(2).max(8),
  sport: z.string().min(1),
  skillLevel: z.string().optional().default("any"),
  description: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  // Open match fields
  isPublic: z.boolean().optional().default(false),
  minSkillLevel: z.number().min(0).max(10).optional(),
  maxSkillLevel: z.number().min(0).max(10).optional(),
  matchType: z.enum(["casual", "competitive"]).optional().default("casual"),
  // Upgrade flow: link an existing casual game instead of creating a new one
  linkGameId: z.number().int().positive().optional(),
});

router.post("/games/checkout-split", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  if (req.body?.recurringGroupId) {
    res.status(400).json({ error: "Split payment and recurring reservations are mutually exclusive", code: "SPLIT_RECURRING_CONFLICT" });
    return;
  }
  const parsed = SplitCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    courtId, date, startTime, endTime, totalSlots, sport, skillLevel, description,
    customerName, customerEmail, customerPhone,
    isPublic, minSkillLevel, maxSkillLevel, matchType,
    linkGameId,
  } = parsed.data;

  const reqStartMin = toMin(startTime);
  const reqEndMin = toMin(endTime);
  if (reqEndMin <= reqStartMin) {
    res.status(400).json({ error: "endTime must be after startTime" });
    return;
  }

  // ── Fetch court and facility ──────────────────────────────────────────────
  const [courtRow] = await db
    .select({ court: courtsTable, facility: facilitiesTable })
    .from(courtsTable)
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(eq(courtsTable.id, courtId));

  if (!courtRow?.court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  const { court, facility } = courtRow;

  // ── linkGame upgrade flow: verify ownership before creating anything ───────
  if (linkGameId) {
    const [targetGame] = await db.select().from(gamesTable).where(eq(gamesTable.id, linkGameId));
    if (!targetGame) {
      res.status(404).json({ error: "Linked game not found" });
      return;
    }
    if (targetGame.creatorUserId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  class ConflictError extends Error {
    constructor(public readonly body: unknown) { super("Conflict"); }
  }
  const dateInt = parseInt(date.replace(/-/g, ""), 10);

  let txResult: {
    booking: typeof bookingsTable.$inferSelect;
    gameId: number;
    hostParticipant: typeof gameParticipantsTable.$inferSelect;
    totalPrice: number;
    pricePerSlot: number;
    splitInviteToken: string;
    hostShareEur: number;
  };
  try {
    txResult = await db.transaction(async (tx) => {
      // Advisory lock per court+date makes the conflict check atomic — same
      // convention as POST /bookings and the group checkout-split.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(courtId))}::int, ${sql.raw(String(dateInt))}::int)`);

      // ── Conflict check (inside lock) ──
      const [conflicting, blocked] = await Promise.all([
        tx.select({ s: bookingsTable.startTime, e: bookingsTable.endTime })
          .from(bookingsTable)
          .where(and(
            eq(bookingsTable.courtId, courtId),
            eq(bookingsTable.date, date),
            sql`(${bookingsTable.status} IN ('confirmed','blocked','awaiting_players')
                OR (${bookingsTable.status} = 'pending' AND ${bookingsTable.createdAt} > NOW() - INTERVAL '15 minutes'))`,
          )),
        tx.select({ s: courtBlockedSlotsTable.startTime, e: courtBlockedSlotsTable.endTime })
          .from(courtBlockedSlotsTable)
          .where(and(eq(courtBlockedSlotsTable.courtId, courtId), eq(courtBlockedSlotsTable.date, date))),
      ]);
      for (const b of conflicting) {
        if (reqStartMin < toMin(b.e) && reqEndMin > toMin(b.s)) {
          throw new ConflictError({ error: "Pasirinktas laikas užimtas", code: "SLOT_UNAVAILABLE" });
        }
      }
      for (const b of blocked) {
        if (reqStartMin < toMin(b.e) && reqEndMin > toMin(b.s)) {
          throw new ConflictError({ error: "Pasirinktas laikas užblokuotas", code: "SLOT_BLOCKED" });
        }
      }

      // ── Server-side price calculation ──
      const defaultSlotPrice = Number(court.pricePerHour) / 2;
      const { priceMap } = await buildDayPriceMap(courtId, date, defaultSlotPrice);
      let courtPrice = 0;
      for (const slotStart of slotsBetween(startTime, endTime)) {
        courtPrice += priceMap.get(slotStart) ?? defaultSlotPrice;
      }
      const totalPrice = courtPrice;
      const pricePerSlot = Math.round((totalPrice / totalSlots) * 100) / 100;
      const durationMinutes = reqEndMin - reqStartMin;

      // Host's own membership discounts the host's share only. Booking keeps
      // full totalPrice/pricePerSlot — other participants pay full shares.
      // Lock-ordering contract: membership rows are the last locks acquired.
      const hostDiscount = await applyMembershipDiscount(tx, {
        userId, facilityId: facility?.id ?? 0, sport, playDate: date, amountEur: pricePerSlot,
      });

      // ── Create booking ──
      const splitInviteToken = crypto.randomBytes(20).toString("hex");
      const datetime = `${date}T${startTime}:00`;

      const [booking] = await tx.insert(bookingsTable).values({
        courtId,
        bookerUserId: userId,
        customerName,
        customerEmail,
        customerPhone: customerPhone ?? null,
        date,
        startTime,
        endTime,
        totalPrice: String(totalPrice),
        status: "pending",
        isSplit: true,
        totalSlots,
        pricePerSlot: String(pricePerSlot),
        splitInviteToken,
      }).returning();

      // ── Create or reuse linked game ──
      let gameId: number;
      if (linkGameId) {
        gameId = linkGameId;
      } else {
        const [newGame] = await tx.insert(gamesTable).values({
          creatorUserId: userId,
          creatorName: customerName,
          creatorEmail: customerEmail,
          sport,
          city: facility?.city ?? "",
          placeName: facility?.name ?? court.name,
          facilityId: facility?.id ?? null,
          courtId,
          bookingId: booking.id,
          playersNeeded: totalSlots,
          skillLevel: skillLevel ?? "any",
          datetime,
          durationMinutes,
          description: description ?? null,
          status: "pending_payment",
          matchType: matchType ?? "casual",
          isPrivate: !isPublic,
          visibility: isPublic ? "public" : "private",
          minSkillLevel: isPublic ? (minSkillLevel ?? null) : null,
          maxSkillLevel: isPublic ? (maxSkillLevel ?? null) : null,
          requiresApproval: false,
          teamCount: 2,
        }).returning();
        gameId = newGame.id;
      }

      // ── Add host as participant (pending payment) ──
      // For the upgrade flow, update the existing host participant to track
      // payment; for the normal flow, insert a fresh record.
      let hostParticipant: typeof gameParticipantsTable.$inferSelect;
      if (linkGameId) {
        const [existing] = await tx
          .select()
          .from(gameParticipantsTable)
          .where(and(eq(gameParticipantsTable.gameId, linkGameId), eq(gameParticipantsTable.userId, userId)));
        if (existing) {
          [hostParticipant] = await tx
            .update(gameParticipantsTable)
            .set({ paymentStatus: "pending", appliedMembershipId: hostDiscount.membershipId })
            .where(eq(gameParticipantsTable.id, existing.id))
            .returning();
        } else {
          [hostParticipant] = await tx.insert(gameParticipantsTable).values({
            gameId: linkGameId,
            userId,
            userName: customerName,
            userEmail: customerEmail,
            status: "joined",
            source: "join_request",
            paymentStatus: "pending",
            appliedMembershipId: hostDiscount.membershipId,
          }).returning();
        }
      } else {
        [hostParticipant] = await tx.insert(gameParticipantsTable).values({
          gameId,
          userId,
          userName: customerName,
          userEmail: customerEmail,
          status: "joined",
          source: "join_request",
          paymentStatus: "pending",
          appliedMembershipId: hostDiscount.membershipId,
        }).returning();
      }

      return { booking, gameId, hostParticipant, totalPrice, pricePerSlot, splitInviteToken, hostShareEur: hostDiscount.discounted };
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json(err.body);
      return;
    }
    throw err;
  }
  const { booking, gameId, hostParticipant, totalPrice, pricePerSlot, splitInviteToken, hostShareEur } = txResult;

  // ── Create Stripe checkout for host's share ───────────────────────────────
  const origin = req.get("origin") ?? req.get("host") ?? "https://korts.lt";
  const base = process.env.BASE_PATH ?? "";
  const successUrl = `${origin}${base}/booking-confirmed?id=${booking.id}&split=1`;
  // Cancel lands on the facility+sport group page (booking front door); legacy
  // /courts/:id only when the court has no facility.
  const cancelUrl = court.facilityId != null && court.type
    ? `${origin}${base}/facility/${court.facilityId}?sport=${court.type.replace(/-/g, "_")}&booking_cancelled=1&bookingId=${booking.id}`
    : `${origin}${base}/courts/${courtId}?booking_cancelled=1&bookingId=${booking.id}`;

  let checkoutUrl: string;
  const amountCents = Math.round(hostShareEur * 100);

  // Shared by the €0-share path (membership covered everything) and the
  // Stripe-not-configured fallback: mark host paid, move booking + game on.
  async function settleHostShareWithoutStripe(sessionId: string): Promise<string> {
    await db.update(bookingsTable)
      .set({ stripeSessionId: sessionId, status: "awaiting_players" })
      .where(eq(bookingsTable.id, booking.id));
    await db.update(gameParticipantsTable)
      .set({ stripeSessionId: sessionId, paymentStatus: "paid" })
      .where(eq(gameParticipantsTable.id, hostParticipant.id));
    if (linkGameId) {
      await db.update(gamesTable)
        .set({
          bookingId: booking.id,
          facilityId: facility?.id ?? null,
          courtId,
          status: "awaiting_players",
          datetime: `${booking.date}T${booking.startTime}:00`,
          durationMinutes: toMin(booking.endTime) - toMin(booking.startTime),
        })
        .where(eq(gamesTable.id, linkGameId));
    } else {
      await db.update(gamesTable)
        .set({ status: "awaiting_players" })
        .where(eq(gamesTable.id, gameId));
    }
    return `${successUrl}&session_id=${sessionId}`;
  }

  if (amountCents === 0) {
    // Membership covered the host's entire share — no payment session needed.
    checkoutUrl = await settleHostShareWithoutStripe(`free_split_${booking.id}_${Date.now()}`);
    res.status(201).json({
      url: checkoutUrl,
      bookingId: booking.id,
      gameId,
      shareToken: splitInviteToken,
      pricePerSlot,
      totalPrice,
      totalSlots,
    });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();

    // Resolve Connect account
    let connectAccountId: string | null = null;
    if (facility?.ownerUserId) {
      const [profile] = await db
        .select({ stripeAccountId: userProfilesTable.stripeAccountId, status: userProfilesTable.stripeAccountStatus })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, facility.ownerUserId));
      if (profile?.stripeAccountId && profile.status === "active") {
        connectAccountId = profile.stripeAccountId;
      }
    }

    const sessionParams: any = {
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `${court.name} – mokėjimo dalis (1/${totalSlots})`,
            description: `${date} · ${startTime}–${endTime}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        bookingId: String(booking.id),
        splitParticipantId: String(hostParticipant.id),
        ...(linkGameId ? { linkGameId: String(linkGameId) } : {}),
      },
      customer_email: customerEmail,
      customer_creation: "always",
      locale: "lt",
      // Save the host's card for the guarantee off-session charge
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    };

    if (connectAccountId) {
      const feeAmount = Math.round(amountCents * 5 / 100);
      sessionParams.payment_intent_data = {
        setup_future_usage: "off_session",
        application_fee_amount: feeAmount,
        transfer_data: { destination: connectAccountId },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store session ids
    await db.update(bookingsTable)
      .set({ stripeSessionId: session.id })
      .where(eq(bookingsTable.id, booking.id));

    await db.update(gameParticipantsTable)
      .set({ stripeSessionId: session.id })
      .where(eq(gameParticipantsTable.id, hostParticipant.id));

    checkoutUrl = session.url!;

  } catch (err: any) {
    if (err?.message?.includes("Stripe not configured") || err?.type === "StripeAuthenticationError") {
      // Mock checkout for dev
      checkoutUrl = await settleHostShareWithoutStripe(`mock_split_${booking.id}_${Date.now()}`);
    } else {
      logger.error({ err }, "Failed to create Stripe session for split checkout");
      if (!linkGameId) {
        // Rollback only applies when we created a new game
        await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, booking.id));
        await db.delete(gamesTable).where(eq(gamesTable.id, gameId));
      }
      res.status(500).json({ error: "Failed to create payment session" });
      return;
    }
  }

  res.status(201).json({
    url: checkoutUrl,
    bookingId: booking.id,
    gameId,
    shareToken: splitInviteToken,
    pricePerSlot,
    totalPrice,
    totalSlots,
  });
});

// ─── POST /api/payments/confirm-split ────────────────────────────────────────
// Called by booking-confirmed.tsx when ?split=1 is present.
// Marks the host participant as paid, moves booking→awaiting_players, game→awaiting_players.

router.post("/payments/confirm-split", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const sessionId = String(req.body?.sessionId ?? "");
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

  // Find the booking (and court) by stripeSessionId
  const rows = await db
    .select({ booking: bookingsTable, court: courtsTable })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.stripeSessionId, sessionId));

  if (!rows[0]) { res.status(404).json({ error: "Booking not found for session" }); return; }
  const { booking, court } = rows[0];
  if (!booking.isSplit) { res.status(400).json({ error: "Not a split booking" }); return; }
  if (booking.bookerUserId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  // Verify Stripe payment and read metadata (skip for mocks)
  let linkGameId: number | null = null;
  let hostStripeCustomerId: string | null = null;
  let hostStripePaymentMethodId: string | null = null;
  if (!sessionId.startsWith("mock_")) {
    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });
      if (session.payment_status !== "paid") {
        res.status(402).json({ error: "Payment not completed" });
        return;
      }
      const lgId = session.metadata?.linkGameId;
      if (lgId) linkGameId = parseInt(lgId, 10);
      // Persist host's Stripe customer + saved payment method for guarantee charges
      if (session.customer) hostStripeCustomerId = session.customer as string;
      const pi = session.payment_intent as any;
      if (pi?.payment_method) hostStripePaymentMethodId = pi.payment_method as string;
    } catch (err) {
      logger.error({ err }, "Stripe retrieve session error in confirm-split");
    }
  }

  // Find participant by stripeSessionId → mark as paid (idempotent)
  const [participant] = await db
    .select()
    .from(gameParticipantsTable)
    .where(eq(gameParticipantsTable.stripeSessionId, sessionId));

  if (participant && participant.paymentStatus !== "paid") {
    await db
      .update(gameParticipantsTable)
      .set({ paymentStatus: "paid" })
      .where(eq(gameParticipantsTable.id, participant.id));
  }

  // Move booking to awaiting_players (from pending) — track if this is a fresh transition
  let justTransitioned = false;
  if (booking.status === "pending") {
    const updated = await db
      .update(bookingsTable)
      .set({
        status: "awaiting_players",
        ...(hostStripeCustomerId ? { hostStripeCustomerId } : {}),
        ...(hostStripePaymentMethodId ? { hostStripePaymentMethodId } : {}),
      })
      .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "pending")))
      .returning();
    justTransitioned = updated.length > 0;
  }

  // Find linked game and transition it
  let game: typeof gamesTable.$inferSelect | undefined;
  if (linkGameId) {
    // Upgrade flow: update the pre-existing casual game
    const courtRow = booking.courtId != null
      ? (await db
          .select({ facilityId: facilitiesTable.id, courtId: courtsTable.id })
          .from(courtsTable)
          .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
          .where(eq(courtsTable.id, booking.courtId)))[0]
      : undefined;
    await db
      .update(gamesTable)
      .set({
        bookingId: booking.id,
        facilityId: courtRow?.facilityId ?? null,
        courtId: courtRow?.courtId ?? booking.courtId ?? null,
        status: "awaiting_players",
        datetime: `${booking.date}T${booking.startTime}:00`,
        durationMinutes: toMin(booking.endTime) - toMin(booking.startTime),
      })
      .where(eq(gamesTable.id, linkGameId));
    const [updated] = await db.select().from(gamesTable).where(eq(gamesTable.id, linkGameId));
    game = updated;
  } else {
    // Normal flow: find the game that was created alongside this booking
    const [found] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.bookingId, booking.id));
    if (found && found.status === "pending_payment") {
      await db
        .update(gamesTable)
        .set({ status: "awaiting_players" })
        .where(and(eq(gamesTable.id, found.id), eq(gamesTable.status, "pending_payment")));
    }
    game = found;
  }

  // Aggregate paid participant count
  const allParticipants = game
    ? await db
        .select({ paymentStatus: gameParticipantsTable.paymentStatus })
        .from(gameParticipantsTable)
        .where(and(
          eq(gameParticipantsTable.gameId, game.id),
          eq(gameParticipantsTable.status, "joined"),
        ))
    : [];
  const paidSlots = allParticipants.filter(p => p.paymentStatus === "paid").length;

  // Send email + notification to host if this was a fresh game creation
  if (justTransitioned && booking.bookerUserId && booking.splitInviteToken) {
    const origin = req.get("origin") ?? req.get("host") ?? "https://korts.lt";
    const base = process.env.BASE_PATH ?? "";
    const shareLink = `${origin}${base}/join/${booking.splitInviteToken}`;

    sendSplitBookingCreatedEmail({
      hostName: booking.customerName,
      hostEmail: booking.customerEmail,
      courtName: court?.name ?? "Kortas",
      courtId: booking.courtId ?? 0,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      pricePerSlot: Number(booking.pricePerSlot ?? 0),
      totalPrice: Number(booking.totalPrice),
      totalSlots: booking.totalSlots ?? 1,
      shareLink,
      bookingId: booking.id,
    }).catch((err) => logger.error({ err }, "sendSplitBookingCreatedEmail failed"));

    sendNotification(
      booking.bookerUserId,
      "split_player_joined",
      "Žaidimas sukurtas!",
      `Jūsų vieta aikštelėje ${court?.name ?? "kortas"} (${booking.date}) patvirtinta. Dalinkitės nuoroda su žaidėjais.`,
      `/bookings/${booking.id}`,
    ).catch(() => {});
  }

  res.json({
    bookingId: booking.id,
    gameId: game?.id ?? null,
    shareToken: booking.splitInviteToken ?? null,
    pricePerSlot: Number(booking.pricePerSlot ?? 0),
    yourShareEur: await viewerShareEur(Number(booking.pricePerSlot ?? 0), participant?.appliedMembershipId),
    totalSlots: booking.totalSlots ?? 1,
    paidSlots,
    totalPrice: Number(booking.totalPrice),
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    sport: game?.sport ?? null,
    isPublic: game?.visibility === "public",
    courtId: booking.courtId,
    courtName: court?.name ?? null,
    courtImageUrl: court?.imageUrl ?? null,
    facilityId: game?.facilityId ?? court?.facilityId ?? null,
  });
});

// ─── GET /api/bookings/share/:token ──────────────────────────────────────────

router.get("/bookings/share/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token);
  if (!token) { res.status(400).json({ error: "Token required" }); return; }

  const rows = await db
    .select({ booking: bookingsTable, court: courtsTable, facility: facilitiesTable })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(eq(bookingsTable.splitInviteToken, token));

  if (!rows[0]) { res.status(404).json({ error: "Invite link not found" }); return; }

  const { booking, court, facility } = rows[0];

  if (!booking.isSplit) { res.status(400).json({ error: "Not a split booking" }); return; }

  if (booking.status === "cancelled") {
    res.status(410).json({ error: "Booking was cancelled" });
    return;
  }

  // Get linked game + participant counts
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.bookingId, booking.id));

  let paidCount = 0;
  let pendingCount = 0;
  let paidParticipantNames: string[] = [];
  if (game) {
    const participants = await db
      .select({ paymentStatus: gameParticipantsTable.paymentStatus, userName: gameParticipantsTable.userName })
      .from(gameParticipantsTable)
      .where(and(
        eq(gameParticipantsTable.gameId, game.id),
        eq(gameParticipantsTable.status, "joined"),
      ));
    const paid = participants.filter(p => p.paymentStatus === "paid");
    paidCount = paid.length;
    pendingCount = participants.filter(p => p.paymentStatus === "pending").length;
    // Only expose first names for social proof — no emails
    paidParticipantNames = paid.map(p => (p.userName ?? "").split(" ")[0]).filter(Boolean);
  }

  const slotsLeft = Math.max(0, (booking.totalSlots ?? 1) - paidCount - pendingCount);

  // Guarantee deadline: game start - 2 hours (game time is stored as Vilnius local)
  const GUARANTEE_HOURS = 2;
  const gameStartMs = vilniusLocalToUtcMs(booking.date.split("T")[0], booking.startTime);
  const guaranteeDeadline = new Date(gameStartMs - GUARANTEE_HOURS * 60 * 60 * 1000).toISOString();

  res.json({
    bookingId: booking.id,
    gameId: game?.id ?? null,
    courtId: court?.id ?? null,
    courtName: court?.name ?? "",
    facilityName: facility?.name ?? "",
    facilityAddress: facility?.address ?? null,
    facilityCity: facility?.city ?? "",
    courtImageUrl: court?.imageUrl ?? null,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    totalPrice: Number(booking.totalPrice),
    pricePerSlot: Number(booking.pricePerSlot ?? 0),
    totalSlots: booking.totalSlots ?? 1,
    paidSlots: paidCount,
    slotsLeft,
    bookingStatus: booking.status,
    sport: game?.sport ?? null,
    paidParticipants: paidParticipantNames,
    guaranteeDeadline,
  });
});

// ─── POST /api/bookings/share/:token/checkout ─────────────────────────────────

router.post("/bookings/share/:token/checkout", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req); // null for unauthenticated guests
  const token = String(req.params.token);

  // Guests must supply name + email
  const isGuest = !userId;
  let guestName: string | null = null;
  let guestEmail: string | null = null;
  if (isGuest) {
    guestName = (req.body?.guestName as string | undefined)?.trim() ?? null;
    guestEmail = (req.body?.guestEmail as string | undefined)?.trim() ?? null;
    if (!guestName || !guestEmail) {
      res.status(400).json({ error: "Vardas ir el. paštas privalomi" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      res.status(400).json({ error: "Neteisingas el. pašto adresas" });
      return;
    }
  }

  const rows = await db
    .select({ booking: bookingsTable, court: courtsTable, facility: facilitiesTable })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(eq(bookingsTable.splitInviteToken, token));

  if (!rows[0]) { res.status(404).json({ error: "Invite link not found" }); return; }

  const { booking, court, facility } = rows[0];

  if (!booking.isSplit) { res.status(400).json({ error: "Not a split booking" }); return; }
  if (booking.status === "cancelled") { res.status(410).json({ error: "Booking was cancelled" }); return; }
  if (booking.status === "confirmed") { res.status(409).json({ error: "Booking fully paid" }); return; }

  // Reject payments once the game has already started (time stored as Vilnius local)
  const gameStartMs = vilniusLocalToUtcMs(booking.date.split("T")[0], booking.startTime);
  if (Date.now() >= gameStartMs) {
    res.status(410).json({ error: "Žaidimo laikas jau praėjo — mokėti nebegalima" });
    return;
  }

  // Prevent authenticated host from joining again via invite link
  if (!isGuest && booking.bookerUserId === userId) {
    res.status(409).json({ error: "Tu jau esi šio žaidimo organizatorius" });
    return;
  }

  // Get linked game
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.bookingId, booking.id));
  if (!game) { res.status(500).json({ error: "Game not found" }); return; }

  // Get existing participants
  const existingParticipants = await db
    .select()
    .from(gameParticipantsTable)
    .where(and(
      eq(gameParticipantsTable.gameId, game.id),
      eq(gameParticipantsTable.status, "joined"),
    ));

  // Skill level gate for public matches (authenticated users only)
  if (!isGuest && userId && game.visibility === "public" && (game.minSkillLevel != null || game.maxSkillLevel != null)) {
    const [sportProfile] = await db
      .select({ skillScore: userSportProfilesTable.skillScore })
      .from(userSportProfilesTable)
      .where(and(
        eq(userSportProfilesTable.userId, userId),
        eq(userSportProfilesTable.sport, game.sport),
      ));

    const userSkill = sportProfile?.skillScore ?? null;
    if (userSkill != null) {
      if (game.minSkillLevel != null && userSkill < game.minSkillLevel) {
        res.status(403).json({ error: "Jūsų lygis per žemas šiam žaidimui", code: "SKILL_TOO_LOW" });
        return;
      }
      if (game.maxSkillLevel != null && userSkill > game.maxSkillLevel) {
        res.status(403).json({ error: "Jūsų lygis per aukštas šiam žaidimui", code: "SKILL_TOO_HIGH" });
        return;
      }
    }
  }

  // Check if authenticated user already has a slot (paid or pending)
  if (!isGuest) {
    const alreadyJoined = existingParticipants.find(p => p.userId === userId);
    if (alreadyJoined) {
      if (alreadyJoined.paymentStatus === "paid") {
        res.status(409).json({ error: "Tu jau sumokėjai savo dalį" });
      } else {
        res.status(409).json({ error: "Turi laukiančią mokėjimo sesiją. Užbaik mokėjimą arba bandyk vėliau." });
      }
      return;
    }
  }

  const pricePerSlot = Number(booking.pricePerSlot ?? 0);

  const origin = req.get("origin") ?? req.get("host") ?? "https://korts.lt";
  const base = process.env.BASE_PATH ?? "";

  const userName = isGuest ? guestName! : ((req.body?.playerName as string | undefined) ?? "Žaidėjas");
  const userEmail = isGuest ? guestEmail! : ((req.body?.playerEmail as string | undefined) ?? "");

  const successUrl = `${origin}${base}/join/${token}?paid=1`;
  const cancelUrl = `${origin}${base}/join/${token}?cancelled=1`;

  // Atomic capacity check + insert inside a transaction to prevent TOCTOU race conditions.
  // The FOR UPDATE lock on the booking row serializes concurrent join requests.
  let participant: typeof gameParticipantsTable.$inferSelect;
  let shareEur = pricePerSlot;
  try {
    ({ participant, shareEur } = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`);

      const freshParticipants = await tx
        .select()
        .from(gameParticipantsTable)
        .where(and(
          eq(gameParticipantsTable.gameId, game.id),
          eq(gameParticipantsTable.status, "joined"),
        ));

      if (!isGuest) {
        const alreadyJoined = freshParticipants.find(p => p.userId === userId);
        if (alreadyJoined) {
          const code = alreadyJoined.paymentStatus === "paid" ? "ALREADY_PAID" : "PENDING_PAYMENT";
          throw Object.assign(new Error("conflict"), { txCode: code });
        }
      }

      if (freshParticipants.length >= (booking.totalSlots ?? 1)) {
        throw Object.assign(new Error("slots_full"), { txCode: "SLOTS_FULL" });
      }

      // Joiner's own membership discounts their share. Guests never qualify.
      const shareDiscount = await applyMembershipDiscount(tx, {
        userId: isGuest ? null : userId,
        facilityId: facility?.id ?? game.facilityId ?? 0,
        sport: game.sport,
        playDate: booking.date.split("T")[0],
        amountEur: pricePerSlot,
      });

      const [newParticipant] = await tx.insert(gameParticipantsTable).values({
        gameId: game.id,
        userId: isGuest ? null : userId,
        userName,
        userEmail: userEmail || null,
        status: "joined",
        source: "join_request",
        paymentStatus: "pending",
        appliedMembershipId: shareDiscount.membershipId,
      }).returning();

      return { participant: newParticipant, shareEur: shareDiscount.discounted };
    }));
  } catch (err: any) {
    if (err?.txCode === "SLOTS_FULL") {
      res.status(409).json({ error: "Visos dalys jau užimtos" });
      return;
    }
    if (err?.txCode === "ALREADY_PAID") {
      res.status(409).json({ error: "Tu jau sumokėjai savo dalį" });
      return;
    }
    if (err?.txCode === "PENDING_PAYMENT") {
      res.status(409).json({ error: "Turi laukiančią mokėjimo sesiją. Užbaik mokėjimą arba bandyk vėliau." });
      return;
    }
    throw err;
  }

  // Shared by the €0-share path and the Stripe-not-configured fallback:
  // mark this participant paid, confirm the booking when all shares are in,
  // and send the join/confirmation notifications.
  async function settleShareWithoutStripe(sessionId: string): Promise<string> {
    await db.update(gameParticipantsTable)
      .set({ paymentStatus: "paid", stripeSessionId: sessionId })
      .where(eq(gameParticipantsTable.id, participant.id));

    // Check if all paid
    const allParticipants = await db
      .select({ paymentStatus: gameParticipantsTable.paymentStatus })
      .from(gameParticipantsTable)
      .where(and(eq(gameParticipantsTable.gameId, game.id), eq(gameParticipantsTable.status, "joined")));
    const paidCount = allParticipants.filter(p => p.paymentStatus === "paid").length;

    if (paidCount >= (booking.totalSlots ?? 1)) {
      await db.update(bookingsTable).set({ status: "confirmed" }).where(eq(bookingsTable.id, booking.id));
      await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, game.id));
    }

    // Notify host that someone joined
    if (booking.bookerUserId) {
      sendNotification(
        booking.bookerUserId,
        "split_player_joined",
        `${userName} prisijungė prie jūsų žaidimo!`,
        `Apmokėta: ${paidCount}/${booking.totalSlots ?? 1} vietų – ${court?.name ?? "kortas"}, ${booking.date}`,
        `/bookings/${booking.id}`,
      ).catch(() => {});

      sendSplitPlayerJoinedEmail({
        hostName: booking.customerName,
        hostEmail: booking.customerEmail,
        playerName: userName,
        courtName: court?.name ?? "Kortas",
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        paidSlots: paidCount,
        totalSlots: booking.totalSlots ?? 1,
        bookingId: booking.id,
      }).catch((e) => logger.error({ e }, "sendSplitPlayerJoinedEmail failed"));
    }

    // Send confirmation to the invitee
    if (userEmail) {
      sendSplitParticipantConfirmationEmail({
        playerName: userName,
        playerEmail: userEmail,
        courtName: court?.name ?? "Kortas",
        courtId: booking.courtId ?? 0,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        pricePerSlot: shareEur,
        bookingId: booking.id,
      }).catch((e) => logger.error({ e }, "sendSplitParticipantConfirmationEmail failed"));
    }

    return `${successUrl}&session_id=${sessionId}`;
  }

  let checkoutUrl: string;
  const amountCents = Math.round(shareEur * 100);

  if (amountCents === 0) {
    // Membership covered this share entirely — no payment session needed.
    checkoutUrl = await settleShareWithoutStripe(`free_split_join_${booking.id}_${Date.now()}`);
  } else {
    try {
      const stripe = await getUncachableStripeClient();

      let connectAccountId: string | null = null;
      if (facility?.ownerUserId) {
        const [ownerProfile] = await db
          .select({ stripeAccountId: userProfilesTable.stripeAccountId, status: userProfilesTable.stripeAccountStatus })
          .from(userProfilesTable)
          .where(eq(userProfilesTable.userId, facility.ownerUserId));
        if (ownerProfile?.stripeAccountId && ownerProfile.status === "active") {
          connectAccountId = ownerProfile.stripeAccountId;
        }
      }

      const slotNumber = existingParticipants.length + 1;
      const sessionParams: any = {
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `${court?.name ?? "Kortas"} – mokėjimo dalis (${slotNumber}/${booking.totalSlots})`,
              description: `${booking.date} · ${booking.startTime}–${booking.endTime}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          bookingId: String(booking.id),
          splitParticipantId: String(participant.id),
        },
        customer_email: userEmail || undefined,
        locale: "lt",
      };

      if (connectAccountId) {
        const feeAmount = Math.round(amountCents * 5 / 100);
        sessionParams.payment_intent_data = {
          application_fee_amount: feeAmount,
          transfer_data: { destination: connectAccountId },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      await db.update(gameParticipantsTable)
        .set({ stripeSessionId: session.id })
        .where(eq(gameParticipantsTable.id, participant.id));

      checkoutUrl = session.url!;

    } catch (err: any) {
      if (err?.message?.includes("Stripe not configured") || err?.type === "StripeAuthenticationError") {
        checkoutUrl = await settleShareWithoutStripe(`mock_split_join_${booking.id}_${Date.now()}`);
      } else {
        logger.error({ err }, "Failed to create Stripe session for split participant");
        res.status(500).json({ error: "Failed to create payment session" });
        return;
      }
    }
  }

  res.json({ url: checkoutUrl });
});

// The viewer's actual share: the nominal per-slot price minus their own
// membership discount (tracked on game_participants.appliedMembershipId).
// Display-only — charging happened at checkout with the same formula.
async function viewerShareEur(pricePerSlot: number, appliedMembershipId: number | null | undefined): Promise<number> {
  if (!appliedMembershipId || pricePerSlot <= 0) return pricePerSlot;
  const [row] = await db.select({ pct: courtMembershipsTable.discountPercent })
    .from(userMembershipsTable)
    .innerJoin(courtMembershipsTable, eq(userMembershipsTable.membershipPlanId, courtMembershipsTable.id))
    .where(eq(userMembershipsTable.id, appliedMembershipId));
  const pct = Number(row?.pct ?? 0);
  if (pct <= 0) return pricePerSlot;
  return Math.round(Math.round(pricePerSlot * 100) * (100 - pct) / 100) / 100;
}

// ─── GET /api/bookings/:bookingId/split-status ────────────────────────────────

router.get("/bookings/:bookingId/split-status", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const bookingId = parseInt(String(req.params.bookingId), 10);
  if (isNaN(bookingId)) { res.status(400).json({ error: "Invalid bookingId" }); return; }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  if (!booking.isSplit) { res.status(400).json({ error: "Not a split booking" }); return; }

  // Auth: must be the host
  if (booking.bookerUserId !== userId) {
    // Or a participant
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.bookingId, bookingId));
    if (!game) { res.status(403).json({ error: "Forbidden" }); return; }
    const [p] = await db.select({ id: gameParticipantsTable.id })
      .from(gameParticipantsTable)
      .where(and(
        eq(gameParticipantsTable.gameId, game.id),
        eq(gameParticipantsTable.userId, userId),
      ));
    if (!p) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.bookingId, bookingId));

  const participants = game
    ? await db.select().from(gameParticipantsTable)
        .where(and(eq(gameParticipantsTable.gameId, game.id), eq(gameParticipantsTable.status, "joined")))
    : [];

  const me = participants.find(p => p.userId === userId);
  const yourShareEur = await viewerShareEur(Number(booking.pricePerSlot ?? 0), me?.appliedMembershipId);

  res.json({
    bookingId,
    gameId: game?.id ?? null,
    bookingStatus: booking.status,
    totalSlots: booking.totalSlots ?? 1,
    pricePerSlot: Number(booking.pricePerSlot ?? 0),
    yourShareEur,
    totalPrice: Number(booking.totalPrice),
    shareToken: booking.splitInviteToken,
    participants: participants.map(p => ({
      userId: p.userId,
      userName: p.userName,
      paymentStatus: p.paymentStatus,
      joinedAt: p.joinedAt.toISOString(),
    })),
  });
});

// ─── GET /api/test/sweep-host-guarantees ─────────────────────────────────────
// Manual trigger for the host guarantee sweeper (testing only).
router.get("/test/sweep-host-guarantees", async (_req, res): Promise<void> => {
  try {
    const processed = await sweepHostGuarantees();
    res.json({ ok: true, processed });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ─── POST /search/groups/:facilityId/:sport/checkout-split ────────────────────
// Group split checkout: auto-allocates a court (wear-balancing) then runs the
// same split booking + game + Stripe flow as /games/checkout-split.

const GroupSplitCheckoutBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  // Player picked a specific court — allocation is pinned to it.
  courtId: z.number().int().positive().optional(),
  totalSlots: z.number().int().min(2).max(8),
  skillLevel: z.string().optional().default("any"),
  description: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
  minSkillLevel: z.number().min(0).max(10).optional(),
  maxSkillLevel: z.number().min(0).max(10).optional(),
  matchType: z.enum(["casual", "competitive"]).optional().default("casual"),
});

router.post("/search/groups/:facilityId/:sport/checkout-split", requireAuth, async (req, res): Promise<void> => {
  const facilityId = parseInt(String(req.params.facilityId), 10);
  const sportRaw   = String(req.params.sport);
  if (isNaN(facilityId) || !sportRaw) { res.status(400).json({ error: "Invalid parameters" }); return; }
  const sport = sportRaw.replace(/-/g, "_");

  const userId = getCurrentUserId(req)!;
  const parsed = GroupSplitCheckoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const {
    date, startTime, endTime, totalSlots, skillLevel, description,
    customerName, customerEmail, customerPhone,
    isPublic, minSkillLevel, maxSkillLevel, matchType,
    courtId: requestedCourtId,
  } = parsed.data;

  const reqStartMin = toMin(startTime);
  const reqEndMin   = toMin(endTime);
  if (reqEndMin <= reqStartMin) { res.status(400).json({ error: "endTime must be after startTime" }); return; }

  const dateInt = parseInt(date.replace(/-/g, ""), 10);

  // ── Wear-balancing court list (same as group-book endpoint) ─────────────────
  const courtsRaw = await db.execute(sql`
    SELECT c.id, c.price_per_hour AS "pricePerHour", c.facility_id AS "facilityId",
           COUNT(b.id) FILTER (
             WHERE b.status IN ('confirmed','awaiting_players')
               OR  (b.status = 'pending' AND b.created_at > NOW() - INTERVAL '15 minutes')
           ) AS booking_count
    FROM courts c
    LEFT JOIN bookings b ON b.court_id = c.id AND b.created_at >= NOW() - INTERVAL '7 days'
    WHERE c.facility_id = ${facilityId}
      AND REPLACE(c.type, '-', '_') = ${sport}
      AND c.status IN ('approved', 'active')
    GROUP BY c.id, c.price_per_hour, c.facility_id
    ORDER BY booking_count ASC, c.id ASC
  `);
  let courtRows = (courtsRaw.rows as { id: number; pricePerHour: string; facilityId: number; booking_count: string }[])
    .map(r => ({ id: r.id, pricePerHour: r.pricePerHour, facilityId: r.facilityId, bookingCount: Number(r.booking_count) }));

  if (courtRows.length === 0) { res.status(404).json({ error: "No active courts for this group" }); return; }

  // The query above already scopes to facility+sport+active, so filtering by id
  // doubles as the membership check for the requested court.
  if (requestedCourtId != null) {
    courtRows = courtRows.filter(c => c.id === requestedCourtId);
    if (courtRows.length === 0) { res.status(404).json({ error: "Court not found in this group" }); return; }
  }

  // Cheapest court for the requested range first — matches the group /book
  // allocator, so split prices line up with the availability grid. Wear
  // balancing (least 7-day usage) breaks ties between equal-priced courts.
  const rangeSlots = slotsBetween(startTime, endTime);
  const courts = await Promise.all(courtRows.map(async (c) => {
    const def = Number(c.pricePerHour) / 2;
    const { priceMap } = await buildDayPriceMap(c.id, date, def);
    let rangePrice = 0;
    for (const s of rangeSlots) rangePrice += priceMap.get(s) ?? def;
    return { ...c, rangePrice };
  }));
  courts.sort((a, b) => a.rangePrice - b.rangePrice || a.bookingCount - b.bookingCount || a.id - b.id);

  // ── Fetch facility once ────────────────────────────────────────────────────
  const [facilityRow] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, facilityId));
  if (!facilityRow) { res.status(404).json({ error: "Facility not found" }); return; }

  class ConflictError extends Error { constructor() { super("Conflict"); } }

  // ── Try each court; first free one wins ────────────────────────────────────
  for (const courtCandidate of courts) {
    const defaultSlotPrice = Number(courtCandidate.pricePerHour) / 2;

    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(courtCandidate.id))}::int, ${sql.raw(String(dateInt))}::int)`);

        const [conflicting, blocked] = await Promise.all([
          tx.select({ s: bookingsTable.startTime, e: bookingsTable.endTime })
            .from(bookingsTable)
            .where(and(
              eq(bookingsTable.courtId, courtCandidate.id),
              eq(bookingsTable.date, date),
              sql`(${bookingsTable.status} IN ('confirmed','blocked','awaiting_players')
                  OR (${bookingsTable.status} = 'pending' AND ${bookingsTable.createdAt} > NOW() - INTERVAL '15 minutes'))`,
            )),
          tx.select({ s: courtBlockedSlotsTable.startTime, e: courtBlockedSlotsTable.endTime })
            .from(courtBlockedSlotsTable)
            .where(and(eq(courtBlockedSlotsTable.courtId, courtCandidate.id), eq(courtBlockedSlotsTable.date, date))),
        ]);

        for (const b of [...conflicting, ...blocked]) {
          if (reqStartMin < toMin(b.e) && reqEndMin > toMin(b.s)) throw new ConflictError();
        }

        // Court is free — compute price
        const { priceMap } = await buildDayPriceMap(courtCandidate.id, date, defaultSlotPrice);
        let courtPrice = 0;
        for (const s of slotsBetween(startTime, endTime)) courtPrice += priceMap.get(s) ?? defaultSlotPrice;
        const pricePerSlot = Math.round((courtPrice / totalSlots) * 100) / 100;

        // Host's own membership discounts the host's share only. Booking keeps
        // full totalPrice/pricePerSlot — other participants pay full shares.
        const hostDiscount = await applyMembershipDiscount(tx, {
          userId, facilityId, sport, playDate: date, amountEur: pricePerSlot,
        });

        const durationMinutes = reqEndMin - reqStartMin;
        const splitInviteToken = crypto.randomBytes(20).toString("hex");
        const datetime = `${date}T${startTime}:00`;

        const [booking] = await tx.insert(bookingsTable).values({
          courtId: courtCandidate.id,
          bookerUserId: userId,
          customerName,
          customerEmail,
          customerPhone: customerPhone ?? null,
          date, startTime, endTime,
          totalPrice: String(courtPrice),
          status: "pending",
          isSplit: true,
          totalSlots,
          pricePerSlot: String(pricePerSlot),
          splitInviteToken,
        }).returning();

        const [game] = await tx.insert(gamesTable).values({
          creatorUserId: userId,
          creatorName: customerName,
          creatorEmail: customerEmail,
          sport,
          city: facilityRow.city ?? "",
          placeName: facilityRow.name,
          facilityId,
          courtId: courtCandidate.id,
          bookingId: booking.id,
          playersNeeded: totalSlots,
          skillLevel: skillLevel ?? "any",
          datetime,
          durationMinutes,
          description: description ?? null,
          status: "pending_payment",
          matchType: matchType ?? "casual",
          isPrivate: !isPublic,
          visibility: isPublic ? "public" : "private",
          minSkillLevel: isPublic ? (minSkillLevel ?? null) : null,
          maxSkillLevel: isPublic ? (maxSkillLevel ?? null) : null,
          requiresApproval: false,
          teamCount: 2,
        }).returning();

        const [hostParticipant] = await tx.insert(gameParticipantsTable).values({
          gameId: game.id,
          userId,
          userName: customerName,
          userEmail: customerEmail,
          status: "joined",
          source: "join_request",
          paymentStatus: "pending",
          appliedMembershipId: hostDiscount.membershipId,
        }).returning();

        return { booking, game, hostParticipant, courtPrice, pricePerSlot, splitInviteToken, durationMinutes, hostShareEur: hostDiscount.discounted };
      });

      // ── Stripe ──────────────────────────────────────────────────────────────
      const origin = req.get("origin") ?? req.get("host") ?? "https://korts.lt";
      const base = process.env.BASE_PATH ?? "";
      const successUrl = `${origin}${base}/booking-confirmed?id=${result.booking.id}&split=1`;
      const cancelUrl  = `${origin}${base}/facility/${facilityId}?sport=${sport}`;

      let checkoutUrl: string;
      const amountCents = Math.round(result.hostShareEur * 100);

      // Shared by the €0-share path and the Stripe-not-configured fallback:
      // mark host paid, move booking + game to awaiting_players.
      async function settleHostShareWithoutStripe(sessionId: string): Promise<string> {
        await db.update(bookingsTable).set({ stripeSessionId: sessionId, status: "awaiting_players" }).where(eq(bookingsTable.id, result.booking.id));
        await db.update(gameParticipantsTable).set({ stripeSessionId: sessionId, paymentStatus: "paid" }).where(eq(gameParticipantsTable.id, result.hostParticipant.id));
        await db.update(gamesTable).set({ status: "awaiting_players" }).where(eq(gamesTable.id, result.game.id));
        return `${successUrl}&session_id=${sessionId}`;
      }

      if (amountCents === 0) {
        // Membership covered the host's entire share — no payment session needed.
        checkoutUrl = await settleHostShareWithoutStripe(`free_split_${result.booking.id}_${Date.now()}`);
      } else {
        try {
          const stripe = await getUncachableStripeClient();
          let connectAccountId: string | null = null;
          if (facilityRow.ownerUserId) {
            const [profile] = await db.select({ stripeAccountId: userProfilesTable.stripeAccountId, status: userProfilesTable.stripeAccountStatus })
              .from(userProfilesTable).where(eq(userProfilesTable.userId, facilityRow.ownerUserId));
            if (profile?.stripeAccountId && profile.status === "active") connectAccountId = profile.stripeAccountId;
          }

          const sessionParams: any = {
            payment_method_types: ["card"],
            line_items: [{ price_data: { currency: "eur", product_data: { name: `${facilityRow.name} – mokėjimo dalis (1/${totalSlots})`, description: `${date} · ${startTime}–${endTime}` }, unit_amount: amountCents }, quantity: 1 }],
            mode: "payment",
            success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            metadata: { bookingId: String(result.booking.id), splitParticipantId: String(result.hostParticipant.id) },
            customer_email: customerEmail,
            customer_creation: "always",
            locale: "lt",
            payment_intent_data: { setup_future_usage: "off_session" },
          };
          if (connectAccountId) {
            const feeAmount = Math.round(amountCents * 5 / 100);
            sessionParams.payment_intent_data = { setup_future_usage: "off_session", application_fee_amount: feeAmount, transfer_data: { destination: connectAccountId } };
          }
          const session = await stripe.checkout.sessions.create(sessionParams);
          await db.update(bookingsTable).set({ stripeSessionId: session.id }).where(eq(bookingsTable.id, result.booking.id));
          await db.update(gameParticipantsTable).set({ stripeSessionId: session.id }).where(eq(gameParticipantsTable.id, result.hostParticipant.id));
          checkoutUrl = session.url!;
        } catch (err: any) {
          if (err?.message?.includes("Stripe not configured") || err?.type === "StripeAuthenticationError") {
            checkoutUrl = await settleHostShareWithoutStripe(`mock_split_${result.booking.id}_${Date.now()}`);
          } else {
            logger.error({ err }, "Group split: Stripe session failed");
            await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, result.booking.id));
            await db.delete(gamesTable).where(eq(gamesTable.id, result.game.id));
            res.status(500).json({ error: "Failed to create payment session" }); return;
          }
        }
      }

      res.status(201).json({ url: checkoutUrl, bookingId: result.booking.id, gameId: result.game.id, shareToken: result.splitInviteToken, pricePerSlot: result.hostShareEur });
      return;

    } catch (err) {
      if (err instanceof ConflictError) continue;
      throw err;
    }
  }

  res.status(409).json({ error: "No available court for the selected time slot", code: "SLOT_UNAVAILABLE" });
});

export default router;

// ─── sweepHostGuarantees ──────────────────────────────────────────────────────
// Runs periodically. Finds awaiting_players split bookings whose game starts
// within GUARANTEE_HOURS. Charges the host's saved card for the missing amount.
// On success → confirmed. On failure → cancelled + refund all paid participants.

const GUARANTEE_HOURS = 2;

export async function sweepHostGuarantees(): Promise<number> {
  // Find split bookings in awaiting_players whose game starts within the guarantee window.
  // IMPORTANT: gamesTable.datetime stores Vilnius local time as a plain string (no tz).
  // Using CAST(... AS TIMESTAMPTZ) would treat it as UTC, causing a 2-3 h offset.
  // Instead, use AT TIME ZONE 'Europe/Vilnius' to convert correctly to UTC before comparing.
  const candidates = await db
    .select({
      booking: bookingsTable,
      game: gamesTable,
    })
    .from(bookingsTable)
    .innerJoin(gamesTable, eq(gamesTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.status, "awaiting_players"),
        eq(bookingsTable.isSplit, true),
        // Only bookings where we have a saved payment method for the host
        sql`${bookingsTable.hostStripeCustomerId} IS NOT NULL`,
        sql`${bookingsTable.hostStripePaymentMethodId} IS NOT NULL`,
        // Game starts within the next GUARANTEE_HOURS (deadline reached)
        sql`(${gamesTable.datetime}::TIMESTAMP AT TIME ZONE 'Europe/Vilnius') <= NOW() + INTERVAL '${sql.raw(String(GUARANTEE_HOURS))} hours'`,
        // Game hasn't ended yet (don't process historical bookings)
        sql`(${gamesTable.datetime}::TIMESTAMP AT TIME ZONE 'Europe/Vilnius') > NOW() - INTERVAL '3 hours'`,
      ),
    );

  console.log(`[sweepHostGuarantees] Found ${candidates.length} candidate(s)`);
  if (candidates.length === 0) return 0;

  let processed = 0;
  const stripe = await getUncachableStripeClient().catch(() => null);
  if (!stripe) {
    // Stripe not configured (dev/mock mode) — force-cancel overdue bookings without charging.
    console.log("[sweepHostGuarantees] Stripe not configured — force-cancelling overdue bookings");
    for (const { booking, game } of candidates) {
      await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, booking.id));
      await db.update(gamesTable).set({ status: "cancelling" }).where(eq(gamesTable.id, game.id));
      console.log(`[sweepHostGuarantees] booking=${booking.id} force-cancelled (no Stripe)`);
      processed++;
    }
    return processed;
  }

  for (const { booking, game } of candidates) {
    try {
      // Get all participants for this game
      const participants = await db
        .select()
        .from(gameParticipantsTable)
        .where(and(
          eq(gameParticipantsTable.gameId, game.id),
          eq(gameParticipantsTable.status, "joined"),
        ));

      const paidCount = participants.filter(p => p.paymentStatus === "paid").length;
      const totalSlots = booking.totalSlots ?? 1;
      const pricePerSlot = Number(booking.pricePerSlot ?? 0);
      const missingSlots = Math.max(0, totalSlots - paidCount);
      const missingAmountCents = Math.round(missingSlots * pricePerSlot * 100);

      console.log(`[sweepHostGuarantees] booking=${booking.id} paidSlots=${paidCount}/${totalSlots} missingSlots=${missingSlots} missingAmount=${(missingAmountCents / 100).toFixed(2)}€`);
      console.log(`[sweepHostGuarantees] booking=${booking.id} hostCustomerId=${booking.hostStripeCustomerId} paymentMethodId=${booking.hostStripePaymentMethodId}`);

      if (missingSlots === 0) {
        // All paid — just confirm
        console.log(`[sweepHostGuarantees] booking=${booking.id} all slots paid — confirming`);
        await db.update(bookingsTable).set({ status: "confirmed" }).where(eq(bookingsTable.id, booking.id));
        await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, game.id));
        processed++;
        continue;
      }

      // Fetch court name + Connect account if applicable
      let transferData: { destination: string } | undefined;
      let appFeeAmount: number | undefined;
      const courtRows = booking.courtId != null
        ? await db
            .select({ facilityId: courtsTable.facilityId, name: courtsTable.name })
            .from(courtsTable)
            .where(eq(courtsTable.id, booking.courtId))
        : [];
      const facilityId = courtRows[0]?.facilityId;
      const courtName = courtRows[0]?.name ?? "kortas";
      if (facilityId) {
        const [fac] = await db
          .select({ ownerUserId: facilitiesTable.ownerUserId })
          .from(facilitiesTable)
          .where(eq(facilitiesTable.id, facilityId));
        if (fac?.ownerUserId) {
          const [profile] = await db
            .select({ stripeAccountId: userProfilesTable.stripeAccountId, status: userProfilesTable.stripeAccountStatus })
            .from(userProfilesTable)
            .where(eq(userProfilesTable.userId, fac.ownerUserId));
          if (profile?.stripeAccountId && profile.status === "active") {
            transferData = { destination: profile.stripeAccountId };
            appFeeAmount = Math.round(missingAmountCents * 5 / 100);
          }
        }
      }

      try {
        await stripe.paymentIntents.create({
          amount: missingAmountCents,
          currency: "eur",
          customer: booking.hostStripeCustomerId!,
          payment_method: booking.hostStripePaymentMethodId!,
          confirm: true,
          off_session: true,
          ...(transferData ? { transfer_data: transferData, application_fee_amount: appFeeAmount } : {}),
        }, {
          idempotencyKey: `guarantee-booking-${booking.id}`,
        });

        // Charge succeeded → confirm
        console.log(`[sweepHostGuarantees] Stripe charge SUCCEEDED for booking=${booking.id} amount=${(missingAmountCents / 100).toFixed(2)}€`);
        await db.update(bookingsTable).set({ status: "confirmed" }).where(eq(bookingsTable.id, booking.id));
        await db.update(gamesTable).set({ status: "open" }).where(eq(gamesTable.id, game.id));
        logger.info({ bookingId: booking.id, missingAmountCents }, "guarantee charge succeeded");

        // Scenario A — notify host that their card was charged and game is confirmed
        if (booking.bookerUserId) {
          const amountEur = (missingAmountCents / 100).toFixed(2);
          sendNotification(
            booking.bookerUserId,
            "split_guarantee_charged",
            "Rezervacija patvirtinta",
            `Trūkstami žaidėjai neprisijungė. Nuo jūsų kortelės nuskaityta ${amountEur}€. Gero žaidimo!`,
            `/bookings/${booking.id}`,
          ).catch(() => {});
          sendSplitGuaranteeChargedEmail({
            hostName: booking.customerName,
            hostEmail: booking.customerEmail,
            chargedAmountEur: missingAmountCents / 100,
            courtName,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            bookingId: booking.id,
          }).catch((e) => logger.error({ e }, "sendSplitGuaranteeChargedEmail failed"));
        }
        processed++;
      } catch (chargeErr: any) {
        // Charge failed → cancel and refund paid participants
        console.error(`[sweepHostGuarantees] Stripe charge FAILED for booking=${booking.id}: code=${chargeErr?.code} message=${chargeErr?.message}`, chargeErr);
        logger.warn({ bookingId: booking.id, err: chargeErr?.message }, "guarantee charge failed — cancelling");
        await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, booking.id));
        await db.update(gamesTable).set({ status: "cancelling" }).where(eq(gamesTable.id, game.id));

        // Scenario B — notify host that their card was declined and booking is cancelled
        if (booking.bookerUserId) {
          const amountEur = (missingAmountCents / 100).toFixed(2);
          sendNotification(
            booking.bookerUserId,
            "split_guarantee_failed",
            "Rezervacija atšaukta",
            `Nepavyko nuskaityti trūkstamos sumos (${amountEur}€). Kortelė atmesta, rezervacija atšaukta.`,
            `/bookings/${booking.id}`,
          ).catch(() => {});
          sendSplitGuaranteeFailedEmail({
            hostName: booking.customerName,
            hostEmail: booking.customerEmail,
            failedAmountEur: missingAmountCents / 100,
            courtName,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            bookingId: booking.id,
          }).catch((e) => logger.error({ e }, "sendSplitGuaranteeFailedEmail failed"));
        }

        // Scenario C — notify and refund each participant who already paid
        const allPaid = participants.filter(p => p.paymentStatus === "paid");
        for (const p of allPaid) {
          // In-app notification (registered users only)
          if (p.userId) {
            // Free-share participants paid nothing — don't claim a refund.
            const isFreeShare = p.stripeSessionId?.startsWith("free_split") ?? false;
            sendNotification(
              p.userId,
              "split_guarantee_refunded",
              "Rezervacija atšaukta",
              isFreeShare
                ? "Nesurinkus pilnos sumos, mačas atšauktas."
                : "Nesurinkus pilnos sumos, mačas atšauktas. Jūsų sumokėta dalis grąžinta.",
              booking.splitInviteToken ? `/join/${booking.splitInviteToken}` : undefined,
            ).catch(() => {});
          }
        }

        // Issue Stripe refunds for participants with a real charged session on record.
        // Free-share sessions (free_split*) moved no money — exclude them entirely.
        const paidParticipants = allPaid.filter(p => p.stripeSessionId && !p.stripeSessionId.startsWith("free_split"));
        for (const p of paidParticipants) {
          try {
            console.log(`[sweepHostGuarantees] Refunding participant=${p.id} sessionId=${p.stripeSessionId}`);
            const session = await stripe.checkout.sessions.retrieve(p.stripeSessionId!);
            if (session.payment_intent) {
              await stripe.refunds.create({ payment_intent: session.payment_intent as string });
              console.log(`[sweepHostGuarantees] Refund issued for participant=${p.id}`);
              // Email the actual amount refunded (per the charged session) — guests + registered users with email
              if (p.userEmail) {
                sendSplitParticipantRefundedEmail({
                  playerName: p.userName ?? "Žaidėjas",
                  playerEmail: p.userEmail,
                  refundAmountEur: (session.amount_total ?? Math.round(pricePerSlot * 100)) / 100,
                  courtName,
                  date: booking.date,
                  startTime: booking.startTime,
                  endTime: booking.endTime,
                  bookingId: booking.id,
                }).catch((e) => logger.error({ e }, "sendSplitParticipantRefundedEmail failed"));
              }
            }
          } catch (refundErr) {
            logger.error({ participantId: p.id, err: refundErr }, "guarantee refund failed");
          }
        }
        processed++;
      }
    } catch (err) {
      // Unexpected error (DB failure, etc.) — force-cancel to prevent the booking staying stuck.
      console.error(`[sweepHostGuarantees] Unexpected error for booking=${booking.id}:`, err);
      logger.error({ bookingId: booking.id, err }, "sweepHostGuarantees: unexpected error");
      try {
        await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, booking.id));
        await db.update(gamesTable).set({ status: "cancelling" }).where(eq(gamesTable.id, game.id));
        console.log(`[sweepHostGuarantees] booking=${booking.id} force-cancelled due to unexpected error`);
      } catch (cancelErr) {
        console.error(`[sweepHostGuarantees] Failed to cancel booking=${booking.id}:`, cancelErr);
      }
    }
  }

  return processed;
}
