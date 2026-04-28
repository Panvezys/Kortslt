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

/**
 * Robust regex covering all known Facebook crawlers + other major
 * social-media / search-engine scrapers.
 *
 * Facebook variants explicitly matched:
 *   - facebookexternalhit  (Open Graph link previews)
 *   - Facebot              (legacy Facebook crawler)
 *   - facebookcatalog      (Facebook commerce catalog scraper)
 *   - facebookplatform     (Facebook Platform crawler)
 *
 * The pattern is case-insensitive and uses substring matching so future
 * variants like "facebookexternalhit/1.1" or "FacebookBot/1.0" still match.
 */
const BOT_UA_REGEX =
  /(facebookexternalhit|facebookcatalog|facebookplatform|facebookbot|facebot|twitterbot|linkedinbot|googlebot|bingbot|slackbot|whatsapp|telegrambot|applebot|duckduckbot|discordbot|pinterestbot|redditbot)/i;

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
    const ua = req.headers["user-agent"] ?? "";
    const isKnownBot = BOT_UA_REGEX.test(ua);

    // Only activate for known bots
    if (!isKnownBot) { next(); return; }

    // API routes should always go through normal processing even for bots
    if (req.path.startsWith("/api/")) { next(); return; }

    // Only intercept GET/HEAD — leave POST/etc. alone
    if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }

    // Always force a fresh response for crawlers so any prior cached 403
    // (from Replit / Google Frontend / any upstream CDN) is invalidated.
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    // Vary on User-Agent so caches keep the bot response separate from the
    // normal browser response.
    res.setHeader("Vary", "User-Agent");
    // Explicitly allow indexing — do NOT add noindex for these pages.
    res.setHeader("X-Robots-Tag", "all");

    // Serve index.html directly, bypassing Clerk and any other middleware
    if (fs.existsSync(indexHtmlPath)) {
      res.status(200).sendFile(indexHtmlPath);
      return;
    }

    // Static dist not available (dev mode) — fall through normally
    next();
  };
}
