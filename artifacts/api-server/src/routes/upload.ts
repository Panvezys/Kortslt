import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve(process.cwd(), "../courtbook/public/courts/uploads");
const docsDir = path.resolve(process.cwd(), "../courtbook/public/courts/docs");

for (const dir of [uploadDir, docsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `court_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
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

const uploadImage = multer({
  storage: imageStorage,
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

const router: IRouter = Router();

router.post("/upload/court-image", uploadImage.single("image"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  const relativePath = `courts/uploads/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
});

router.post("/upload/amenity-photo", uploadImage.single("image"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  const relativePath = `courts/uploads/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
});

router.post("/upload/ownership-doc", uploadDoc.single("doc"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No document file provided" });
    return;
  }
  const relativePath = `courts/docs/${req.file.filename}`;
  res.json({ path: relativePath, url: relativePath });
});

export default router;
