import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../lib/auth";

const uploadDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");
const docsDir = path.resolve(process.cwd(), "../courtbook/public/courts/docs");

for (const dir of [uploadDir, docsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const DOC_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = IMAGE_MIME_TO_EXT[file.mimetype] ?? ".jpg";
    const uniqueName = `court_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsDir),
  filename: (_req, file, cb) => {
    const ext = DOC_MIME_TO_EXT[file.mimetype] ?? ".pdf";
    const uniqueName = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in IMAGE_MIME_TO_EXT) {
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

const router: IRouter = Router();

router.post("/upload/court-image", requireAuth, uploadImage.single("image"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  const relativePath = `courts/uploads/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
});

router.post("/upload/amenity-photo", requireAuth, uploadImage.single("image"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  const relativePath = `courts/uploads/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
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
