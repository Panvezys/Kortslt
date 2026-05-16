import { sweepStalePendingGames, sweepAutoConfirmResults } from "../routes/games";
import { sweepAbandonedPendingBookings } from "../routes/bookings";
import { logger } from "./logger";

const TICK_INTERVAL_MS = 60 * 1000;

export function startCron(): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const [staleCount, autoCount, abandonedBookingCount] = await Promise.all([
        sweepStalePendingGames(),
        sweepAutoConfirmResults(),
        sweepAbandonedPendingBookings(),
      ]);
      if (staleCount > 0 || autoCount > 0 || abandonedBookingCount > 0) {
        logger.info({ staleCount, autoCount, abandonedBookingCount }, "cron: swept");
      }
    } catch (err) {
      logger.error({ err }, "cron tick failed");
    } finally {
      running = false;
    }
  };
  setInterval(tick, TICK_INTERVAL_MS);
  setTimeout(tick, 5000);
  logger.info({ intervalMs: TICK_INTERVAL_MS }, "cron started");
}
