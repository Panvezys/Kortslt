import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { gzip, constants as zlibConstants } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

const DIST = new URL("./dist/public", import.meta.url).pathname;
const PORT = process.env.PORT;

if (!PORT) throw new Error("PORT env var is required");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".xml":  "application/xml",
  ".txt":  "text/plain",
};

const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".xml", ".txt"]);

function cacheHeader(filePath) {
  if (/index\.html$/.test(filePath)) {
    return "no-cache, no-store, must-revalidate";
  }
  if (/\/assets\//.test(filePath)) {
    return "public, max-age=31536000, immutable";
  }
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/.test(filePath)) {
    return "public, max-age=604800, stale-while-revalidate=86400";
  }
  if (/\.(woff2?|ttf|eot)$/.test(filePath)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600";
}

async function resolveFile(urlPath) {
  for (const candidate of [
    join(DIST, urlPath),
    join(DIST, urlPath, "index.html"),
  ]) {
    try {
      const s = await stat(candidate);
      if (s.isFile()) return candidate;
    } catch { /* not found, try next */ }
  }
  return join(DIST, "index.html");
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = await resolveFile(urlPath);

  try {
    const body = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
    const canCompress = COMPRESSIBLE.has(ext);

    const headers = {
      "Content-Type":           MIME[ext] ?? "application/octet-stream",
      "Cache-Control":          cacheHeader(filePath),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options":        "SAMEORIGIN",
      "Vary":                   "Accept-Encoding",
    };

    if (acceptsGzip && canCompress && req.method !== "HEAD") {
      const compressed = await gzipAsync(body, { level: zlibConstants.Z_BEST_SPEED });
      headers["Content-Encoding"] = "gzip";
      headers["Content-Length"] = compressed.byteLength;
      res.writeHead(200, headers);
      res.end(compressed);
    } else {
      headers["Content-Length"] = body.byteLength;
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
    }
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Static server on port ${PORT}`);
});
