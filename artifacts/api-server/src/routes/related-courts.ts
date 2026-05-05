import { Router } from "express";
import { eq, ne, and } from "drizzle-orm";
import { db, courtsTable, facilitiesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/courts/:id/related — other active courts from the same facility
router.get("/courts/:id/related", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) {
    res.status(400).json({ error: "Invalid court id" });
    return;
  }

  try {
    const [source] = await db
      .select({ facilityId: courtsTable.facilityId })
      .from(courtsTable)
      .where(eq(courtsTable.id, courtId));

    if (!source) {
      res.status(404).json({ error: "Court not found" });
      return;
    }

    const rows = await db
      .select({
        id: courtsTable.id,
        name: courtsTable.name,
        type: courtsTable.type,
        surface: courtsTable.surface,
        pricePerHour: courtsTable.pricePerHour,
        imageUrl: courtsTable.imageUrl,
        isIndoor: courtsTable.isIndoor,
        rating: courtsTable.rating,
        facilityId: courtsTable.facilityId,
        address: facilitiesTable.address,
        city: facilitiesTable.city,
      })
      .from(courtsTable)
      .innerJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
      .where(
        and(
          eq(courtsTable.facilityId, source.facilityId),
          ne(courtsTable.id, courtId),
          eq(courtsTable.status, "active"),
        ),
      )
      .limit(8);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "related-courts failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
