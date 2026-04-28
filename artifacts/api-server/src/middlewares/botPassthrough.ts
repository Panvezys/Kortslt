/**
 * Bot / Scraper Passthrough Middleware
 *
 * Ensures that known social-media scrapers and search-engine crawlers can
 * always fetch public SPA pages (e.g. /delete-account, /privacy) without
 * being blocked by Clerk auth processing.
 *
 * Mount this BEFORE clerkMiddleware() in app.ts.
 *
 * Why it is needed
 * ----------------
 * Clerk's middleware (in production mode) can return a 403 when it receives
 * a request that carries unexpected or malformed auth-related headers, which
 * some bot user-agents produce. By detecting known bots early and serving
 * index.html directly from the static dist folder, we bypass Clerk entirely
 * for non-API GET requests from these clients.
 *
 * What is matched
 * ---------------
 * The list covers Facebook's Open Graph scraper, Google, Bing, Twitter/X,
 * LinkedIn, WhatsApp, Slack, and Telegram — all common "link preview" bots.
 */

import type { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";

const BOT_UA_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "googlebot",
  "bingbot",
  "slackbot",
  "whatsapp",
  "telegrambot",
  "applebot",
  "duckduckbot",
];

/**
 * Returns the middleware function.
 * @param frontendDist Absolute path to the Vite build output directory.
 */
export function botPassthroughMiddleware(frontendDist: string) {
  const indexHtmlPath = path.join(frontendDist, "index.html");

  return function botPassthrough(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const ua = (req.headers["user-agent"] ?? "").toLowerCase();
    const isKnownBot = BOT_UA_PATTERNS.some((p) => ua.includes(p));

    // Only activate for known bots
    if (!isKnownBot) { next(); return; }

    // API routes should always go through normal processing even for bots
    if (req.path.startsWith("/api/")) { next(); return; }

    // Only intercept GET/HEAD — leave POST/etc. alone
    if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }

    // Serve index.html directly, bypassing Clerk and any other middleware
    if (fs.existsSync(indexHtmlPath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      // Explicitly allow indexing — do NOT add noindex for these pages
      res.setHeader("X-Robots-Tag", "all");
      res.sendFile(indexHtmlPath);
      return;
    }

    // Static dist not available (dev mode) — fall through normally
    next();
  };
}
