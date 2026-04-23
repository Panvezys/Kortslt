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

const DOC_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// All incoming images are processed in memory, converted to WebP, and resized
// to a maximum width of 1200px before being written to disk.
const memoryStorage = multer.memoryStorage();

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsDir),
  filename: (_req, file, cb) => {
    const ext = DOC_MIME_TO_EXT[file.mimetype] ?? ".pdf";
    const uniqueName = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF)"));
    }
  },
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in DOC_MIME_TO_EXT) {
      cb(null, true);
    } else {
      cb(new Error("Only images or PDF files are allowed"));
    }
  },
});

/** Convert an image buffer to WebP, capped at maxWidth pixels wide. */
async function toWebP(buffer: Buffer, maxWidth = 1200): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // honour EXIF orientation before resizing
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

const router: IRouter = Router();

router.post(
  "/upload/court-image",
  requireAuth,
  uploadImage.single("image"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }
    try {
      const webpBuf = await toWebP(req.file.buffer);
      const filename = `court_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
      fs.writeFileSync(path.join(uploadDir, filename), webpBuf);
      const relativePath = `courts/uploads/${filename}`;
      res.json({ path: relativePath, url: relativePath });
    } catch (err) {
      res.status(500).json({ error: "Image processing failed" });
    }
  },
);

router.post(
  "/upload/amenity-photo",
  requireAuth,
  uploadImage.single("image"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }
    try {
      const webpBuf = await toWebP(req.file.buffer);
      const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
      fs.writeFileSync(path.join(uploadDir, filename), webpBuf);
      const relativePath = `courts/uploads/${filename}`;
      res.json({ path: relativePath, url: relativePath });
    } catch (err) {
      res.status(500).json({ error: "Image processing failed" });
    }
  },
);

router.post("/upload/ownership-doc", requireAuth, uploadDoc.single("doc"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No document file provided" });
    return;
  }
  const relativePath = `courts/docs/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
});

export default router;
