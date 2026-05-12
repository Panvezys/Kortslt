import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { GoogleMap, useJsApiLoader, InfoWindowF } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { MapPin } from "lucide-react";
import { sportColor as SPORT_COLOR, getSportColor, SPORT_LABELS } from "@/components/sport-icon";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useTheme } from "./theme-provider";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LITHUANIA_CENTER = { lat: 55.1694, lng: 23.8813 };
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const NEARBY_KM = 30;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const LIBRARIES: ("places")[] = ["places"];

export const LT_CITY_COORDS: Record<string, [number, number]> = {
  "Vilnius": [54.6872, 25.2797],
  "Kaunas": [54.8985, 23.9036],
  "Klaipėda": [55.7033, 21.1443],
  "Šiauliai": [55.9333, 23.3167],
  "Panevėžys": [55.7333, 24.3667],
  "Alytus": [54.4000, 24.0500],
  "Marijampolė": [54.5667, 23.3667],
  "Mažeikiai": [56.3167, 22.3333],
  "Jonava": [55.0833, 24.2833],
  "Utena": [55.5000, 25.6000],
  "Plungė": [55.9167, 21.8500],
  "Kėdainiai": [55.2833, 23.9667],
  "Telšiai": [55.9833, 22.2500],
  "Ukmergė": [55.2500, 24.7500],
  "Tauragė": [55.2500, 22.2833],
  "Birštonas": [54.6000, 24.0333],
  "Druskininkai": [54.0167, 23.9667],
  "Palanga": [55.9167, 21.0667],
};

export interface MatchItem {
  kind: "booked" | "casual";
  gameId: number;
  sport: string;
  datetime: string;
  creatorName: string;
  courtName: string | null;
  facilityName: string | null;
  facilityCity: string | null;
  city: string | null;
  placeName: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  pricePerSlot: number | null;
  totalSlots: number | null;
  paidSlots: number | null;
  slotsLeft: number;
  lat: number | null;
  lng: number | null;
  durationMinutes: number | null;
  joinedCount: number | null;
  playersNeeded: number | null;
  courtImageUrl: string | null;
}

/** Returns [lat, lng] for a match, or null if unknown */
export function resolveMatchCoords(m: MatchItem): [number, number] | null {
  if (m.lat != null && m.lng != null) return [m.lat, m.lng];
  const city = m.facilityCity || m.city;
  if (city && LT_CITY_COORDS[city]) return LT_CITY_COORDS[city];
  return null;
}

// ─── Icon building (mirrors court-map.tsx) ────────────────────────────────────

const sportIconPaths: Record<string, string> = {
  tennis: `<circle cx="12" cy="12" r="10"/><path d="M5.2 6.5 C9 9.5 9 14.5 5.2 17.5"/><path d="M18.8 6.5 C15 9.5 15 14.5 18.8 17.5"/>`,
  basketball: `<circle cx="12" cy="12" r="10"/><path d="M12 2 C8.5 6 8.5 18 12 22"/><path d="M12 2 C15.5 6 15.5 18 12 22"/><line x1="2" y1="12" x2="22" y2="12"/>`,
  padel: `<rect x="5" y="2" width="14" height="15" rx="3.5"/><line x1="5" y1="7.5" x2="19" y2="7.5" stroke-width="0.9"/><line x1="5" y1="11.5" x2="19" y2="11.5" stroke-width="0.9"/><line x1="5" y1="14" x2="19" y2="14" stroke-width="0.9"/><line x1="9.5" y1="2" x2="9.5" y2="17" stroke-width="0.9"/><line x1="14.5" y1="2" x2="14.5" y2="17" stroke-width="0.9"/><line x1="12" y1="17" x2="12" y2="23"/><line x1="10" y1="23" x2="14" y2="23"/>`,
  football: `<circle cx="12" cy="12" r="10"/><polygon points="12,7.5 15.9,10.2 14.4,14.3 9.6,14.3 8.1,10.2"/><line x1="12" y1="7.5" x2="12" y2="2.1"/><line x1="15.9" y1="10.2" x2="20.4" y2="8.7"/><line x1="14.4" y1="14.3" x2="17.5" y2="18.5"/><line x1="9.6" y1="14.3" x2="6.5" y2="18.5"/><line x1="8.1" y1="10.2" x2="3.6" y2="8.7"/>`,
  badminton: `<circle cx="12" cy="20.5" r="1.8"/><line x1="10.3" y1="18.8" x2="7.5" y2="9.5"/><line x1="13.7" y1="18.8" x2="16.5" y2="9.5"/><path d="M7.5 9.5 Q12 4.5 16.5 9.5"/><line x1="8.2" y1="12" x2="15.8" y2="12" stroke-width="0.9"/><line x1="8.8" y1="14.5" x2="15.2" y2="14.5" stroke-width="0.9"/><line x1="9.5" y1="17" x2="14.5" y2="17" stroke-width="0.9"/>`,
  squash: `<ellipse cx="12" cy="9.5" rx="6" ry="7"/><line x1="12" y1="16.5" x2="12" y2="22"/><line x1="10.5" y1="21" x2="13.5" y2="21"/><line x1="6" y1="9.5" x2="18" y2="9.5" stroke-width="0.9"/><line x1="12" y1="2.5" x2="12" y2="16.5" stroke-width="0.9"/>`,
  table_tennis: `<circle cx="10" cy="10" r="8"/><line x1="2.2" y1="10" x2="17.8" y2="10" stroke-width="0.9"/><line x1="16" y1="16" x2="20.5" y2="21" stroke-width="2.5" stroke-linecap="round"/><circle cx="21.5" cy="4" r="2"/>`,
  volleyball: `<circle cx="12" cy="12" r="10"/><path d="M12 2 C8 5 6 9 8 14"/><path d="M12 2 C16 5 18 9 16 14"/><path d="M2.5 9 C6 11 10 10 13 13"/><path d="M21.5 9 C18 11 14 10 11 13"/>`,
  hockey: `<path d="M4 6 L4 18 Q4 20 6 20 L8 20 Q10 20 10 18 L10 13 L18 20 L20 20 L20 18 L12 11 L20 6 Z"/>`,
  futsal: `<circle cx="12" cy="12" r="10"/><polygon points="12,7.5 15.9,10.2 14.4,14.3 9.6,14.3 8.1,10.2"/>`,
  floorball: `<circle cx="12" cy="18" r="3"/><line x1="12" y1="15" x2="12" y2="6"/><path d="M12 6 L18 10"/><circle cx="12" cy="4" r="1.5"/>`,
  "beach-volleyball": `<circle cx="12" cy="12" r="10"/><path d="M2 12 Q6 8 12 12 Q18 16 22 12"/><path d="M5 7 Q9 11 12 9 Q15 7 19 11"/>`,
  golf: `<line x1="8" y1="22" x2="8" y2="2"/><path d="M8 2 L17.5 6 L8 10"/><ellipse cx="8" cy="22" rx="4.5" ry="1.2"/><circle cx="19.5" cy="18.5" r="2.5"/>`,
  bowling: `<circle cx="8" cy="15.5" r="6.5"/><circle cx="6" cy="14" r="1" fill="white" stroke="none"/><circle cx="9" cy="12.5" r="1" fill="white" stroke="none"/><circle cx="11" cy="15.5" r="1" fill="white" stroke="none"/><circle cx="19.5" cy="4.5" r="2"/>`,
  pickleball: `<circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1.5" fill="white" stroke="none"/><circle cx="12" cy="7" r="1.5" fill="white" stroke="none"/><circle cx="16" cy="9" r="1.5" fill="white" stroke="none"/><circle cx="8" cy="15" r="1.5" fill="white" stroke="none"/><circle cx="16" cy="15" r="1.5" fill="white" stroke="none"/>`,
};

function buildIconUrl(color: string, sport: string, isSelected: boolean): string {
  const key = sport.replace(/-/g, "_");
  const size = isSelected ? 44 : 34;
  const border = isSelected ? 3 : 2;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - border / 2;
  const iconPx = size * 0.58;
  const iconScale = iconPx / 24;
  const tx = (cx - 12 * iconScale).toFixed(3);
  const ty = (cy - 12 * iconScale).toFixed(3);
  const sw = (2 / iconScale).toFixed(2);
  const paths = sportIconPaths[key] ?? sportIconPaths["tennis"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="${border}"/>
  <g transform="translate(${tx},${ty}) scale(${iconScale.toFixed(4)})" fill="none" stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildIconCache(): Record<string, { normal: google.maps.Icon; selected: google.maps.Icon }> {
  const cache: Record<string, { normal: google.maps.Icon; selected: google.maps.Icon }> = {};
  const allSports = { ...SPORT_COLOR };
  for (const [sport, color] of Object.entries(allSports)) {
    cache[sport] = {
      normal: { url: buildIconUrl(color, sport, false), scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) },
      selected: { url: buildIconUrl(color, sport, true), scaledSize: new google.maps.Size(44, 44), anchor: new google.maps.Point(22, 22) },
    };
  }
  return cache;
}

// ─── Map styles ───────────────────────────────────────────────────────────────

const MAP_STYLES_LIGHT: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d1fae5" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bfdbfe" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fde68a" }] },
];

const MAP_STYLES_DARK: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b3b5e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
];

// ─── InfoWindow ───────────────────────────────────────────────────────────────

function useInfoWindowStyles() {
  useEffect(() => {
    const id = "gm-match-iw-overrides";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .gm-style-iw-c { padding: 0 !important; overflow: hidden !important; border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.28) !important; top: 0 !important; }
      .gm-style-iw-d { overflow: hidden !important; padding: 0 !important; max-height: none !important; }
      .gm-style-iw-d > div { overflow: hidden !important; }
      .gm-style-iw-ch { display: none !important; height: 0 !important; padding: 0 !important; }
      .gm-style-iw-t::after { display: none !important; }
      button.gm-ui-hover-effect { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

interface MatchInfoWindowProps {
  match: MatchItem & { mapLat: number; mapLng: number };
  onClose: () => void;
  theme: "light" | "dark";
}

function MatchInfoWindow({ match: m, onClose, theme }: MatchInfoWindowProps) {
  useInfoWindowStyles();
  const color = getSportColor(m.sport);
  const isDark = theme === "dark";
  const bg = isDark ? "#0d0f14" : "#ffffff";
  const textPrimary = isDark ? "#f9fafb" : "#111827";
  const textSecondary = isDark ? "#9ca3af" : "#6b7280";
  const pillBg = isDark ? "#1f2937" : "#f3f4f6";
  const pillText = isDark ? "#d1d5db" : "#374151";
  const divider = isDark ? "#1f2937" : "#f3f4f6";

  const img = m.kind === "booked" ? resolveCourtImage(m.courtImageUrl) : null;
  const sportLabel = (SPORT_LABELS as any)[m.sport] ?? (SPORT_LABELS as any)[m.sport.replace(/-/g, "_")] ?? m.sport;
  const locationName = m.kind === "booked" ? (m.courtName ?? m.facilityName ?? "") : (m.placeName ?? "");
  const city = m.facilityCity ?? m.city ?? "";

  const dateLabel = (() => {
    if (m.kind === "booked" && m.date && m.startTime) {
      const d = new Date(m.date + "T12:00:00");
      return `${d.toLocaleDateString("lt-LT", { weekday: "short", month: "short", day: "numeric" })} · ${m.startTime.slice(0, 5)}${m.endTime ? `–${m.endTime.slice(0, 5)}` : ""}`;
    }
    const d = new Date(m.datetime);
    const mins = m.durationMinutes;
    const endLabel = mins ? `–${new Date(d.getTime() + mins * 60_000).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}` : "";
    return `${d.toLocaleDateString("lt-LT", { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}${endLabel}`;
  })();

  const totalPlayers = m.totalSlots ?? m.playersNeeded ?? 0;
  const filledPlayers = m.kind === "booked" ? (m.paidSlots ?? 0) : (m.joinedCount ?? 0);
  const slotsLeft = m.slotsLeft;

  const sportSvgKey = m.sport.replace(/-/g, "_");
  const sportPaths = sportIconPaths[sportSvgKey] ?? sportIconPaths["tennis"];
  const sportSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${sportPaths}</svg>`;
  const sportSvgUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(sportSvg)}`;

  return (
    <InfoWindowF
      position={{ lat: m.mapLat, lng: m.mapLng }}
      onCloseClick={onClose}
      options={{ pixelOffset: new google.maps.Size(0, -22), disableAutoPan: false, maxWidth: 230 }}
    >
      <div style={{ width: "230px", fontFamily: "system-ui, -apple-system, sans-serif", background: bg, color: textPrimary, borderRadius: "12px", overflow: "hidden" }}>
        {/* Photo */}
        {img && (
          <div style={{ position: "relative", width: "100%", height: "100px", overflow: "hidden" }}>
            <img src={img} alt={locationName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
            <button onClick={onClose} title="Uždaryti" style={{ position: "absolute", top: "7px", right: "7px", width: "24px", height: "24px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1.5px solid rgba(255,255,255,0.25)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", lineHeight: 1, backdropFilter: "blur(4px)", flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "7px" }}>
          {/* Header: sport badge + close (if no photo) */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ background: color, color: "white", padding: "3px 8px 3px 6px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <img src={sportSvgUrl} alt="" width="13" height="13" style={{ display: "block" }} />
                {sportLabel}
              </span>
              {m.kind === "booked" && (
                <span style={{ background: "rgba(132,204,22,0.15)", color: "#65a30d", border: "1px solid rgba(132,204,22,0.3)", padding: "3px 7px", borderRadius: "999px", fontSize: "10px", fontWeight: 600 }}>
                  Su kortu
                </span>
              )}
            </div>
            {!img && (
              <button onClick={onClose} title="Uždaryti" style={{ width: "20px", height: "20px", borderRadius: "50%", background: isDark ? "#374151" : "#f3f4f6", border: "none", color: textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>✕</button>
            )}
          </div>

          {/* Location name */}
          {locationName && (
            <div style={{ fontWeight: 700, fontSize: "13px", lineHeight: "1.3", color: textPrimary }}>
              {locationName}
            </div>
          )}

          {/* City */}
          {city && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: textSecondary }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              {city}
            </div>
          )}

          {/* Date/time */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: textSecondary }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {dateLabel}
          </div>

          {/* Players */}
          {totalPlayers > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ display: "flex", gap: "3px" }}>
                {Array.from({ length: Math.min(totalPlayers, 8) }).map((_, i) => (
                  <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: i < filledPlayers ? color : (isDark ? "#374151" : "#e5e7eb"), transition: "background 0.15s" }} />
                ))}
              </div>
              <span style={{ fontSize: "11px", color: slotsLeft === 0 ? "#10b981" : textSecondary }}>
                {slotsLeft === 0 ? "Pilna" : `${slotsLeft} laisv${slotsLeft === 1 ? "a" : "os"} viet${slotsLeft === 1 ? "a" : "ų"}`}
              </span>
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${divider}`, margin: "1px 0" }} />

          {/* Price + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {m.kind === "booked" && m.pricePerSlot != null && m.pricePerSlot > 0 ? (
              <span style={{ fontWeight: 700, color, fontSize: "14px" }}>
                {m.pricePerSlot}€
                <span style={{ color: textSecondary, fontSize: "10px", fontWeight: 400 }}> / žaid.</span>
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: textSecondary }}>
                {m.kind === "casual" ? "Nemokama" : ""}
              </span>
            )}
            <a
              href={`${BASE}/matches/${m.gameId}`}
              style={{ background: color, color: "#132D4C", padding: "5px 13px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, textDecoration: "none", display: "inline-block", transition: "filter 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1)"; }}
            >
              Peržiūrėti →
            </a>
          </div>
        </div>
      </div>
    </InfoWindowF>
  );
}

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main component ───────────────────────────────────────────────────────────

type MappableMatch = MatchItem & { mapLat: number; mapLng: number };

export function MatchMap({ matches }: { matches: MatchItem[] }) {
  const { theme } = useTheme();
  const [selectedMatch, setSelectedMatch] = useState<MappableMatch | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [mapReady, setMapReady] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const iconCacheRef = useRef<ReturnType<typeof buildIconCache> | null>(null);
  const userMarkerRef = useRef<google.maps.Circle | null>(null);
  const userDotRef = useRef<google.maps.Marker | null>(null);

  // Resolve lat/lng for all matches
  const allMappable = useMemo<MappableMatch[]>(() => {
    return matches.flatMap(m => {
      const coords = resolveMatchCoords(m);
      if (!coords) return [];
      return [{ ...m, mapLat: coords[0], mapLng: coords[1] }];
    });
  }, [matches]);

  const visibleMatches = useMemo(() => {
    if (!nearbyMode || !userLocation) return allMappable;
    return allMappable.filter(m => haversineKm(userLocation.lat, userLocation.lng, m.mapLat, m.mapLng) <= NEARBY_KM);
  }, [allMappable, nearbyMode, userLocation]);

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: API_KEY ?? "", libraries: LIBRARIES });

  const fitBounds = useCallback((map: google.maps.Map, list: MappableMatch[]) => {
    if (list.length === 0) { map.setCenter(LITHUANIA_CENTER); map.setZoom(7); }
    else if (list.length === 1) { map.setCenter({ lat: list[0].mapLat, lng: list[0].mapLng }); map.setZoom(12); }
    else {
      const bounds = new google.maps.LatLngBounds();
      list.forEach(m => bounds.extend({ lat: m.mapLat, lng: m.mapLng }));
      map.fitBounds(bounds, 60);
    }
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    iconCacheRef.current = buildIconCache();
    clustererRef.current = new MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render({ count, position }) {
          return new google.maps.Marker({
            position,
            label: { text: String(count), color: "#F3F7FA", fontSize: "12px", fontWeight: "700" },
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="19" fill="#C5E041" stroke="#FFFFFF" stroke-width="2.5"/></svg>`)}`,
              scaledSize: new google.maps.Size(42, 42),
              anchor: new google.maps.Point(21, 21),
            },
            zIndex: 1000,
          });
        },
      },
    });
    fitBounds(map, allMappable);

    // Lithuania border overlay
    fetch("https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/lithuania.geojson")
      .then(r => r.json())
      .then((geoJson: any) => {
        if (!mapRef.current) return;
        const feature = geoJson.features?.[0];
        if (!feature) return;
        const geom = feature.geometry;
        let outerRing: number[][];
        if (geom.type === "Polygon") outerRing = geom.coordinates[0];
        else if (geom.type === "MultiPolygon") outerRing = geom.coordinates[0][0];
        else return;
        const worldBbox = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
        const hole = [...outerRing].reverse();
        map.data.addGeoJson({ type: "FeatureCollection", features: [
          { type: "Feature", properties: { kind: "overlay" }, geometry: { type: "Polygon", coordinates: [worldBbox, hole] } },
          { type: "Feature", properties: { kind: "border" }, geometry: geom },
        ]});
        map.data.setStyle((f: google.maps.Data.Feature) => {
          const kind = f.getProperty("kind");
          if (kind === "overlay") return { fillColor: "#132D4C", fillOpacity: 0.35, strokeOpacity: 0, clickable: false, zIndex: 1 };
          if (kind === "border") return { fillOpacity: 0, strokeColor: "#C5E041", strokeWeight: 1.5, strokeOpacity: 0.7, clickable: false, zIndex: 2 };
          return {};
        });
      })
      .catch(() => {});

    setMapReady(true);
  }, [allMappable, fitBounds]);

  // Manage markers imperatively
  useEffect(() => {
    if (!mapRef.current || !iconCacheRef.current || !clustererRef.current) return;
    const icons = iconCacheRef.current;
    const clusterer = clustererRef.current;
    const visibleKeys = new Set(visibleMatches.map(m => `${m.kind}-${m.gameId}`));
    const currentKeys = new Set(markersRef.current.keys());

    const toRemove: google.maps.Marker[] = [];
    for (const [key, marker] of markersRef.current.entries()) {
      if (!visibleKeys.has(key)) { marker.setMap(null); toRemove.push(marker); markersRef.current.delete(key); }
    }
    if (toRemove.length) clusterer.removeMarkers(toRemove);

    const toAdd: google.maps.Marker[] = [];
    for (const m of visibleMatches) {
      const key = `${m.kind}-${m.gameId}`;
      if (currentKeys.has(key)) continue;
      const sportKey = m.sport.replace(/-/g, "_");
      const sportIcons = icons[sportKey] ?? icons["tennis"];
      const marker = new google.maps.Marker({
        position: { lat: m.mapLat, lng: m.mapLng },
        icon: sportIcons.normal,
        title: (SPORT_LABELS as any)[m.sport] ?? m.sport,
        zIndex: 1,
      });
      marker.addListener("click", () => setSelectedMatch(prev => prev?.gameId === m.gameId ? null : m));
      markersRef.current.set(key, marker);
      toAdd.push(marker);
    }
    if (toAdd.length) clusterer.addMarkers(toAdd);
  }, [visibleMatches, mapReady]);

  // Update selected marker icon
  useEffect(() => {
    if (!iconCacheRef.current) return;
    const icons = iconCacheRef.current;
    for (const [key, marker] of markersRef.current.entries()) {
      const m = visibleMatches.find(x => `${x.kind}-${x.gameId}` === key);
      if (!m) continue;
      const sportKey = m.sport.replace(/-/g, "_");
      const sportIcons = icons[sportKey] ?? icons["tennis"];
      const isSelected = selectedMatch?.gameId === m.gameId;
      marker.setIcon(isSelected ? sportIcons.selected : sportIcons.normal);
      marker.setZIndex(isSelected ? 999 : 1);
    }
  }, [selectedMatch, visibleMatches]);

  // Map style updates
  useEffect(() => {
    if (!mapRef.current) return;
    const styles = mapType === "roadmap" ? (theme === "dark" ? MAP_STYLES_DARK : MAP_STYLES_LIGHT) : undefined;
    mapRef.current.setOptions({ styles });
  }, [theme, mapType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) marker.setMap(null);
      markersRef.current.clear();
      clustererRef.current?.clearMarkers();
    };
  }, []);

  // Remove SVG background bleed
  useEffect(() => {
    const id = "gm-match-marker-bg-fix";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `.gm-style img[src^="data:image/svg"] { background: transparent !important; }`;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const handleNearby = () => {
    if (nearbyMode) {
      setNearbyMode(false); setUserLocation(null); setNearbyError(null);
      userMarkerRef.current?.setMap(null); userMarkerRef.current = null;
      userDotRef.current?.setMap(null); userDotRef.current = null;
      if (mapRef.current) fitBounds(mapRef.current, allMappable);
      return;
    }
    if (!navigator.geolocation) { setNearbyError("Naršyklė nepalaiko geolokacijos."); return; }
    setNearbyLoading(true); setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc); setNearbyMode(true); setNearbyLoading(false);
        if (mapRef.current) {
          mapRef.current.panTo(loc); mapRef.current.setZoom(12);
          userDotRef.current?.setMap(null);
          userDotRef.current = new google.maps.Marker({ map: mapRef.current, position: loc, clickable: false, zIndex: 2000, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 } });
          userMarkerRef.current?.setMap(null);
          userMarkerRef.current = new google.maps.Circle({ map: mapRef.current, center: loc, radius: NEARBY_KM * 1000, strokeColor: "#adff2f", strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: "#adff2f", fillOpacity: 0.07 });
        }
      },
      err => { setNearbyLoading(false); setNearbyError(err.code === 1 ? "Leiskite prieigą prie vietos." : "Nepavyko nustatyti vietos."); },
      { timeout: 8000, maximumAge: 60000 },
    );
  };

  if (loadError || !API_KEY) {
    return (
      <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-border bg-muted flex flex-col items-center justify-center gap-4 p-6 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground/30" />
        <div>
          <p className="font-semibold text-foreground mb-1">Google Maps nepasiekiamas</p>
          <p className="text-sm text-muted-foreground">
            {!API_KEY ? "Reikalingas VITE_GOOGLE_MAPS_API_KEY konfigūracijos raktas." : "Nepavyko įkelti žemėlapio."}
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-border bg-muted animate-pulse flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Kraunamas žemėlapis...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[520px] z-0 relative rounded-2xl overflow-hidden border border-border shadow-sm">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={LITHUANIA_CENTER}
        zoom={7}
        onLoad={onLoad}
        onClick={() => setSelectedMatch(null)}
        options={{
          mapTypeId: mapType,
          styles: mapType === "roadmap" ? (theme === "dark" ? MAP_STYLES_DARK : MAP_STYLES_LIGHT) : undefined,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          gestureHandling: "greedy",
        }}
      >
        {selectedMatch && (
          <MatchInfoWindow match={selectedMatch} onClose={() => setSelectedMatch(null)} theme={theme} />
        )}
      </GoogleMap>

      {/* Map / Satellite toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex rounded-lg overflow-hidden border border-border shadow-md text-xs font-medium">
        {(["roadmap", "satellite"] as const).map(t => (
          <button key={t} onClick={() => setMapType(t)} className={`px-3 py-1.5 transition-colors ${mapType === t ? "bg-primary text-primary-foreground" : "bg-background/95 backdrop-blur text-foreground hover:bg-muted"}`}>
            {t === "roadmap" ? "Žemėlapis" : "Palydovas"}
          </button>
        ))}
      </div>

      {/* Nearby button */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5">
        <button
          onClick={handleNearby}
          disabled={nearbyLoading}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${nearbyMode ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" : "bg-background/95 backdrop-blur border-border text-foreground hover:bg-muted"} disabled:opacity-60`}
        >
          {nearbyLoading ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round"/>
            </svg>
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          {nearbyMode ? `Netoliese (${visibleMatches.length})` : "Netoliese"}
          {nearbyMode && <span className="ml-0.5 opacity-70">✕</span>}
        </button>
        {nearbyError && (
          <span className="rounded-lg bg-destructive/90 text-destructive-foreground text-[11px] px-2.5 py-1 shadow-md max-w-[180px] text-center leading-tight">
            {nearbyError}
          </span>
        )}
      </div>
    </div>
  );
}
