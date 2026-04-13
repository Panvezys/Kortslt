import pg from "pg";

const { Client } = pg;

const API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fallback queries for courts that didn't match by name
const overrides = {
  8:  ["Megatenis Kaunas sporto", "Kaunas tennis club Draugystės"],
  9:  ["Balzekas Tennis Klaipeda", "Klaipeda tennis academy Arimu"],
  24: ["padel arena Klaipeda", "Klaipeda padel club Taikos"],
  33: ["Viesulas sporto Vilnius Naugarduko", "Vilnius sports club Naugarduko"],
  34: ["badminton Kaunas Draugystės", "Kaunas badminton hall"],
  35: ["LBF badminton Kalvariju Vilnius", "Lithuania badminton federation hall"],
  50: ["SC Atzalynas Siauliai Zemaitės", "Siauliai sports centre basketball"],
  60: ["tennis Utena Donelaicio", "Utena sports centre tennis"],
  61: ["football Utena Taikos", "Utena futbolo centras"],
};

async function searchWithQuery(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encoded}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) return null;

  const place = data.results[0];
  let photoRef = place.photos?.[0]?.photo_reference;

  if (!photoRef) {
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=photos&key=${API_KEY}`;
    const dRes = await fetch(detailUrl);
    const dData = await dRes.json();
    photoRef = dData.result?.photos?.[0]?.photo_reference;
  }

  if (!photoRef) return null;

  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${API_KEY}`;
  const photoRes = await fetch(photoApiUrl, { redirect: "manual" });
  return photoRes.headers.get("location");
}

for (const [courtId, queries] of Object.entries(overrides)) {
  const { rows } = await db.query("SELECT id, name, city FROM courts WHERE id = $1", [courtId]);
  const court = rows[0];
  if (!court) continue;

  process.stdout.write(`[${courtId}] ${court.name} (${court.city}) ... `);
  let found = false;

  for (const q of queries) {
    try {
      const url = await searchWithQuery(q);
      if (url) {
        await db.query("UPDATE courts SET image_url = $1 WHERE id = $2", [url, courtId]);
        console.log(`✓ (query: "${q}")`);
        found = true;
        break;
      }
    } catch (e) {
      // continue
    }
    await sleep(200);
  }

  if (!found) console.log("✗ still no photo");
  await sleep(300);
}

await db.end();
console.log("Retry complete");
