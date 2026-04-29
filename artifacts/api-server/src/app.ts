import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import pinoHttp from "pino-http";
import compression from "compression";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { botPassthroughMiddleware } from "./middlewares/botPassthrough";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleStripeWebhook } from "./routes/stripe-webhook";
import sitemapRouter from "./routes/sitemap";

const app: Express = express();

// ─── Gzip compression ─────────────────────────────────────────────────────────
// Compresses JS, CSS, JSON, HTML, SVG responses on the fly. Images and PDFs
// are skipped (already compressed). In production, Brotli is handled at the
// CDN/proxy layer (Google Frontend in Replit deployments).
app.use(
  compression({
    level: 6,       // balanced speed vs ratio
    threshold: 1024, // skip responses smaller than 1 KB
  }),
);
// ─────────────────────────────────────────────────────────────────────────────

const courtsDir = path.resolve(process.cwd(), "../courtbook/public/courts");
const uploadsDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");

// ─── WebP content-negotiation ─────────────────────────────────────────────────
// If the browser sends Accept: image/webp and a .webp sibling exists, serve
// that instead — no DB changes required, ~90% smaller on average.
function webpNegotiation(baseDir: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const accepts = req.headers["accept"] ?? "";
    if (!accepts.includes("image/webp")) return next();
    const ext = path.extname(req.path).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".gif"].includes(ext)) return next();
    const webpPath = path.join(baseDir, req.path.replace(/\.[^.]+$/, ".webp"));
    if (fs.existsSync(webpPath)) {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Cache-Control", "public, max-age=604800"); // 1 week
      res.setHeader("Vary", "Accept");
      res.sendFile(webpPath);
      return;
    }
    next();
  };
}

// User-uploaded images — 1 week cache
app.use("/courts/uploads", webpNegotiation(uploadsDir));
app.use("/courts/uploads", express.static(uploadsDir, {
  maxAge: "7d",
  immutable: false,
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Vary", "Accept");
  },
}));

// Seeded court images — 1 week cache
app.use("/courts", webpNegotiation(courtsDir));
app.use("/courts", express.static(courtsDir, {
  maxAge: "7d",
  immutable: false,
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Accept");
  },
}));

// ─── Sitemap (must be BEFORE static middleware so it takes precedence over
// the stale /sitemap.xml file copied into dist/public by Vite) ───────────────
// Dynamically generated XML sitemap for Google Search Console / Bing.
// Lists all public, indexable routes plus approved courts/coaches/
// tournaments/games. See routes/sitemap.ts for details.
app.use(sitemapRouter);

// ─── Frontend static assets ───────────────────────────────────────────────────
const frontendDist = path.resolve(process.cwd(), "../courtbook/dist/public");
if (fs.existsSync(frontendDist)) {
  // /assets/ contains Vite-hashed bundles (e.g. index-BfG3kLx2.js) — these
  // never change URL when content changes, so they can be cached forever.
  const assetsDir = path.join(frontendDist, "assets");
  if (fs.existsSync(assetsDir)) {
    app.use("/assets", express.static(assetsDir, {
      maxAge: "365d",   // 1 year
      immutable: true,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }));
  }

  // Icons, fonts and other public files — 1 week
  app.use(express.static(frontendDist, {
    maxAge: "7d",
    index: false,          // don't auto-serve index.html here; SPA fallback below
    setHeaders(res, filePath) {
      // HTML files must never be cached — they reference the hashed assets
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return;
      }
      // SVG/PNG/WebP icons already handled or served with 1 week default
    },
  }));
}

// ─── Stripe webhook — must be registered BEFORE express.json() ───────────────
// Standard Stripe webhook handler using stripe.webhooks.constructEvent.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ─── Bot / Scraper passthrough ────────────────────────────────────────────────
// Must be mounted BEFORE clerkMiddleware() so that social-media scrapers
// (facebookexternalhit, Facebot, Twitterbot, Googlebot, …) are served the SPA
// index.html directly without going through Clerk auth processing.
// This prevents 403s on public pages like /delete-account and /privacy when
// Facebook's Open Graph scraper or similar tools fetch them.
//
// NOTE: No Helmet or security middleware is registered in this server that
// would block non-browser user-agents. The only security-related headers are
// the per-route Cache-Control / X-Content-Type-Options set on static-asset
// routes above, which are harmless to crawlers.
if (fs.existsSync(frontendDist)) {
  app.use(botPassthroughMiddleware(frontendDist));
}
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Public routes ────────────────────────────────────────────────────────────
// In @clerk/express, clerkMiddleware() does NOT block unauthenticated requests
// by default — access control is enforced per-route via requireAuth().
// The list below is intentionally documented here as the canonical source of
// truth for which routes are public, even though Clerk in Express does not
// consume a "publicRoutes" array the way Next.js middleware does.
//
// Publicly accessible (no authentication required):
//   / /privacy /delete-account /terms /faq /contact
//   /courts/** /coaches/** /tournaments/** /games/**
//   /ranks /owners /list-your-court /become-coach /become-owner
//   /sitemap.xml /robots.txt /api/health /api/courts/** /api/stats/**
app.use(clerkMiddleware());

app.use("/api", router);

// SPA fallback: serve index.html for any non-API route so client-side routing works
if (fs.existsSync(frontendDist)) {
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
