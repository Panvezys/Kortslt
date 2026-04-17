import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { GoogleMap, useJsApiLoader, InfoWindowF } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Court } from "@workspace/api-client-react";
import { resolveCourtImage } from "@/lib/imageUrl";
import { MapPin } from "lucide-react";
import { SportIcon, sportColor as SPORT_COLOR } from "@/components/sport-icon";
import { useTheme } from "./theme-provider";

const LITHUANIA_CENTER = { lat: 55.1694, lng: 23.8813 };
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/** SVG inner paths for each sport (24×24 viewBox, matching sport-icon.tsx) */
const sportIconPaths: Record<string, string> = {
  tennis: `
    <circle cx="12" cy="12" r="10"/>
    <path d="M5.2 6.5 C9 9.5 9 14.5 5.2 17.5"/>
    <path d="M18.8 6.5 C15 9.5 15 14.5 18.8 17.5"/>`,
  basketball: `
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2 C8.5 6 8.5 18 12 22"/>
    <path d="M12 2 C15.5 6 15.5 18 12 22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>`,
  padel: `
    <rect x="5" y="2" width="14" height="15" rx="3.5"/>
    <line x1="5" y1="7.5" x2="19" y2="7.5" stroke-width="0.9"/>
    <line x1="5" y1="11.5" x2="19" y2="11.5" stroke-width="0.9"/>
    <line x1="5" y1="14" x2="19" y2="14" stroke-width="0.9"/>
    <line x1="9.5" y1="2" x2="9.5" y2="17" stroke-width="0.9"/>
    <line x1="14.5" y1="2" x2="14.5" y2="17" stroke-width="0.9"/>
    <line x1="12" y1="17" x2="12" y2="23"/>
    <line x1="10" y1="23" x2="14" y2="23"/>`,
  football: `
    <circle cx="12" cy="12" r="10"/>
    <polygon points="12,7.5 15.9,10.2 14.4,14.3 9.6,14.3 8.1,10.2"/>
    <line x1="12" y1="7.5" x2="12" y2="2.1"/>
    <line x1="15.9" y1="10.2" x2="20.4" y2="8.7"/>
    <line x1="14.4" y1="14.3" x2="17.5" y2="18.5"/>
    <line x1="9.6" y1="14.3" x2="6.5" y2="18.5"/>
    <line x1="8.1" y1="10.2" x2="3.6" y2="8.7"/>`,
  badminton: `
    <circle cx="12" cy="20.5" r="1.8"/>
    <line x1="10.3" y1="18.8" x2="7.5" y2="9.5"/>
    <line x1="13.7" y1="18.8" x2="16.5" y2="9.5"/>
    <path d="M7.5 9.5 Q12 4.5 16.5 9.5"/>
    <line x1="8.2" y1="12" x2="15.8" y2="12" stroke-width="0.9"/>
    <line x1="8.8" y1="14.5" x2="15.2" y2="14.5" stroke-width="0.9"/>
    <line x1="9.5" y1="17" x2="14.5" y2="17" stroke-width="0.9"/>`,
  squash: `
    <ellipse cx="12" cy="9.5" rx="6" ry="7"/>
    <line x1="12" y1="16.5" x2="12" y2="22"/>
    <line x1="10.5" y1="21" x2="13.5" y2="21"/>
    <line x1="6" y1="9.5" x2="18" y2="9.5" stroke-width="0.9"/>
    <line x1="12" y1="2.5" x2="12" y2="16.5" stroke-width="0.9"/>
    <line x1="7" y1="6.5" x2="17" y2="6.5" stroke-width="0.9"/>
    <line x1="7" y1="12.5" x2="17" y2="12.5" stroke-width="0.9"/>
    <line x1="9" y1="3.5" x2="9" y2="15.5" stroke-width="0.9"/>
    <line x1="15" y1="3.5" x2="15" y2="15.5" stroke-width="0.9"/>`,
  table_tennis: `
    <circle cx="10" cy="10" r="8"/>
    <line x1="2.2" y1="10" x2="17.8" y2="10" stroke-width="0.9"/>
    <line x1="16" y1="16" x2="20.5" y2="21" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="21.5" cy="4" r="2"/>`,
  golf: `
    <line x1="8" y1="22" x2="8" y2="2"/>
    <path d="M8 2 L17.5 6 L8 10"/>
    <ellipse cx="8" cy="22" rx="4.5" ry="1.2"/>
    <circle cx="19.5" cy="18.5" r="2.5"/>`,
  snooker: `
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="4.5"/>
    <ellipse cx="12" cy="10.2" rx="1.8" ry="1.5"/>
    <ellipse cx="12" cy="13.7" rx="2.1" ry="1.8"/>`,
  bowling: `
    <circle cx="8" cy="15.5" r="6.5"/>
    <circle cx="6" cy="14" r="1" fill="white" stroke="none"/>
    <circle cx="9" cy="12.5" r="1" fill="white" stroke="none"/>
    <circle cx="11" cy="15.5" r="1" fill="white" stroke="none"/>
    <circle cx="19.5" cy="4.5" r="2"/>
    <path d="M17.5 6.5 Q17 9.5 17.5 12 L21.5 12 Q22 9.5 21.5 6.5 Z"/>
    <line x1="17.5" y1="12" x2="21.5" y2="12"/>`,
};


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

export const sportLithuanian: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

/**
 * Build a marker icon that matches the filter legend exactly:
 * colored circle + white sport icon centered at the natural (12,12) origin,
 * same strokeWidth=2 as the SportIcon components in the filter.
 */
function buildIconUrl(color: string, sport: string, isSelected: boolean): string {
  const size = isSelected ? 44 : 34;
  const border = isSelected ? 3 : 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - border / 2;

  const iconPx = size * 0.58;
  const iconScale = iconPx / 24;
  const tx = (cx - 12 * iconScale).toFixed(3);
  const ty = (cy - 12 * iconScale).toFixed(3);
  const sw = (2 / iconScale).toFixed(2);

  const paths = sportIconPaths[sport] ?? sportIconPaths["tennis"];

  // Plain circle — no filter/shadow so there is zero gray bleed outside the circle
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="${border}"/>
  <g transform="translate(${tx},${ty}) scale(${iconScale.toFixed(4)})" fill="none" stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Pre-compute all icon variants once — 6 sports × 2 states = 12 icons */
function buildIconCache(): Record<string, { normal: google.maps.Icon; selected: google.maps.Icon }> {
  const cache: Record<string, { normal: google.maps.Icon; selected: google.maps.Icon }> = {};
  for (const [sport, color] of Object.entries(SPORT_COLOR)) {
    cache[sport] = {
      normal: {
        url: buildIconUrl(color, sport, false),
        scaledSize: new google.maps.Size(34, 34),
        anchor: new google.maps.Point(17, 17),
      },
      selected: {
        url: buildIconUrl(color, sport, true),
        scaledSize: new google.maps.Size(44, 44),
        anchor: new google.maps.Point(22, 22),
      },
    };
  }
  return cache;
}

interface CourtInfoWindowProps {
  court: Court;
  onClose: () => void;
  theme: "light" | "dark";
}

/** Inject once — strips ALL Google InfoWindow chrome globally */
function useInfoWindowStyles() {
  useEffect(() => {
    const id = "gm-iw-overrides";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .gm-style-iw-c {
        padding: 0 !important;
        overflow: hidden !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.28) !important;
        top: 0 !important;
      }
      .gm-style-iw-d {
        overflow: hidden !important;
        padding: 0 !important;
        max-height: none !important;
      }
      .gm-style-iw-d > div {
        overflow: hidden !important;
      }
      /* Header row that reserves space for the close button */
      .gm-style-iw-ch {
        display: none !important;
        height: 0 !important;
        padding: 0 !important;
      }
      .gm-style-iw-t::after { display: none !important; }
      button.gm-ui-hover-effect { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

function CourtInfoWindow({ court, onClose, theme }: CourtInfoWindowProps) {
  useInfoWindowStyles();
  const color = SPORT_COLOR[court.type] ?? "#84cc16";
  const img = resolveCourtImage(court.imageUrl);
  const isDark = theme === "dark";
  const bg = isDark ? "#0d0f14" : "#ffffff";
  const textPrimary = isDark ? "#f9fafb" : "#111827";
  const textSecondary = isDark ? "#9ca3af" : "#6b7280";
  const indoorBg = isDark ? "#1f2937" : "#f3f4f6";
  const indoorText = isDark ? "#d1d5db" : "#374151";

  const paths = sportIconPaths[court.type] ?? sportIconPaths["tennis"];
  const sportSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const sportSvgUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(sportSvg)}`;

  return (
    <InfoWindowF
      position={{ lat: court.latitude, lng: court.longitude }}
      onCloseClick={onClose}
      options={{
        pixelOffset: new google.maps.Size(0, -22),
        disableAutoPan: false,
        maxWidth: 220,
      }}
    >
      {/* InfoWindowF requires exactly one child element */}
      <div
        style={{
          width: "220px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: bg,
          color: textPrimary,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {/* Photo with close button overlaid */}
        <div style={{ position: "relative", width: "100%", height: img ? "110px" : "0px", overflow: "hidden" }}>
          {img && (
            <img
              src={img}
              alt={court.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          )}
          {/* Custom close button inside/over photo */}
          <button
            onClick={onClose}
            title="Uždaryti"
            style={{
              position: "absolute",
              top: "7px",
              right: "7px",
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.55)",
              border: "1.5px solid rgba(255,255,255,0.25)",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              lineHeight: 1,
              transition: "background 0.15s, transform 0.15s",
              backdropFilter: "blur(4px)",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.55)";
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* Name + close (if no photo) */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", lineHeight: "1.35", color: textPrimary, flex: 1 }}>
              {court.name}
            </div>
            {!img && (
              <button
                onClick={onClose}
                title="Uždaryti"
                style={{
                  width: "22px", height: "22px", borderRadius: "50%",
                  background: isDark ? "#374151" : "#f3f4f6",
                  border: "none", color: textSecondary, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", flexShrink: 0, transition: "background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "#4b5563" : "#e5e7eb"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "#374151" : "#f3f4f6"; }}
              >
                ✕
              </button>
            )}
          </div>

          {/* City */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: textSecondary }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>{court.city}</span>
          </div>

          {/* Sport badge with icon + optional indoor + verified */}
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              background: color, color: "white",
              padding: "3px 8px 3px 6px", borderRadius: "999px",
              fontSize: "11px", fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: "5px",
            }}>
              <img src={sportSvgUrl} alt="" width="13" height="13" style={{ display: "block" }} />
              {sportLithuanian[court.type] ?? court.type}
            </span>
            {court.isIndoor && (
              <span style={{
                background: indoorBg, color: indoorText,
                padding: "3px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 500,
              }}>
                Vidaus
              </span>
            )}
            {(court as any).facilityVerified && (
              <span style={{
                background: "rgba(59,130,246,0.15)", color: "#60a5fa",
                border: "1px solid rgba(59,130,246,0.3)",
                padding: "3px 7px", borderRadius: "999px", fontSize: "10px", fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: "4px",
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                Patvirtinta
              </span>
            )}
          </div>

          {/* Rating */}
          {court.rating ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              <span style={{ color: "#facc15" }}>★</span>
              <span style={{ fontWeight: 700, color: textPrimary }}>{court.rating.toFixed(1)}</span>
            </div>
          ) : null}

          {/* Price + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
            <span style={{ fontWeight: 700, color, fontSize: "15px" }}>
              <span style={{ color: textSecondary, fontSize: "10px", fontWeight: 400, marginRight: "2px" }}>nuo</span>{court.pricePerHour}€
              <span style={{ color: textSecondary, fontSize: "11px", fontWeight: 400 }}>/val</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <a
                href={`/courts/${court.id}`}
                aria-label="Peržiūrėti"
                title="Peržiūrėti"
                style={{
                  border: `1px solid ${color}`, color: color,
                  width: "28px", height: "28px", borderRadius: "8px",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  textDecoration: "none",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = color + "18";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.05)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </a>
              <a
                href={`/courts/${court.id}#reserve`}
                style={{
                  background: color, color: "black",
                  padding: "5px 12px", borderRadius: "8px",
                  fontSize: "11px", fontWeight: 700, textDecoration: "none", display: "inline-block",
                  transition: "filter 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1.12)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.04)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
                }}
              >
                Rezervuoti
              </a>
            </div>
          </div>
        </div>
      </div>
    </InfoWindowF>
  );
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const LIBRARIES: ("places")[] = ["places"];
const ALL_SPORTS = Object.keys(sportLithuanian);

export function CourtMap({
  courts,
  activeSports: activeSportsProp,
  showFilterPanel = false,
}: {
  courts: Court[];
  activeSports?: Set<string>;
  showFilterPanel?: boolean;
}) {
  const { theme } = useTheme();
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [mapReady, setMapReady] = useState(false);
  const [internalActiveSports, setInternalActiveSports] = useState<Set<string>>(new Set(ALL_SPORTS));
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);

  const activeSports = activeSportsProp ?? (showFilterPanel ? internalActiveSports : new Set(ALL_SPORTS));

  // Strip any background Google Maps may paint behind SVG marker img elements
  useEffect(() => {
    const id = "gm-marker-bg-fix";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `.gm-style img[src^="data:image/svg"] { background: transparent !important; background-color: transparent !important; }`;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const toggleSportInternal = (sport: string) => {
    setInternalActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) {
        if (next.size === 1) return prev;
        next.delete(sport);
      } else {
        next.add(sport);
      }
      if (selectedCourt && !next.has(selectedCourt.type)) setSelectedCourt(null);
      return next;
    });
  };
  const allInternalActive = internalActiveSports.size === ALL_SPORTS.length;

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const iconCacheRef = useRef<ReturnType<typeof buildIconCache> | null>(null);

  const visibleCourts = useMemo(
    () => (Array.isArray(courts) ? courts : []).filter(c => activeSports.has(c.type)),
    [courts, activeSports]
  );

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const fitBounds = useCallback((map: google.maps.Map, list: Court[]) => {
    if (list.length === 0) {
      map.setCenter(LITHUANIA_CENTER);
      map.setZoom(7);
    } else if (list.length === 1) {
      map.setCenter({ lat: list[0].latitude, lng: list[0].longitude });
      map.setZoom(13);
    } else {
      const bounds = new google.maps.LatLngBounds();
      list.forEach(c => bounds.extend({ lat: c.latitude, lng: c.longitude }));
      map.fitBounds(bounds, 60);
    }
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // Build icon cache once Google Maps is ready
    iconCacheRef.current = buildIconCache();
    // Init clusterer
    clustererRef.current = new MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render({ count, position }) {
          return new google.maps.Marker({
            position,
            label: {
              text: String(count),
              color: "#000",
              fontSize: "12px",
              fontWeight: "700",
            },
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="19" fill="#adff2f" stroke="white" stroke-width="2.5"/>
                </svg>`
              )}`,
              scaledSize: new google.maps.Size(42, 42),
              anchor: new google.maps.Point(21, 21),
            },
            zIndex: 1000,
          });
        },
      },
    });
    fitBounds(map, courts);

    // Load Lithuania border and grey-out surrounding countries
    fetch("https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/lithuania.geojson")
      .then(r => r.json())
      .then((geoJson: any) => {
        if (!mapRef.current) return;
        const feature = geoJson.features?.[0];
        if (!feature) return;
        const geom = feature.geometry;
        let outerRing: number[][];
        if (geom.type === "Polygon") {
          outerRing = geom.coordinates[0];
        } else if (geom.type === "MultiPolygon") {
          outerRing = geom.coordinates[0][0];
        } else return;

        // World bounding box (counter-clockwise outer ring)
        const worldBbox = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
        // Lithuania ring reversed → clockwise hole
        const hole = [...outerRing].reverse();

        map.data.addGeoJson({
          type: "FeatureCollection",
          features: [
            // Grey veil over everything outside Lithuania
            {
              type: "Feature",
              properties: { kind: "overlay" },
              geometry: { type: "Polygon", coordinates: [worldBbox, hole] },
            },
            // Lithuania border highlight
            {
              type: "Feature",
              properties: { kind: "border" },
              geometry: geom,
            },
          ],
        });

        map.data.setStyle((f: google.maps.Data.Feature) => {
          const kind = f.getProperty("kind");
          if (kind === "overlay") {
            return { fillColor: "#0d0f14", fillOpacity: 0.55, strokeOpacity: 0, clickable: false, zIndex: 1 };
          }
          if (kind === "border") {
            return { fillOpacity: 0, strokeColor: "#adff2f", strokeWeight: 1.5, strokeOpacity: 0.45, clickable: false, zIndex: 2 };
          }
          return {};
        });
      })
      .catch(() => { /* non-critical — map still works without overlay */ });

    setMapReady(true);
  }, [courts, fitBounds]);

  // Imperatively manage markers — no React component per marker
  useEffect(() => {
    if (!mapRef.current || !iconCacheRef.current || !clustererRef.current) return;

    const map = mapRef.current;
    const icons = iconCacheRef.current;
    const clusterer = clustererRef.current;
    const visibleIds = new Set(visibleCourts.map(c => c.id));
    const currentIds = new Set(markersRef.current.keys());

    // Remove markers no longer visible
    const toRemove: google.maps.Marker[] = [];
    for (const [id, marker] of markersRef.current.entries()) {
      if (!visibleIds.has(id)) {
        marker.setMap(null);
        toRemove.push(marker);
        markersRef.current.delete(id);
      }
    }
    if (toRemove.length) clusterer.removeMarkers(toRemove);

    // Add new markers
    const toAdd: google.maps.Marker[] = [];
    for (const court of visibleCourts) {
      if (currentIds.has(court.id)) continue;
      const sportIcons = icons[court.type] ?? icons["tennis"];
      const marker = new google.maps.Marker({
        position: { lat: court.latitude, lng: court.longitude },
        icon: sportIcons.normal,
        title: court.name,
        zIndex: 1,
      });
      marker.addListener("click", () => {
        setSelectedCourt(prev => (prev?.id === court.id ? null : court));
      });
      markersRef.current.set(court.id, marker);
      toAdd.push(marker);
    }
    if (toAdd.length) clusterer.addMarkers(toAdd);
  }, [visibleCourts, mapReady]);

  // Update selected marker icon when selection changes
  useEffect(() => {
    if (!iconCacheRef.current) return;
    const icons = iconCacheRef.current;
    for (const [id, marker] of markersRef.current.entries()) {
      const court = visibleCourts.find(c => c.id === id);
      if (!court) continue;
      const sportIcons = icons[court.type] ?? icons["tennis"];
      const isSelected = selectedCourt?.id === id;
      marker.setIcon(isSelected ? sportIcons.selected : sportIcons.normal);
      marker.setZIndex(isSelected ? 999 : 1);
    }
  }, [selectedCourt, visibleCourts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.setMap(null);
      }
      markersRef.current.clear();
      clustererRef.current?.clearMarkers();
    };
  }, []);

  // Update map styles when theme or mapType changes
  useEffect(() => {
    if (!mapRef.current) return;
    const styles = mapType === "roadmap"
      ? (theme === "dark" ? MAP_STYLES_DARK : MAP_STYLES_LIGHT)
      : undefined;
    mapRef.current.setOptions({ styles });
  }, [theme, mapType]);


  if (loadError || !API_KEY) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border/50 bg-muted flex flex-col items-center justify-center gap-4 p-6 text-center">
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
      <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border/50 bg-muted animate-pulse flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Kraunamas žemėlapis...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] z-0 relative rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={LITHUANIA_CENTER}
        zoom={7}
        onLoad={onLoad}
        onClick={() => setSelectedCourt(null)}
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
        {selectedCourt && (
          <CourtInfoWindow court={selectedCourt} onClose={() => setSelectedCourt(null)} theme={theme} />
        )}
      </GoogleMap>

      {/* Map / Satellite toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex rounded-lg overflow-hidden border border-border shadow-md text-xs font-medium">
        {(["roadmap", "satellite"] as const).map(t => (
          <button
            key={t}
            onClick={() => setMapType(t)}
            className={`px-3 py-1.5 transition-colors ${
              mapType === t
                ? "bg-primary text-primary-foreground"
                : "bg-background/95 backdrop-blur text-foreground hover:bg-muted"
            }`}
          >
            {t === "roadmap" ? "Žemėlapis" : "Palydovas"}
          </button>
        ))}
      </div>

      {/* Sport filter panel — shown when showFilterPanel is true */}
      {showFilterPanel && (
        <div className="absolute top-3 left-3 z-[1000] bg-background/95 backdrop-blur border border-border rounded-xl shadow-xl text-xs min-w-[130px]">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <button
              onClick={() => setFilterPanelOpen(o => !o)}
              className="flex items-center gap-1.5 group"
            >
              <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">Sportas</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`text-muted-foreground transition-transform duration-200 ${filterPanelOpen ? "rotate-0" : "-rotate-90"}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {filterPanelOpen && (
              <button
                onClick={() => setInternalActiveSports(allInternalActive ? new Set() : new Set(ALL_SPORTS))}
                className="text-[9px] font-medium text-primary hover:underline ml-2"
              >
                {allInternalActive ? "Slėpti" : "Visi"}
              </button>
            )}
          </div>
          {filterPanelOpen && (
            <div className="px-2 pb-2 space-y-0.5 border-t border-border/50 pt-1.5">
              {ALL_SPORTS.map(sport => {
                const active = internalActiveSports.has(sport);
                const color = SPORT_COLOR[sport];
                const count = (Array.isArray(courts) ? courts : []).filter(c => c.type === sport).length;
                return (
                  <button
                    key={sport}
                    onClick={() => toggleSportInternal(sport)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left ${
                      active ? "bg-muted/60 hover:bg-muted" : "opacity-40 hover:opacity-60 hover:bg-muted/30"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{ background: active ? color : "transparent", borderColor: color }}
                    >
                      <SportIcon sport={sport} size={9} strokeWidth={2} style={{ color: active ? "white" : color }} />
                    </div>
                    <span className={`flex-1 font-medium transition-colors text-[11px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {sportLithuanian[sport]}
                    </span>
                    <span className={`text-[10px] tabular-nums ${active ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
