import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import pinoHttp from "pino-http";
import compression from "compression";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

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

app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
  res.type("application/xml");
  res.sendFile(path.resolve(process.cwd(), "../courtbook/public/sitemap.xml"));
});

// ─── Stripe webhook — must be registered BEFORE express.json() ───────────────
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
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

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
