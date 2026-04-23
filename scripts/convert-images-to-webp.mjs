/**
 * One-time script: convert existing court PNG/JPG images to WebP
 * at max 1200px wide.
 *
 * Run from workspace root:
 *   node --experimental-vm-modules scripts/convert-images-to-webp.mjs
 *
 * sharp lives in api-server's node_modules, so we resolve it from there.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Resolve sharp from api-server's node_modules
const sharpPath = path.join(root, "artifacts/api-server/node_modules/sharp/lib/index.js");
const { default: sharp } = await import(pathToFileURL(sharpPath).href);

const IMAGE_DIRS = [
  path.join(root, "artifacts/courtbook/public/courts"),
  path.join(root, "artifacts/courtbook/public/courts/uploads"),
  path.join(root, "artifacts/courtbook/public/courts/padel"),
  path.join(root, "artifacts/courtbook/public/courts/football"),
  path.join(root, "artifacts/courtbook/public/courts/badminton"),
  path.join(root, "artifacts/courtbook/public/courts/squash"),
];

const CONVERTIBLE = new Set([".jpg", ".jpeg", ".png", ".gif"]);

let converted = 0;
let skipped = 0;
let errors = 0;

for (const dir of IMAGE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  console.log(`\nProcessing: ${dir}`);

  const files = fs.readdirSync(dir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return CONVERTIBLE.has(ext);
  });

  for (const file of files) {
    const src = path.join(dir, file);
    const base = path.basename(file, path.extname(file));
    const dest = path.join(dir, `${base}.webp`);

    if (fs.existsSync(dest)) {
      console.log(`  skip (webp exists): ${file}`);
      skipped++;
      continue;
    }

    try {
      const stat = fs.statSync(src);
      await sharp(src)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(dest);

      const newStat = fs.statSync(dest);
      const saved = Math.round((1 - newStat.size / stat.size) * 100);
      console.log(
        `  ✓ ${file} → ${base}.webp  ` +
        `(${Math.round(stat.size / 1024)} KB → ${Math.round(newStat.size / 1024)} KB, -${saved}%)`,
      );
      converted++;
    } catch (err) {
      console.error(`  ✗ ERROR ${file}: ${err.message}`);
      errors++;
    }
  }
}

console.log(`\nDone.  converted=${converted}  skipped=${skipped}  errors=${errors}`);
