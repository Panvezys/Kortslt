import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/**
 * Returns a singleton Stripe client initialized from STRIPE_SECRET_KEY.
 * Throws when the secret is missing — callers should handle this and
 * return 503 / fall through to a mock path as appropriate.
 */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // "Stripe not configured" prefix is load-bearing: mock-checkout fallback
    // guards in payments.ts / split-payments.ts match on this substring.
    throw new Error(
      "Stripe not configured: STRIPE_SECRET_KEY is not set. Add it in Replit Secrets to enable Stripe.",
    );
  }

  cachedClient = new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil" as any,
    appInfo: { name: "korts.lt", version: "1.0.0" },
  });
  return cachedClient;
}

/** Async wrapper kept for backward compatibility with existing callers. */
export async function getUncachableStripeClient(): Promise<Stripe> {
  return getStripe();
}

/** Returns the publishable key for the frontend. */
export async function getStripePublishableKey(): Promise<string> {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY is not set. Add it in Replit Secrets.",
    );
  }
  return key;
}

export async function getStripeSecretKey(): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe not configured: STRIPE_SECRET_KEY is not set.");
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Get it from your Stripe webhook endpoint settings.",
    );
  }
  return secret;
}
