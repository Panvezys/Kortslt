import pg from "pg";

const { Client } = pg;
const API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error("VITE_GOOGLE_MAPS_API_KEY missing"); process.exit(1); }

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CITIES = [
  { name: "Vilnius",      lat: 54.6872, lng: 25.2797 },
  { name: "Kaunas",       lat: 54.8985, lng: 23.9036 },
  { name: "Klaipėda",     lat: 55.7033, lng: 21.1443 },
  { name: "Šiauliai",     lat: 55.9349, lng: 23.3137 },
  { name: "Panevėžys",    lat: 55.7348, lng: 24.3572 },
  { name: "Alytus",       lat: 54.4027, lng: 24.0508 },
  { name: "Marijampolė",  lat: 54.5599, lng: 23.3555 },
  { name: "Mažeikiai",    lat: 56.3089, lng: 22.3414 },
  { name: "Jonava",       lat: 55.0721, lng: 24.2789 },
  { name: "Utena",        lat: 55.4990, lng: 25.6030 },
  { name: "Kėdainiai",    lat: 55.2899, lng: 23.9718 },
  { name: "Telšiai",      lat: 55.9851, lng: 22.2570 },
  { name: "Ukmergė",      lat: 55.2469, lng: 24.7701 },
  { name: "Tauragė",      lat: 55.2511, lng: 22.2891 },
  { name: "Plungė",       lat: 55.9112, lng: 21.8459 },
  { name: "Druskininkai", lat: 54.0149, lng: 23.9716 },
  { name: "Palanga",      lat: 55.9182, lng: 21.0685 },
  { name: "Biržai",       lat: 56.2020, lng: 24.7538 },
  { name: "Anykščiai",    lat: 55.5245, lng: 25.1061 },
  { name: "Rokiškis",     lat: 55.9604, lng: 25.5846 },
  { name: "Zarasai",      lat: 55.7326, lng: 26.2508 },
  { name: "Visaginas",    lat: 55.5952, lng: 26.4378 },
  { name: "Skuodas",      lat: 56.2713, lng: 21.5249 },
  { name: "Neringa",      lat: 55.4520, lng: 21.1000 },
];

const SPORTS = [
  { type: "tennis",     keyword: "tennis",    price: 20, maxPlayers: 4  },
  { type: "basketball", keyword: "basketball", price: 15, maxPlayers: 10 },
  { type: "padel",      keyword: "padel",      price: 25, maxPlayers: 4  },
  { type: "football",   keyword: "futsal",     price: 30, maxPlayers: 12 },
  { type: "badminton",  keyword: "badminton",  price: 10, maxPlayers: 4  },
  { type: "squash",     keyword: "squash",     price: 15, maxPlayers: 2  },
];

const SURFACE = {
  tennis: "clay", basketball: "parquet", padel: "artificial_turf",
  football: "artificial_turf", badminton: "parquet", squash: "hard",
};

function isIndoorByName(name) {
  return /salė|maniežas|arena|indoor|vidaus|sport.*hal|cent/i.test(name);
}
function norm(name) { return name.toLowerCase().replace(/[^a-ząčęėįšųūž0-9]/g, ""); }

// Load existing courts
const { rows: existing } = await db.query("SELECT name, city, latitude, longitude FROM courts");
const existingKeys = new Set(existing.map(c => `${norm(c.name)}|${c.city.toLowerCase()}`));
const existingCoords = existing.map(c => ({ lat: +c.latitude, lng: +c.longitude }));

function tooClose(lat, lng) {
  for (const c of existingCoords) {
    const dy = (lat - c.lat) * 111000;
    const dx = (lng - c.lng) * 111000 * Math.cos(lat * Math.PI / 180);
    if (Math.sqrt(dx * dx + dy * dy) < 150) return true;
  }
  return false;
}

// ── Phase 1: collect ALL candidate places ─────────────────────────────────────
console.log("Phase 1: Searching across all cities and sports...\n");

const candidates = []; // { place_id, name, lat, lng, city, sportType, sportPrice, sportMax, photo_reference }
const seenPlaceIds = new Set();

for (const city of CITIES) {
  process.stdout.write(`  ${city.name}: `);
  for (const sport of SPORTS) {
    const query = encodeURIComponent(`${sport.keyword} Lithuania ${city.name}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${city.lat},${city.lng}&radius=30000&key=${API_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      let found = 0;
      for (const place of (data.results || [])) {
        if (seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);
        const lat = place.geometry?.location?.lat;
        const lng = place.geometry?.location?.lng;
        const key = `${norm(place.name)}|${city.name.toLowerCase()}`;
        if (existingKeys.has(key) || (lat && tooClose(lat, lng))) continue;
        candidates.push({
          place_id: place.place_id,
          name: place.name,
          lat, lng,
          vicinity: place.vicinity || "",
          photo_reference: place.photos?.[0]?.photo_reference || null,
          city: city.name,
          sportType: sport.type,
          sportPrice: sport.price,
          sportMax: sport.maxPlayers,
        });
        found++;
      }
      process.stdout.write(`${sport.type.slice(0,2)}:${found} `);
    } catch (e) {
      process.stdout.write(`${sport.type.slice(0,2)}:err `);
    }
    await sleep(150);
  }
  console.log();
}

console.log(`\nFound ${candidates.length} candidates to process.\n`);

// ── Phase 2: Get details + insert ──────────────────────────────────────────────
console.log("Phase 2: Fetching details and inserting new courts...\n");

let inserted = 0;

for (const c of candidates) {
  // Re-check dedup (could have been added in this session)
  if (tooClose(c.lat, c.lng)) continue;

  // Get phone + better address from Place Details (parallel with photo fetch if we already have a ref)
  let phone = null;
  let street = c.vicinity.split(",")[0] || c.vicinity;
  let imageUrl = null;

  try {
    const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${c.place_id}&fields=formatted_phone_number,formatted_address,photos&key=${API_KEY}`;
    const detRes = await fetch(detUrl);
    const det = (await detRes.json()).result || {};
    phone = det.formatted_phone_number || null;
    if (det.formatted_address) {
      street = det.formatted_address.split(",")[0].trim();
    }
    const photoRef = det.photos?.[0]?.photo_reference || c.photo_reference;
    if (photoRef) {
      const pRes = await fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${API_KEY}`, { redirect: "manual" });
      imageUrl = pRes.headers.get("location") || null;
    }
  } catch (e) { /* skip on error */ }

  await sleep(80);

  try {
    await db.query(
      `INSERT INTO courts 
        (name, type, address, city, latitude, longitude, price_per_hour,
         image_url, owner_name, owner_email, amenities, is_indoor,
         max_players, surface, condition, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        c.name, c.sportType, street, c.city, c.lat, c.lng,
        c.sportPrice.toFixed(2), imageUrl,
        c.name, "info@korts.lt",
        [], isIndoorByName(c.name), c.sportMax,
        SURFACE[c.sportType], "good", phone,
      ]
    );
    existingCoords.push({ lat: c.lat, lng: c.lng });
    console.log(`  ✓ [${c.sportType}] ${c.name} – ${c.city}`);
    inserted++;
  } catch (e) {
    console.log(`  ✗ ${c.name}: ${e.message.slice(0, 60)}`);
  }
}

await db.end();
console.log(`\n=== ${inserted} new courts imported ===`);
