import net from "net";
import app from "./app";
import { logger } from "./lib/logger";
import { startCron } from "./lib/cron";

// Fail fast if the Clerk secret key is missing — every authenticated request
// will return 401 without it, and the error is completely silent otherwise.
if (!process.env.CLERK_SECRET_KEY) {
  logger.error(
    "CLERK_SECRET_KEY is not set — all authenticated API requests will return 401. " +
    "Set this to the sk_live_... key from the Clerk dashboard.",
  );
}

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn(
    "STRIPE_SECRET_KEY is not set — Stripe routes will return 503 until configured.",
  );
}

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
    startCron();
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
