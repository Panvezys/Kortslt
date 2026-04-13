import pg from "pg";

const { Client } = pg;

const API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("VITE_GOOGLE_MAPS_API_KEY not set");
  process.exit(1);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: courts } = await db.query("SELECT id, name, address, city FROM courts ORDER BY id");
console.log(`Found ${courts.length} courts to process`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getPhotoUrl(courtName, city) {
  const query = encodeURIComponent(`${courtName} ${city} Lithuania`);
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${API_KEY}`;
  
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  
  if (!searchData.results || searchData.results.length === 0) {
    console.log(`  No results for: ${courtName}`);
    return null;
  }
  
  const place = searchData.results[0];
  let photoRef = place.photos?.[0]?.photo_reference;
  
  if (!photoRef) {
    const placeId = place.place_id;
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    photoRef = detailData.result?.photos?.[0]?.photo_reference;
  }
  
  if (!photoRef) {
    console.log(`  No photo found for: ${courtName}`);
    return null;
  }
  
  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${API_KEY}`;
  const photoRes = await fetch(photoApiUrl, { redirect: "manual" });
  const cdnUrl = photoRes.headers.get("location");
  
  if (!cdnUrl) {
    console.log(`  No redirect URL for: ${courtName}`);
    return null;
  }
  
  return cdnUrl;
}

let updated = 0;
let failed = 0;

for (const court of courts) {
  process.stdout.write(`[${court.id}/71] ${court.name} (${court.city}) ... `);
  
  try {
    const url = await getPhotoUrl(court.name, court.city);
    if (url) {
      await db.query("UPDATE courts SET image_url = $1 WHERE id = $2", [url, court.id]);
      console.log("✓");
      updated++;
    } else {
      console.log("✗ no photo");
      failed++;
    }
  } catch (err) {
    console.log(`✗ error: ${err.message}`);
    failed++;
  }
  
  await sleep(250);
}

await db.end();
console.log(`\nDone: ${updated} updated, ${failed} failed out of ${courts.length} courts`);
