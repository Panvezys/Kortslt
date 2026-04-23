import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, courtPhotosTable, courtsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { isOwner } from "../lib/auth";

const uploadDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = IMAGE_MIME_TO_EXT[file.mimetype] ?? ".jpg";
    const uniqueName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in IMAGE_MIME_TO_EXT) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router: IRouter = Router();

async function getCourt(courtId: number): Promise<typeof courtsTable.$inferSelect | null> {
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  return court ?? null;
}

/** Middleware that verifies the caller is authenticated and owns the court (or is admin).
 *  Must run BEFORE multer so that rejected requests never write files to disk. */
async function requireCourtOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const courtId = parseInt(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const court = await getCourt(courtId);
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  if (!(await isOwner(req, court.ownerUserId))) { res.status(403).json({ error: "Forbidden" }); return; }

  next();
}

router.get("/courts/:id/photos", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }
  try {
    const court = await getCourt(courtId);
    if (!court) { res.status(404).json({ error: "Court not found" }); return; }

    const isPublic = court.status === "approved" || court.status === "active";
    if (!isPublic) {
      // Non-public courts: only the owner or an admin may view photos.
      if (!(await isOwner(req, court.ownerUserId))) {
        res.status(404).json({ error: "Court not found" });
        return;
      }
    }

    const photos = await db.select().from(courtPhotosTable)
      .where(eq(courtPhotosTable.courtId, courtId))
      .orderBy(asc(courtPhotosTable.displayOrder), asc(courtPhotosTable.createdAt));
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

router.post(
  "/courts/:id/photos",
  requireCourtOwnership,
  uploadPhoto.single("image"),
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const courtId = parseInt(req.params.id);

    if (!req.file) { res.status(400).json({ error: "No image provided" }); return; }

    const url = `courts/uploads/${req.file.filename}`;
    const caption = typeof req.body.caption === "string" ? req.body.caption.trim() || null : null;

    try {
      const existing = await db.select({ displayOrder: courtPhotosTable.displayOrder })
        .from(courtPhotosTable).where(eq(courtPhotosTable.courtId, courtId))
        .orderBy(asc(courtPhotosTable.displayOrder));
      const nextOrder = existing.length > 0 ? (existing[existing.length - 1]?.displayOrder ?? 0) + 1 : 0;

      const [photo] = await db.insert(courtPhotosTable).values({
        courtId,
        url,
        caption,
        displayOrder: nextOrder,
        uploadedBy: userId,
      }).returning();

      res.json(photo);
    } catch (e) {
      // Clean up the uploaded file if the DB insert fails.
      const filePath = path.resolve(uploadDir, req.file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: "Failed to save photo" });
    }
  }
);

router.patch("/courts/:id/photos/:photoId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const courtId = parseInt(req.params.id);
  const photoId = parseInt(req.params.photoId);
  if (isNaN(courtId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const court = await getCourt(courtId);
  if (!(await isOwner(req, court?.ownerUserId))) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: { caption?: string | null; displayOrder?: number } = {};
  if (typeof req.body.caption !== "undefined") updates.caption = req.body.caption || null;
  if (typeof req.body.displayOrder === "number") updates.displayOrder = req.body.displayOrder;

  const [updated] = await db.update(courtPhotosTable)
    .set(updates)
    .where(and(eq(courtPhotosTable.id, photoId), eq(courtPhotosTable.courtId, courtId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Photo not found" }); return; }
  res.json(updated);
});

router.delete("/courts/:id/photos/:photoId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const courtId = parseInt(req.params.id);
  const photoId = parseInt(req.params.photoId);
  if (isNaN(courtId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const court = await getCourt(courtId);
  if (!(await isOwner(req, court?.ownerUserId))) { res.status(403).json({ error: "Forbidden" }); return; }

  const [photo] = await db.select().from(courtPhotosTable)
    .where(and(eq(courtPhotosTable.id, photoId), eq(courtPhotosTable.courtId, courtId)));
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  const filePath = path.resolve(process.cwd(), "../courtbook/public", photo.url);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await db.delete(courtPhotosTable)
    .where(and(eq(courtPhotosTable.id, photoId), eq(courtPhotosTable.courtId, courtId)));
  res.json({ ok: true });
});

export default router;
