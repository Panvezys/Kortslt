import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { GoogleMap, useJsApiLoader, InfoWindowF } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { resolveCourtImage } from "@/lib/imageUrl";
import { MapPin } from "lucide-react";
import { SportIcon, sportColor as SPORT_COLOR, sportAbbr } from "@/components/sport-icon";
// sportAbbr kept for InfoWindow display

const LITHUANIA_CENTER = { lat: 55.1694, lng: 23.8813 };
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/** SVG inner paths for each sport (24×24 viewBox, matching sport-icon.tsx) */
const sportIconPaths: Record<string, string> = {
  tennis: `
    <ellipse cx="11.5" cy="9.5" rx="7" ry="7.5"/>
    <line x1="11.5" y1="2" x2="11.5" y2="17" stroke-width="1.6"/>
    <line x1="4.5" y1="9.5" x2="18.5" y2="9.5" stroke-width="1.6"/>
    <line x1="5.5" y1="6" x2="17.5" y2="6" stroke-width="0.9"/>
    <line x1="5.5" y1="13" x2="17.5" y2="13" stroke-width="0.9"/>
    <line x1="8" y1="2.5" x2="8" y2="16.5" stroke-width="0.9"/>
    <line x1="15" y1="2.5" x2="15" y2="16.5" stroke-width="0.9"/>
    <line x1="11.5" y1="17" x2="14" y2="23"/>`,
  basketball: `
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2 C9 6 9 18 12 22"/>
    <path d="M12 2 C15 6 15 18 12 22"/>
    <path d="M2 11.5 Q7 9.5 12 11.5 Q17 9.5 22 11.5"/>`,
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
    <polygon points="12,7.5 15,10 14,13.5 10,13.5 9,10" fill="rgba(255,255,255,0.25)" stroke="white" stroke-width="1.6"/>
    <line x1="12" y1="2" x2="12" y2="7.5"/>
    <line x1="15" y1="10" x2="20.5" y2="8.5"/>
    <line x1="14" y1="13.5" x2="18" y2="17.5"/>
    <line x1="10" y1="13.5" x2="6" y2="17.5"/>
    <line x1="9" y1="10" x2="3.5" y2="8.5"/>`,
  badminton: `
    <circle cx="12" cy="20.5" r="1.8"/>
    <line x1="12" y1="18.7" x2="5" y2="8"/>
    <line x1="12" y1="18.7" x2="12" y2="5"/>
    <line x1="12" y1="18.7" x2="19" y2="8"/>
    <line x1="12" y1="18.7" x2="7.5" y2="6"/>
    <line x1="12" y1="18.7" x2="16.5" y2="6"/>
    <path d="M5 8 Q8.5 4.5 12 5 Q15.5 4.5 19 8"/>`,
  squash: `
    <circle cx="12" cy="9" r="6.5"/>
    <line x1="12" y1="2.5" x2="12" y2="15.5"/>
    <line x1="5.5" y1="9" x2="18.5" y2="9"/>
    <line x1="7.5" y1="4.5" x2="7.5" y2="13.5" stroke-width="0.9"/>
    <line x1="16.5" y1="4.5" x2="16.5" y2="13.5" stroke-width="0.9"/>
    <line x1="6.5" y1="6.5" x2="17.5" y2="6.5" stroke-width="0.9"/>
    <line x1="6.5" y1="11.5" x2="17.5" y2="11.5" stroke-width="0.9"/>
    <line x1="12" y1="15.5" x2="12" y2="22"/>
    <line x1="10" y1="22" x2="14" y2="22"/>`,
};


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

const sportLithuanian: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Squash",
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

  // Scale icon to occupy ~58% of the total marker diameter (matches filter proportions)
  const iconPx = size * 0.58;
  const iconScale = iconPx / 24;
  const tx = (cx - 12 * iconScale).toFixed(3);
  const ty = (cy - 12 * iconScale).toFixed(3);
  // Pre-scale strokeWidth=2 so after the transform it renders as ~2px (matching filter)
  const sw = (2 / iconScale).toFixed(2);

  const paths = sportIconPaths[sport] ?? sportIconPaths["tennis"];

  const shadow = isSelected
    ? `filter:drop-shadow(0 0 6px ${color}80) drop-shadow(0 4px 10px rgba(0,0,0,0.6))`
    : `filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45))`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="${shadow}">
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
}

function CourtInfoWindow({ court, onClose }: CourtInfoWindowProps) {
  const color = SPORT_COLOR[court.type] ?? "#84cc16";
  const img = resolveCourtImage(court.imageUrl);
  return (
    <InfoWindowF
      position={{ lat: court.latitude, lng: court.longitude }}
      onCloseClick={onClose}
      options={{ pixelOffset: new google.maps.Size(0, -20), disableAutoPan: false }}
    >
      <div
        className="overflow-hidden rounded-lg"
        style={{ width: "200px", fontFamily: "inherit", background: "hsl(224 71% 4%)", color: "white" }}
      >
        {img && (
          <div style={{ width: "100%", height: "100px", overflow: "hidden" }}>
            <img src={img} alt={court.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", lineHeight: "1.3", color: "white" }}>
            {court.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" }}>
            <span style={{ fontSize: "10px" }}>▸</span>
            <span>{court.city}</span>
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <span style={{
              background: color, color: "white",
              padding: "2px 8px", borderRadius: "999px",
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
            }}>
              {sportAbbr[court.type] ?? "—"} · {sportLithuanian[court.type] ?? court.type}
            </span>
            {court.isIndoor && (
              <span style={{
                background: "#374151", color: "#d1d5db",
                padding: "2px 8px", borderRadius: "999px", fontSize: "11px",
              }}>
                Indoor
              </span>
            )}
          </div>
          {court.rating ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              <span style={{ color: "#facc15" }}>★</span>
              <span style={{ fontWeight: 700, color: "white" }}>{court.rating.toFixed(1)}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
            <span style={{ fontWeight: 700, color, fontSize: "14px" }}>
              {court.pricePerHour}€
              <span style={{ color: "#9ca3af", fontSize: "11px", fontWeight: 400 }}>/val</span>
            </span>
            <a href={`/courts/${court.id}`} style={{
              background: color, color: "black",
              padding: "5px 12px", borderRadius: "8px",
              fontSize: "11px", fontWeight: 700, textDecoration: "none", display: "inline-block",
            }}>
              Rezervuoti
            </a>
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
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [mapReady, setMapReady] = useState(false);
  const [internalActiveSports, setInternalActiveSports] = useState<Set<string>>(new Set(ALL_SPORTS));
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);

  const activeSports = activeSportsProp ?? (showFilterPanel ? internalActiveSports : new Set(ALL_SPORTS));

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
          styles: mapType === "roadmap" ? MAP_STYLES_DARK : undefined,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          gestureHandling: "greedy",
        }}
      >
        {selectedCourt && (
          <CourtInfoWindow court={selectedCourt} onClose={() => setSelectedCourt(null)} />
        )}
      </GoogleMap>

      {/* Map / Satellite toggle */}
      <div className="absolute top-3 right-3 z-[1000] flex rounded-lg overflow-hidden border border-border shadow-md text-xs font-medium">
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
                onClick={() => setInternalActiveSports(allInternalActive ? new Set(["tennis"]) : new Set(ALL_SPORTS))}
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
