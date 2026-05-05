import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

interface WeatherData {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  windSpeed: number;
  uvIndex: number;
  weatherCode: number;
}

// In-memory cache — keyed by "${lat},${lon},${date}", TTL 2h
const weatherCache = new Map<string, { data: WeatherData; expiresAt: number }>();
const TTL_MS = 2 * 60 * 60 * 1000;

// GET /api/weather?lat=&lon=&date=YYYY-MM-DD
router.get("/weather", async (req, res): Promise<void> => {
  const { lat, lon, date } = req.query;
  if (
    typeof lat !== "string" ||
    typeof lon !== "string" ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    res.status(400).json({ error: "lat, lon, and date (YYYY-MM-DD) are required" });
    return;
  }

  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  if (isNaN(latN) || isNaN(lonN)) {
    res.status(400).json({ error: "lat and lon must be numeric" });
    return;
  }

  const key = `${latN.toFixed(4)},${lonN.toFixed(4)},${date}`;
  const cached = weatherCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.data);
    return;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latN}&longitude=${lonN}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,weather_code` +
      `&timezone=Europe%2FVilnius` +
      `&start_date=${date}&end_date=${date}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Open-Meteo returned ${resp.status}`);

    const raw = (await resp.json()) as any;
    const d = raw.daily;

    const data: WeatherData = {
      date,
      temperatureMax: Math.round(d.temperature_2m_max?.[0] ?? 0),
      temperatureMin: Math.round(d.temperature_2m_min?.[0] ?? 0),
      precipitationProbability: Math.round(d.precipitation_probability_max?.[0] ?? 0),
      windSpeed: Math.round(d.wind_speed_10m_max?.[0] ?? 0),
      uvIndex: Math.round(d.uv_index_max?.[0] ?? 0),
      weatherCode: d.weather_code?.[0] ?? 0,
    };

    weatherCache.set(key, { data, expiresAt: Date.now() + TTL_MS });
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Weather fetch failed");
    res.status(502).json({ error: "Weather data unavailable" });
  }
});

export default router;
