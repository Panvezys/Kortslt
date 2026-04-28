import { Router, type IRouter } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, bookingsTable, courtsTable, facilitiesTable, userProfilesTable } from "@workspace/db";
import {
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
  ConfirmPaymentBody,
  ConfirmPaymentResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendBookingConfirmationEmail, sendOwnerBookingNotificationEmail } from "../lib/email";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { getCurrentUserId, requireAuth, getUserRole } from "../lib/auth";
import { timingSafeEqualToken } from "../lib/guestToken";

const router: IRouter = Router();

// ─── Publishable key (safe for frontend) ─────────────────────────────────────
router.get("/payments/config", async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err) {
    logger.error({ err }, "Failed to get Stripe publishable key");
    res.status(500).json({ error: "Stripe not configured" });
  }
});

// ─── Create Checkout Session (player or guest booking) ───────────────────────
// No requireAuth: a guest booking has no Clerk session, so we authorize via the
// `managementToken` (returned to the client when the booking was created).
// Authenticated callers are still authorized via session as before.
router.post("/payments/create-checkout", async (req, res): Promise<void> => {
  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { bookingId, successUrl, cancelUrl } = parsed.data;
  // Guest checkout passes the management token in the body (CreateCheckoutSessionBody
  // doesn't list it, so read it raw — we never trust it without comparing to DB).
  const providedToken =
    typeof (req.body as any)?.managementToken === "string"
      ? ((req.body as any).managementToken as string)
      : null;

  const rows = await db
    .select({ booking: bookingsTable, court: courtsTable })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, bookingId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const { booking, court } = rows[0];

  // Authorization:
  // 1) Authenticated booker / court owner / admin (existing behavior), OR
  // 2) Guest path: booking.bookerUserId is null AND request supplied the matching managementToken.
  const callerId = getCurrentUserId(req);
  let authorized = false;
  if (callerId) {
    const isBooker = booking.bookerUserId === callerId;
    const isCourtOwner = court?.ownerUserId === callerId;
    const callerRole = await getUserRole(callerId);
    authorized = isBooker || isCourtOwner || callerRole === "admin";
  }
  if (!authorized && booking.bookerUserId === null && timingSafeEqualToken(providedToken, booking.managementToken)) {
    authorized = true;
  }
  if (!authorized) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    logger.warn("Stripe not configured — using mock checkout");
    const mockSessionId = `mock_session_${bookingId}_${Date.now()}`;
    await db
      .update(bookingsTable)
      .set({ stripeSessionId: mockSessionId, status: "confirmed" })
      .where(eq(bookingsTable.id, bookingId));
    await db
      .update(courtsTable)
      .set({ totalBookings: sql`total_bookings + 1` })
      .where(eq(courtsTable.id, booking.courtId));
    const mockSuccessUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id=${mockSessionId}`;
    res.json(CreateCheckoutSessionResponse.parse({ sessionId: mockSessionId, url: mockSuccessUrl }));
    return;
  }

  const amountCents = Math.round(Number(booking.totalPrice) * 100);

  // Resolve payout destination:
  // 1) court-level Connect account (legacy per-court flow)
  // 2) facility-level Connect account
  // 3) owner's user-level Connect account (current onboarding flow)
  let connectAccountId: string | null = court?.stripeConnectAccountId ?? null;

  if (!connectAccountId && court?.facilityId) {
    const [facility] = await db
      .select({ id: facilitiesTable.id, stripeConnectAccountId: facilitiesTable.stripeConnectAccountId })
      .from(facilitiesTable)
      .where(eq(facilitiesTable.id, court.facilityId));
    connectAccountId = facility?.stripeConnectAccountId ?? null;
  }

  if (!connectAccountId && court?.ownerUserId) {
    const [profile] = await db
      .select({ stripeAccountId: userProfilesTable.stripeAccountId, status: userProfilesTable.stripeAccountStatus })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, court.ownerUserId));
    if (profile?.stripeAccountId && profile.status === "active") {
      connectAccountId = profile.stripeAccountId;
    }
  }

  const sessionParams: any = {
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${court?.name ?? "Kortas"} – rezervacija`,
            description: `${booking.date} · ${booking.startTime}–${booking.endTime}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { bookingId: String(bookingId) },
    customer_email: booking.customerEmail,
    locale: "lt",
  };

  // If court owner has Stripe Connect, route payment through their account
  if (connectAccountId) {
    const platformFeePercent = 5; // 5% platform fee
    const applicationFeeAmount = Math.round(amountCents * platformFeePercent / 100);
    sessionParams.payment_intent_data = {
      application_fee_amount: applicationFeeAmount,
      transfer_data: { destination: connectAccountId },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  await db.update(bookingsTable).set({ stripeSessionId: session.id }).where(eq(bookingsTable.id, bookingId));

  res.json(CreateCheckoutSessionResponse.parse({ sessionId: session.id, url: session.url! }));
});

// ─── Confirm payment after redirect ──────────────────────────────────────────
router.post("/payments/confirm", async (req, res): Promise<void> => {
  const parsed = ConfirmPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sessionId } = parsed.data;

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
      courtPhone: courtsTable.phone,
      courtImageUrl: courtsTable.imageUrl,
      ownerName: courtsTable.ownerName,
      ownerEmail: courtsTable.ownerEmail,
      instantBookingEnabled: courtsTable.instantBookingEnabled,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.stripeSessionId, sessionId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found for session" });
    return;
  }

  let stripePaymentIntentId: string | null = null;
  if (!sessionId.startsWith("mock_")) {
    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        res.status(402).json({ error: "Payment not completed" });
        return;
      }
      stripePaymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
    } catch (err) {
      logger.error({ err }, "Stripe retrieve session error");
    }
  }

  const newStatus = "confirmed";

  // Idempotent transition: only the first caller (race between Stripe webhook and
  // the eager success-page POST) actually flips status and runs side effects.
  // Subsequent calls return the already-confirmed booking without re-incrementing
  // counters or re-sending emails.
  const updated = await db
    .update(bookingsTable)
    .set({
      status: newStatus,
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
    })
    .where(and(
      eq(bookingsTable.stripeSessionId, sessionId),
      ne(bookingsTable.status, "confirmed"),
    ))
    .returning();

  if (updated.length === 0) {
    // Already confirmed by webhook (or another concurrent call). Return current state.
    res.json(ConfirmPaymentResponse.parse({
      ...rows[0].booking,
      totalPrice: Number(rows[0].booking.totalPrice),
      refundAmount: Number(rows[0].booking.refundAmount ?? 0),
      status: "confirmed",
      rentedItems: rows[0].booking.rentedItems ?? undefined,
    }));
    return;
  }

  const booking = updated[0];

  await db
    .update(courtsTable)
    .set({ totalBookings: sql`total_bookings + 1` })
    .where(eq(courtsTable.id, rows[0].booking.courtId));

  sendBookingConfirmationEmail({
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    courtName: rows[0].courtName ?? "Kortas",
    courtId: rows[0].courtId ?? 0,
    courtAddress: rows[0].courtAddress ?? "",
    courtCity: rows[0].courtCity ?? "",
    courtPhone: rows[0].courtPhone ?? undefined,
    courtImageUrl: rows[0].courtImageUrl ?? undefined,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    totalPrice: Number(booking.totalPrice),
    bookingId: booking.id,
    // Guest bookings have no Clerk session — pass the token so the email links to the
    // public /guest/booking/[token] management page.
    managementToken: booking.managementToken ?? undefined,
  }).catch(err => logger.error({ err }, "sendBookingConfirmationEmail failed"));

  if (rows[0].ownerEmail) {
    sendOwnerBookingNotificationEmail({
      ownerName: rows[0].ownerName ?? "Savininkas",
      ownerEmail: rows[0].ownerEmail,
      customerName: booking.customerName,
      courtName: rows[0].courtName ?? "Kortas",
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: Number(booking.totalPrice),
      bookingId: booking.id,
    }).catch(err => logger.error({ err }, "sendOwnerBookingNotificationEmail failed"));
  }

  res.json(ConfirmPaymentResponse.parse({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    // Postgres `numeric` returns a string; nullable text columns need to collapse to undefined for Zod `.optional()`.
    refundAmount: booking.refundAmount != null ? Number(booking.refundAmount) : undefined,
    stripeRefundId: booking.stripeRefundId ?? undefined,
    stripeSessionId: booking.stripeSessionId ?? undefined,
    stripePaymentIntentId: booking.stripePaymentIntentId ?? undefined,
    rentedItems: booking.rentedItems ?? undefined,
    courtName: rows[0].courtName ?? undefined,
  }));
});

// ─── Cancel pending booking (Stripe checkout abandoned) ──────────────────────
router.post("/payments/cancel-booking", async (req, res): Promise<void> => {
  const bookingId = Number(req.body?.bookingId);
  if (!bookingId || isNaN(bookingId)) {
    res.status(400).json({ error: "bookingId required" });
    return;
  }

  // Two authorization paths (mirrors confirm-free / create-checkout):
  // 1) Authenticated booker (existing behavior)
  // 2) Guest with matching managementToken
  const userId = getCurrentUserId(req);
  const providedToken =
    typeof (req.body as any)?.managementToken === "string"
      ? ((req.body as any).managementToken as string)
      : null;

  const rows = await db
    .select({ booking: bookingsTable })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const isBooker = !!userId && rows[0].booking.bookerUserId === userId;
  const isGuestWithToken =
    rows[0].booking.bookerUserId === null &&
    timingSafeEqualToken(providedToken, rows[0].booking.managementToken);
  if (!isBooker && !isGuestWithToken) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (rows[0].booking.status !== "pending") {
    res.json({ status: rows[0].booking.status });
    return;
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  logger.info({ bookingId, userId: userId ?? null, isGuest: userId == null }, "Booking cancelled after Stripe checkout abandonment");
  res.json({ status: updated.status });
});

// ─── Free booking confirm ─────────────────────────────────────────────────────
router.post("/payments/confirm-free", async (req, res): Promise<void> => {
  const bookingId = Number(req.body?.bookingId);
  if (!bookingId || isNaN(bookingId)) {
    res.status(400).json({ error: "bookingId required" });
    return;
  }

  // Two authorization paths:
  // 1) Authenticated session — booker / court-owner / admin
  // 2) Guest — booking has no booker and request supplies the matching managementToken
  const userId = getCurrentUserId(req);
  const providedToken =
    typeof (req.body as any)?.managementToken === "string"
      ? ((req.body as any).managementToken as string)
      : undefined;

  const rows = await db
    .select({
      booking: bookingsTable,
      courtName: courtsTable.name,
      courtId: courtsTable.id,
      courtAddress: courtsTable.address,
      courtCity: courtsTable.city,
      courtPhone: courtsTable.phone,
      courtImageUrl: courtsTable.imageUrl,
      courtOwnerUserId: courtsTable.ownerUserId,
      instantBookingEnabled: courtsTable.instantBookingEnabled,
    })
    .from(bookingsTable)
    .leftJoin(courtsTable, eq(bookingsTable.courtId, courtsTable.id))
    .where(eq(bookingsTable.id, bookingId));

  if (!rows[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  if (rows[0].booking.customerEmail?.length === 0 && rows[0].booking.customerName?.length === 0) {
    res.status(400).json({ error: "Invalid booking" });
    return;
  }

  // Enforce that this endpoint is only for genuinely free bookings
  if (Number(rows[0].booking.totalPrice) > 0) {
    res.status(403).json({ error: "Payment required for this booking" });
    return;
  }

  // Only the booker, the court owner, an admin, or a guest with the
  // matching managementToken may confirm.
  const isBooker = !!userId && rows[0].booking.bookerUserId === userId;
  const isCourtOwner = !!userId && rows[0].courtOwnerUserId === userId;
  const role = userId ? await getUserRole(userId) : null;
  const isGuestWithToken =
    rows[0].booking.bookerUserId === null &&
    timingSafeEqualToken(providedToken, rows[0].booking.managementToken);
  if (!isBooker && !isCourtOwner && role !== "admin" && !isGuestWithToken) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (rows[0].booking.status !== "pending") {
    res.status(409).json({ error: "Booking already processed" });
    return;
  }

  // All bookings are instant — no manual approval required
  const newStatus = "confirmed";

  const [booking] = await db
    .update(bookingsTable)
    .set({ status: newStatus })
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  {
    await db
      .update(courtsTable)
      .set({ totalBookings: sql`total_bookings + 1` })
      .where(eq(courtsTable.id, rows[0].booking.courtId));

    sendBookingConfirmationEmail({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      courtName: rows[0].courtName ?? "Kortas",
      courtId: rows[0].courtId ?? 0,
      courtAddress: rows[0].courtAddress ?? "",
      courtCity: rows[0].courtCity ?? "",
      courtPhone: rows[0].courtPhone ?? undefined,
      courtImageUrl: rows[0].courtImageUrl ?? undefined,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: Number(booking.totalPrice),
      bookingId: booking.id,
    }).catch(err => logger.error({ err }, "sendBookingConfirmationEmail failed"));
  }

  const freeCourtOwnerEmail = (await db.select({ ownerEmail: courtsTable.ownerEmail, ownerName: courtsTable.ownerName })
    .from(courtsTable).where(eq(courtsTable.id, rows[0].booking.courtId)))[0];
  if (freeCourtOwnerEmail?.ownerEmail) {
    sendOwnerBookingNotificationEmail({
      ownerName: freeCourtOwnerEmail.ownerName ?? "Savininkas",
      ownerEmail: freeCourtOwnerEmail.ownerEmail,
      customerName: booking.customerName,
      courtName: rows[0].courtName ?? "Kortas",
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: Number(booking.totalPrice),
      bookingId: booking.id,
    }).catch(err => logger.error({ err }, "sendOwnerBookingNotificationEmail (free) failed"));
  }

  res.json({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    refundAmount: booking.refundAmount != null ? Number(booking.refundAmount) : undefined,
    stripeRefundId: booking.stripeRefundId ?? undefined,
    stripeSessionId: booking.stripeSessionId ?? undefined,
    stripePaymentIntentId: booking.stripePaymentIntentId ?? undefined,
    rentedItems: booking.rentedItems ?? undefined,
    courtName: rows[0].courtName,
  });
});

// ─── Stripe Connect: create/get onboarding link for owner ────────────────────
router.post("/payments/connect/onboard", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { courtId, returnUrl, refreshUrl } = req.body;
  if (!courtId) {
    res.status(400).json({ error: "courtId required" });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, Number(courtId)));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  // Only the court owner or an admin may access payout onboarding
  if (court.ownerUserId !== userId) {
    const role = await getUserRole(userId);
    if (role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  let accountId = court.stripeConnectAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "LT",
      email: court.ownerEmail,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: court.name, url: `${process.env.SITE_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`}/courts/${court.id}` },
      metadata: { courtId: String(court.id), ownerUserId: court.ownerUserId ?? "" },
    });
    accountId = account.id;
    await db.update(courtsTable)
      .set({ stripeConnectAccountId: accountId, stripeConnectStatus: "pending" })
      .where(eq(courtsTable.id, Number(courtId)));
  }

  const base = process.env.SITE_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl ?? `${base}/owner?connect_refresh=1&courtId=${courtId}`,
    return_url: returnUrl ?? `${base}/owner?connect_success=1&courtId=${courtId}`,
    type: "account_onboarding",
  });

  res.json({ url: accountLink.url });
});

// ─── Stripe Connect: check account status ────────────────────────────────────
router.get("/payments/connect/status/:courtId", async (req, res): Promise<void> => {
  const courtId = Number(req.params.courtId);
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  if (!court.stripeConnectAccountId) {
    res.json({ status: "not_connected", accountId: null });
    return;
  }

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    res.json({ status: court.stripeConnectStatus ?? "not_connected", accountId: court.stripeConnectAccountId });
    return;
  }

  const account = await stripe.accounts.retrieve(court.stripeConnectAccountId);
  const newStatus = account.details_submitted ? "active" : "pending";

  if (newStatus !== court.stripeConnectStatus) {
    await db.update(courtsTable)
      .set({ stripeConnectStatus: newStatus })
      .where(eq(courtsTable.id, courtId));
  }

  res.json({ status: newStatus, accountId: court.stripeConnectAccountId, chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled });
});

// ─── Facility Stripe Connect: create/get onboarding link ─────────────────────
router.post("/facilities/:id/connect/onboard", requireAuth, async (req, res): Promise<void> => {
  const facilityId = Number(req.params.id);
  const userId = getCurrentUserId(req);
  const { returnUrl, refreshUrl } = req.body;

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, facilityId));
  if (!facility || facility.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  try {
    let accountId = facility.stripeConnectAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "LT",
        email: facility.email ?? undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: facility.name },
        metadata: { facilityId: String(facility.id), ownerUserId: facility.ownerUserId },
      });
      accountId = account.id;
      await db.update(facilitiesTable)
        .set({ stripeConnectAccountId: accountId, stripeConnectStatus: "pending" })
        .where(eq(facilitiesTable.id, facilityId));
    }

    const base = process.env.SITE_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl ?? `${base}/owner/facility/${facilityId}?connect_refresh=1`,
      return_url: returnUrl ?? `${base}/owner/facility/${facilityId}?connect_success=1`,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (err: any) {
    const stripeMessage: string = err?.message ?? "Stripe klaida";
    const isConnectNotEnabled = stripeMessage.includes("signed up for Connect");
    res.status(400).json({
      error: isConnectNotEnabled
        ? "Stripe Connect neprijungtas prie platformos sąskaitos. Administratorius turi aktyvuoti Connect šioje nuorodoje: https://dashboard.stripe.com/connect"
        : stripeMessage,
    });
  }
});

// ─── Facility Stripe Connect: check status ────────────────────────────────────
router.get("/facilities/:id/connect/status", requireAuth, async (req, res): Promise<void> => {
  const facilityId = Number(req.params.id);
  const userId = getCurrentUserId(req);

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, facilityId));
  if (!facility || facility.ownerUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!facility.stripeConnectAccountId) {
    res.json({ status: "not_connected", accountId: null });
    return;
  }

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    res.json({ status: facility.stripeConnectStatus ?? "not_connected", accountId: facility.stripeConnectAccountId });
    return;
  }

  const account = await stripe.accounts.retrieve(facility.stripeConnectAccountId);
  const newStatus = account.details_submitted ? "active" : "pending";

  if (newStatus !== facility.stripeConnectStatus) {
    await db.update(facilitiesTable)
      .set({ stripeConnectStatus: newStatus })
      .where(eq(facilitiesTable.id, facilityId));
  }

  res.json({
    status: newStatus,
    accountId: facility.stripeConnectAccountId,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });
});

export default router;
