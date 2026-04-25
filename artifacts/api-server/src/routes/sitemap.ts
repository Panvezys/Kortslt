import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  courtsTable,
  coachesTable,
  trainersTable,
  tournamentsTable,
  gamesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getSiteOrigin(req: Request): string {
  const fromEnv =
    process.env.SITE_URL ||
    process.env.VITE_APP_URL ||
    (process.env.REPLIT_DOMAINS?.split(",")[0]
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
  return `${proto}://${req.get("host")}`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

type UrlEntry = {
  loc: string;
  lastmod?: Date | null;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

const STATIC_ROUTES: Array<Pick<UrlEntry, "loc" | "changefreq" | "priority">> = [
  { loc: "/",               changefreq: "daily",   priority: 1.0 },
  { loc: "/courts",         changefreq: "daily",   priority: 0.9 },
  { loc: "/coaches",        changefreq: "daily",   priority: 0.8 },
  { loc: "/trainers",       changefreq: "weekly",  priority: 0.7 },
  { loc: "/tournaments",    changefreq: "daily",   priority: 0.7 },
  { loc: "/games",          changefreq: "daily",   priority: 0.7 },
  { loc: "/games/guide",    changefreq: "monthly", priority: 0.5 },
  { loc: "/owners",         changefreq: "monthly", priority: 0.6 },
  { loc: "/become-owner",   changefreq: "monthly", priority: 0.6 },
  { loc: "/become-coach",   changefreq: "monthly", priority: 0.6 },
  { loc: "/list-your-court",changefreq: "monthly", priority: 0.6 },
  { loc: "/faq",            changefreq: "monthly", priority: 0.5 },
  { loc: "/ranks",          changefreq: "monthly", priority: 0.4 },
  { loc: "/contact",        changefreq: "yearly",  priority: 0.3 },
  { loc: "/privacy",        changefreq: "yearly",  priority: 0.2 },
  { loc: "/terms",          changefreq: "yearly",  priority: 0.2 },
];

function renderSitemap(origin: string, entries: UrlEntry[]): string {
  const body = entries
    .map((e) => {
      const parts: string[] = [`<loc>${escapeXml(`${origin}${e.loc}`)}</loc>`];
      if (e.lastmod instanceof Date && !Number.isNaN(e.lastmod.getTime())) {
        parts.push(`<lastmod>${e.lastmod.toISOString()}</lastmod>`);
      }
      if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
      if (typeof e.priority === "number") parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

router.get("/sitemap.xml", async (req: Request, res: Response): Promise<void> => {
  try {
    const origin = getSiteOrigin(req);

    const [courts, coaches, trainers, tournaments, games] = await Promise.all([
      db
        .select({ id: courtsTable.id, createdAt: courtsTable.createdAt })
        .from(courtsTable)
        .where(eq(courtsTable.status, "approved")),
      db
        .select({ id: coachesTable.id })
        .from(coachesTable)
        .where(eq(coachesTable.status, "approved")),
      db
        .select({ id: trainersTable.id, courtStatus: courtsTable.status })
        .from(trainersTable)
        .innerJoin(courtsTable, eq(trainersTable.courtId, courtsTable.id))
        .where(eq(courtsTable.status, "approved")),
      db
        .select({ id: tournamentsTable.id, status: tournamentsTable.status })
        .from(tournamentsTable),
      db
        .select({ id: gamesTable.id, status: gamesTable.status })
        .from(gamesTable),
    ]);

    const entries: UrlEntry[] = [
      ...STATIC_ROUTES,
      ...courts.map((c) => ({
        loc: `/courts/${c.id}`,
        lastmod: c.createdAt ?? null,
        changefreq: "weekly" as const,
        priority: 0.8,
      })),
      ...coaches.map((c) => ({
        loc: `/coach/${c.id}`,
        changefreq: "weekly" as const,
        priority: 0.6,
      })),
      ...trainers.map((t) => ({
        loc: `/trainers/${t.id}`,
        changefreq: "weekly" as const,
        priority: 0.5,
      })),
      ...tournaments
        .filter((t) => t.status && t.status !== "draft" && t.status !== "cancelled")
        .map((t) => ({
          loc: `/tournaments/${t.id}`,
          changefreq: "daily" as const,
          priority: 0.6,
        })),
      ...games
        .filter((g) => g.status === "open")
        .map((g) => ({
          loc: `/games/${g.id}`,
          changefreq: "daily" as const,
          priority: 0.4,
        })),
    ];

    res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour
    res.type("application/xml").send(renderSitemap(origin, entries));
  } catch (err) {
    // Sitemap is registered before pinoHttp, so req.log may not exist.
    // Always log to stderr so failures surface in workflow logs.
    console.error("[sitemap] generation failed:", err);
    const origin = getSiteOrigin(req);
    res.status(200).type("application/xml").send(renderSitemap(origin, STATIC_ROUTES));
  }
});

export default router;
