import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, coachPhotosTable, coachesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { getUserRole, requireAuth } from "../lib/auth";

const uploadDir = path.resolve(process.cwd(), "../courtbook/public/coaches/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg":  ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
};

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = IMAGE_MIME_TO_EXT[file.mimetype] ?? ".jpg";
    cb(null, `coach_photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
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

/** Verify the caller owns this coach profile (or is admin). Must run BEFORE multer. */
async function requireCoachOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const coachId = parseInt(String(req.params.id), 10);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid coach id" }); return; }

  const role = await getUserRole(userId);
  if (role === "admin") { next(); return; }

  const [coach] = await db.select({ userId: coachesTable.userId })
    .from(coachesTable).where(eq(coachesTable.id, coachId));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }
  if (coach.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  next();
}

const router: IRouter = Router();

// POST /coaches/me/photo — upload or replace the coach's profile avatar
router.post(
  "/coaches/me/photo",
  requireAuth,
  uploadPhoto.single("image"),
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!req.file) { res.status(400).json({ error: "No image provided" }); return; }

    const [coach] = await db
      .select({ id: coachesTable.id, photoUrl: coachesTable.photoUrl })
      .from(coachesTable)
      .where(eq(coachesTable.userId, userId!));

    if (!coach) {
      fs.unlinkSync(path.join(uploadDir, req.file.filename));
      res.status(404).json({ error: "Coach profile not found" });
      return;
    }

    // Clean up the previous upload if it was stored here (not an external URL)
    if (coach.photoUrl?.startsWith("coaches/uploads/")) {
      const oldPath = path.resolve(process.cwd(), "../courtbook/public", coach.photoUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const photoUrl = `coaches/uploads/${req.file.filename}`;
    await db.update(coachesTable).set({ photoUrl }).where(eq(coachesTable.id, coach.id));

    res.json({ photoUrl });
  }
);

// POST /coaches/:id/photos — upload a gallery photo
router.post(
  "/coaches/:id/photos",
  requireCoachOwnership,
  uploadPhoto.single("image"),
  async (req, res): Promise<void> => {
    const coachId = parseInt(String(req.params.id), 10);
    if (!req.file) { res.status(400).json({ error: "No image provided" }); return; }

    const url = `coaches/uploads/${req.file.filename}`;
    const caption = typeof req.body.caption === "string" ? req.body.caption.trim() || null : null;

    const MAX_GALLERY_PHOTOS = 10;
    try {
      const existing = await db
        .select({ displayOrder: coachPhotosTable.displayOrder })
        .from(coachPhotosTable)
        .where(eq(coachPhotosTable.coachId, coachId))
        .orderBy(asc(coachPhotosTable.displayOrder));

      if (existing.length >= MAX_GALLERY_PHOTOS) {
        const filePath = path.join(uploadDir, req.file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(422).json({ error: `Galima įkelti daugiausiai ${MAX_GALLERY_PHOTOS} nuotraukų` });
        return;
      }

      const nextOrder = existing.length > 0
        ? (existing[existing.length - 1]?.displayOrder ?? 0) + 1
        : 0;

      const [photo] = await db.insert(coachPhotosTable).values({
        coachId,
        url,
        caption,
        displayOrder: nextOrder,
      }).returning();

      res.status(201).json(photo);
    } catch {
      const filePath = path.join(uploadDir, req.file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: "Failed to save photo" });
    }
  }
);

// DELETE /coaches/:id/photos/:photoId — remove a gallery photo
router.delete("/coaches/:id/photos/:photoId", requireCoachOwnership, async (req, res): Promise<void> => {
  const coachId  = parseInt(String(req.params.id), 10);
  const photoId  = parseInt(String(req.params.photoId), 10);
  if (isNaN(coachId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [photo] = await db.select()
    .from(coachPhotosTable)
    .where(and(eq(coachPhotosTable.id, photoId), eq(coachPhotosTable.coachId, coachId)));
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  // Only delete from disk if it's an upload (not a seeded /coaches/*.jpg path)
  if (photo.url.startsWith("coaches/uploads/")) {
    const filePath = path.resolve(process.cwd(), "../courtbook/public", photo.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.delete(coachPhotosTable)
    .where(and(eq(coachPhotosTable.id, photoId), eq(coachPhotosTable.coachId, coachId)));
  res.json({ ok: true });
});

export default router;
