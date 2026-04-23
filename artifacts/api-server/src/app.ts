import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

const courtsDir = path.resolve(process.cwd(), "../courtbook/public/courts");
const uploadsDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");

// WebP content-negotiation: if the browser sends Accept: image/webp and a
// same-named .webp file exists, transparently serve that instead of the
// original PNG/JPG — no DB changes required, ~90% smaller on average.
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
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Vary", "Accept");
      res.sendFile(webpPath);
      return;
    }
    next();
  };
}

app.use("/courts/uploads", webpNegotiation(uploadsDir));
app.use("/courts/uploads", express.static(uploadsDir, {
  maxAge: "1d",
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Vary", "Accept");
  },
}));

// Also serve the static court images (the seeded /courts/*.png files) with WebP negotiation
app.use("/courts", webpNegotiation(courtsDir));
app.use("/courts", express.static(courtsDir, {
  maxAge: "1d",
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Accept");
  },
}));

// Serve the Vite-built frontend in production (same process, no separate static server needed)
const frontendDist = path.resolve(process.cwd(), "../courtbook/dist/public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: "1d", index: false }));
}

app.get("/sitemap.xml", (_req, res) => {
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
  }
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
        return {
          statusCode: res.statusCode,
        };
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
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
