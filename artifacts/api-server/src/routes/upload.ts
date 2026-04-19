import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { requireAuth } from "../lib/auth";

const uploadDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");
const docsDir = path.resolve(process.cwd(), "../courtbook/public/courts/docs");

for (const dir of [uploadDir, docsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const memoryStorage = multer.memoryStorage();

const uploadImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF)"));
    }
  },
});

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/jpg", "image/png", "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images or PDF files are allowed"));
    }
  },
});

async function processAndSaveImage(buffer: Buffer, destDir: string, prefix: string): Promise<string> {
  const uniqueName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
  const destPath = path.join(destDir, uniqueName);
  await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destPath);
  return uniqueName;
}

const router: IRouter = Router();

router.post("/upload/court-image", uploadImage.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  try {
    const filename = await processAndSaveImage(req.file.buffer, uploadDir, "court");
    const relativePath = `courts/uploads/${filename}`;
    res.json({ path: relativePath, url: relativePath });
  } catch (err) {
    console.error("Image processing error:", err);
    res.status(500).json({ error: "Failed to process image" });
  }
});

router.post("/upload/amenity-photo", uploadImage.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  try {
    const filename = await processAndSaveImage(req.file.buffer, uploadDir, "amenity");
    const relativePath = `courts/uploads/${filename}`;
    res.json({ path: relativePath, url: relativePath });
  } catch (err) {
    console.error("Image processing error:", err);
    res.status(500).json({ error: "Failed to process image" });
  }
});

router.post("/upload/ownership-doc", requireAuth, uploadDoc.single("doc"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No document file provided" });
    return;
  }
  const relativePath = `courts/docs/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
});

export default router;
