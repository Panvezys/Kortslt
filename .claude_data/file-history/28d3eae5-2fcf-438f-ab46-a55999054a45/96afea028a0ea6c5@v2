import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { getCurrentUserId, requireCoach } from "../lib/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { isStripeAccountReady } from "../lib/facility-status";

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

// ─── POST /api/coaches/stripe/onboard ────────────────────────────────────────
// Coach Stripe Connect onboarding. State is stored on user_profiles (same
// table as facility owners) so a user who acts as both owner and coach has
// one Stripe account. The return URL lands on /coach/dashboard so the
// coach-side UI can re-check status.
router.post("/coaches/stripe/onboard", requireCoach, async (req, res): Promise<void> => {
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
      res.json({ url: loginLink.url, accountId, status: "active" });
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
        metadata: { userId, role: "coach" },
      });
      accountId = account.id as string;
      await db
        .update(userProfilesTable)
        .set({ stripeAccountId: accountId, stripeAccountStatus: "pending" })
        .where(eq(userProfilesTable.userId, userId));
    }

    const base = getAppBaseUrl();
    const returnUrl = `${base}/coach/dashboard?stripe_return=success`;
    const refreshUrl = `${base}/coach/dashboard?stripe_return=refresh`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url, accountId, status: "pending" });
  } catch (err: any) {
    const stripeMessage: string = err?.message ?? "Stripe klaida";
    const isConnectNotEnabled = stripeMessage.includes("signed up for Connect");
    logger.error({ err }, "Coach Stripe Connect onboarding failed");
    res.status(400).json({
      error: isConnectNotEnabled
        ? "Stripe Connect neaktyvuotas platformos sąskaitoje."
        : stripeMessage,
    });
  }
});

// ─── GET /api/coaches/stripe/return ──────────────────────────────────────────
// Hit by the frontend after Stripe's return_url redirect. Re-checks the
// account against Stripe and syncs user_profiles. Frontend treats `status`
// === "active" as success and hides the onboarding banner.
router.get("/coaches/stripe/return", requireCoach, async (req, res): Promise<void> => {
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
    const newStatus = isStripeAccountReady(account) ? "active" : "pending";
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
      disabledReason: account.requirements?.disabled_reason ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Stripe accounts.retrieve failed (coach)");
    res.json({
      status: profile.stripeAccountStatus ?? "pending",
      accountId: profile.stripeAccountId,
    });
  }
});

export default router;
