import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import net from "net";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Wait for the port to become free before binding (handles rapid restarts where
// the previous process hasn't released the socket yet).
async function waitForPort(p: number, maxWaitMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const free = await new Promise<boolean>((resolve) => {
      const tester = net.createConnection(p, "127.0.0.1");
      tester.once("connect", () => { tester.destroy(); resolve(false); });
      tester.once("error", () => resolve(true));
    });
    if (free) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  logger.warn({ port: p }, "Port still in use after wait — proceeding anyway");
}
await waitForPort(port);

function startListening(attemptsLeft: number) {
  const server = app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      logger.warn({ port, attemptsLeft }, "Port in use, retrying in 2s...");
      setTimeout(() => startListening(attemptsLeft - 1), 2000);
    } else {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
  });
}
startListening(5);

// Initialize Stripe webhook sync in the background — does not block serving requests
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }
  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");
  } catch (err) {
    logger.warn({ err }, "Stripe schema migration failed — skipping webhook sync");
    return;
  }

  try {
    const stripeSync = await getStripeSync();
    const webhookBaseUrl = process.env.SITE_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err: any) => logger.warn({ err }, "Stripe backfill warning"));
  } catch (err) {
    logger.warn({ err }, "Stripe webhook/sync setup skipped — direct payments still active");
  }
}

// Fire and forget — Stripe sync failure never takes down the server
initStripe().catch((err) => logger.warn({ err }, "Stripe init warning"));
