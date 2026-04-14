import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, courtPhotosTable, courtsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const uploadDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router: IRouter = Router();

async function requireCourtOwner(courtId: number, userId: string): Promise<boolean> {
  const [court] = await db.select({ ownerUserId: courtsTable.ownerUserId })
    .from(courtsTable).where(eq(courtsTable.id, courtId));
  return court?.ownerUserId === userId;
}

router.get("/courts/:id/photos", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }
  try {
    const photos = await db.select().from(courtPhotosTable)
      .where(eq(courtPhotosTable.courtId, courtId))
      .orderBy(asc(courtPhotosTable.displayOrder), asc(courtPhotosTable.createdAt));
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

router.post("/courts/:id/photos", uploadPhoto.single("image"), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const courtId = parseInt(req.params.id);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const isOwner = await requireCourtOwner(courtId, userId);
  if (!isOwner) { res.status(403).json({ error: "Forbidden" }); return; }

  if (!req.file) { res.status(400).json({ error: "No image provided" }); return; }

  const url = `courts/uploads/${req.file.filename}`;
  const caption = typeof req.body.caption === "string" ? req.body.caption.trim() || null : null;

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
});

router.patch("/courts/:id/photos/:photoId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const courtId = parseInt(req.params.id);
  const photoId = parseInt(req.params.photoId);
  if (isNaN(courtId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const isOwner = await requireCourtOwner(courtId, userId);
  if (!isOwner) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: { caption?: string | null; displayOrder?: number } = {};
  if (typeof req.body.caption !== "undefined") updates.caption = req.body.caption || null;
  if (typeof req.body.displayOrder === "number") updates.displayOrder = req.body.displayOrder;

  const [updated] = await db.update(courtPhotosTable)
    .set(updates)
    .where(eq(courtPhotosTable.id, photoId))
    .returning();
  res.json(updated);
});

router.delete("/courts/:id/photos/:photoId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const courtId = parseInt(req.params.id);
  const photoId = parseInt(req.params.photoId);
  if (isNaN(courtId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const isOwner = await requireCourtOwner(courtId, userId);
  if (!isOwner) { res.status(403).json({ error: "Forbidden" }); return; }

  const [photo] = await db.select().from(courtPhotosTable).where(eq(courtPhotosTable.id, photoId));
  if (photo) {
    const filePath = path.resolve(process.cwd(), "../courtbook/public", photo.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.delete(courtPhotosTable).where(eq(courtPhotosTable.id, photoId));
  }
  res.json({ ok: true });
});

export default router;
