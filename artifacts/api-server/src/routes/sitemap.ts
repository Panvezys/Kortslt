import { Router, type IRouter } from "express";
import { db, courtsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const origin = `${req.protocol}://${req.get("host")}`;
  const courts = await db
    .select({ id: courtsTable.id })
    .from(courtsTable)
    .where(eq(courtsTable.status, "approved"));

  const urls = [
    `${origin}/`,
    ...courts.map((court) => `${origin}/courts/${court.id}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.map((url) => `<url><loc>${url}</loc></url>`).join("") +
    `</urlset>`;

  res.type("application/xml").send(xml);
});

export default router;