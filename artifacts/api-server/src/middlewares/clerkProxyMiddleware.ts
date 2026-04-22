/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";

export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Derive the Clerk FAPI base URL from the publishable key.
 * The third segment of pk_test_BASE64 / pk_live_BASE64 decodes to the FAPI host.
 */
function getClerkFapiUrl(): string {
  const pubKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (pubKey) {
    const parts = pubKey.split("_");
    if (parts.length >= 3) {
      try {
        const decoded = Buffer.from(parts[2], "base64").toString("utf8").replace(/\$$/, "");
        if (decoded.includes(".")) return `https://${decoded}`;
      } catch {
        // fall through
      }
    }
  }
  return "https://frontend-api.clerk.dev";
}

export function clerkProxyMiddleware(): RequestHandler {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  const CLERK_FAPI = getClerkFapiUrl();

  // Strip Domain= from upstream Set-Cookie headers so cookies (notably the
  // dev-instance __clerk_db_jwt) are stored against OUR origin, not Clerk's
  // accounts domain. Without this, follow-up proxied requests never include
  // the dev-browser JWT and Clerk FAPI returns 401 forever.
  function rewriteSetCookies(setCookieHeader: string | string[] | undefined): string[] | undefined {
    if (!setCookieHeader) return undefined;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return cookies.map((cookie) =>
      cookie
        .split(/;\s*/)
        .filter((part) => !/^domain=/i.test(part))
        .join("; "),
    );
  }

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers.host || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
      proxyRes: (proxyRes) => {
        const rewritten = rewriteSetCookies(proxyRes.headers["set-cookie"]);
        if (rewritten) {
          proxyRes.headers["set-cookie"] = rewritten;
        }
      },
    },
  }) as RequestHandler;
}
