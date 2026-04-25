import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { getCurrentUserId, requireAuth } from "../lib/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getAppBaseUrl(): string {
  return (
    process.env.VITE_APP_URL ||
    process.env.SITE_URL ||
    `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "korts.lt"}`
  );
}

async function getOrCreateProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(userProfilesTable)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [reread] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  return reread;
}

// ─── POST /api/stripe/connect — create Express account + onboarding link ─────
router.post("/stripe/connect", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    logger.error({ err }, "Stripe not configured");
    res.status(503).json({ error: "Stripe nesukonfigūruotas." });
    return;
  }

  try {
    const profile = await getOrCreateProfile(userId);
    let accountId = profile?.stripeAccountId ?? null;

    if (accountId && profile?.stripeAccountStatus === "active") {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      res.json({ url: loginLink.url, accountId });
      return;
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "LT",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId },
      });
      accountId = account.id as string;
      await db
        .update(userProfilesTable)
        .set({ stripeAccountId: accountId, stripeAccountStatus: "pending" })
        .where(eq(userProfilesTable.userId, userId));
    }

    const base = getAppBaseUrl();
    const returnUrl = `${base}/owner?stripe_connect=success`;
    const refreshUrl = `${base}/owner?stripe_connect=refresh`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url, accountId });
  } catch (err: any) {
    const stripeMessage: string = err?.message ?? "Stripe klaida";
    const isConnectNotEnabled = stripeMessage.includes("signed up for Connect");
    logger.error({ err }, "Stripe Connect onboarding failed");
    res.status(400).json({
      error: isConnectNotEnabled
        ? "Stripe Connect neaktyvuotas platformos sąskaitoje."
        : stripeMessage,
    });
  }
});

// ─── GET /api/stripe/connect/status — check current account status ───────────
router.get("/stripe/connect/status", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const profile = await getOrCreateProfile(userId);

  if (!profile?.stripeAccountId) {
    res.json({ status: "not_connected", accountId: null });
    return;
  }

  let stripe: any;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    res.json({
      status: profile.stripeAccountStatus ?? "not_connected",
      accountId: profile.stripeAccountId,
    });
    return;
  }

  try {
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);
    const newStatus = account.details_submitted ? "active" : "pending";
    if (newStatus !== profile.stripeAccountStatus) {
      await db
        .update(userProfilesTable)
        .set({ stripeAccountStatus: newStatus })
        .where(eq(userProfilesTable.userId, userId));
    }
    res.json({
      status: newStatus,
      accountId: profile.stripeAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (err) {
    logger.error({ err }, "Stripe accounts.retrieve failed");
    res.json({
      status: profile.stripeAccountStatus ?? "pending",
      accountId: profile.stripeAccountId,
    });
  }
});

export default router;
