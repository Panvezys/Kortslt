import { useCallback, useRef, useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";
import { resolveCourtImage } from "@/lib/imageUrl";
import { Star, MapPin } from "lucide-react";
import { SportIcon, sportColor as SPORT_COLOR, sportAbbr } from "@/components/sport-icon";

const LITHUANIA_CENTER = { lat: 55.1694, lng: 23.8813 };
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

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

function createMarkerIcon(
  color: string,
  abbr: string,
  isSelected: boolean
): google.maps.Icon {
  const size = isSelected ? 44 : 36;
  const border = isSelected ? 3 : 2.5;
  const fontSize = isSelected ? 11 : 9;
  const shadow = isSelected
    ? `filter: drop-shadow(0 0 6px ${color}80) drop-shadow(0 3px 8px rgba(0,0,0,0.5))`
    : `filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4))`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="${shadow}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - border / 2}" fill="${color}" stroke="white" stroke-width="${border}"/>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.4}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="700" font-family="system-ui,sans-serif" fill="white" letter-spacing="0.5">${abbr}</text>
</svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
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
      options={{
        pixelOffset: new google.maps.Size(0, -20),
        disableAutoPan: false,
      }}
    >
      <div
        className="overflow-hidden rounded-lg"
        style={{ width: "200px", fontFamily: "inherit", background: "hsl(224 71% 4%)", color: "white" }}
      >
        {img && (
          <div style={{ width: "100%", height: "100px", overflow: "hidden" }}>
            <img
              src={img}
              alt={court.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
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
            <span
              style={{
                background: color,
                color: "white",
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              {sportAbbr[court.type] ?? "—"} · {sportLithuanian[court.type] ?? court.type}
            </span>
            {court.isIndoor && (
              <span
                style={{
                  background: "#374151",
                  color: "#d1d5db",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                }}
              >
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
            <a
              href={`/courts/${court.id}`}
              style={{
                background: color,
                color: "black",
                padding: "5px 12px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Rezervuoti
            </a>
          </div>
        </div>
      </div>
    </InfoWindowF>
  );
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const LIBRARIES: ("places")[] = [];

const ALL_SPORTS = Object.keys(sportLithuanian);

export function CourtMap({ courts }: { courts: Court[] }) {
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [activeSports, setActiveSports] = useState<Set<string>>(new Set(ALL_SPORTS));
  const mapRef = useRef<google.maps.Map | null>(null);

  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) {
        // Don't allow deselecting the last one
        if (next.size === 1) return prev;
        next.delete(sport);
      } else {
        next.add(sport);
      }
      // Clear selected court if its sport is toggled off
      if (selectedCourt && !next.has(selectedCourt.type)) {
        setSelectedCourt(null);
      }
      return next;
    });
  };

  const allActive = activeSports.size === ALL_SPORTS.length;
  const toggleAll = () => {
    if (allActive) {
      // keep at least one — just set to first
      setActiveSports(new Set([ALL_SPORTS[0]]));
    } else {
      setActiveSports(new Set(ALL_SPORTS));
    }
    setSelectedCourt(null);
  };

  const visibleCourts = courts.filter(c => activeSports.has(c.type));

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
    fitBounds(map, courts);
  }, [courts, fitBounds]);

  useEffect(() => {
    if (mapRef.current) fitBounds(mapRef.current, courts);
  }, [courts, fitBounds]);

  if (loadError || !API_KEY) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border/50 bg-muted flex flex-col items-center justify-center gap-4 p-6 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground/30" />
        <div>
          <p className="font-semibold text-foreground mb-1">Google Maps nepasiekiamas</p>
          <p className="text-sm text-muted-foreground">
            {!API_KEY
              ? "Reikalingas VITE_GOOGLE_MAPS_API_KEY konfigūracijos raktas."
              : "Nepavyko įkelti žemėlapio. Patikrinkite API raktą."}
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
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          gestureHandling: "greedy",
        }}
      >
        {visibleCourts.map((court) => {
          const color = SPORT_COLOR[court.type] ?? "#84cc16";
          const abbr = sportAbbr[court.type] ?? "—";
          const isSelected = selectedCourt?.id === court.id;

          return (
            <MarkerF
              key={court.id}
              position={{ lat: court.latitude, lng: court.longitude }}
              icon={createMarkerIcon(color, abbr, isSelected)}
              onClick={() =>
                setSelectedCourt(prev => (prev?.id === court.id ? null : court))
              }
              zIndex={isSelected ? 999 : 1}
            />
          );
        })}

        {selectedCourt && (
          <CourtInfoWindow
            court={selectedCourt}
            onClose={() => setSelectedCourt(null)}
          />
        )}
      </GoogleMap>

      {/* Map / Satellite toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex rounded-lg overflow-hidden border border-border shadow-md text-xs font-medium">
        <button
          onClick={() => setMapType("roadmap")}
          className={`px-3 py-1.5 transition-colors ${
            mapType === "roadmap"
              ? "bg-primary text-primary-foreground"
              : "bg-background/95 backdrop-blur text-foreground hover:bg-muted"
          }`}
        >
          Žemėlapis
        </button>
        <button
          onClick={() => setMapType("satellite")}
          className={`px-3 py-1.5 transition-colors ${
            mapType === "satellite"
              ? "bg-primary text-primary-foreground"
              : "bg-background/95 backdrop-blur text-foreground hover:bg-muted"
          }`}
        >
          Palydovas
        </button>
      </div>

      {/* Legend / Sport filter */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-background/95 backdrop-blur border border-border rounded-xl p-3 text-xs shadow-xl min-w-[140px]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">Filtras</span>
          <button
            onClick={toggleAll}
            className="text-[10px] font-medium text-primary hover:underline ml-2"
          >
            {allActive ? "Slėpti viską" : "Rodyti viską"}
          </button>
        </div>
        <div className="space-y-1">
          {ALL_SPORTS.map((sport) => {
            const active = activeSports.has(sport);
            const color = SPORT_COLOR[sport];
            const count = courts.filter(c => c.type === sport).length;
            return (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left group ${
                  active
                    ? "bg-muted/60 hover:bg-muted"
                    : "opacity-40 hover:opacity-70 hover:bg-muted/30"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: active ? color : "transparent",
                    borderColor: color,
                  }}
                >
                  <SportIcon
                    sport={sport}
                    size={11}
                    strokeWidth={2}
                    style={{ color: active ? "white" : color }}
                  />
                </div>
                <span className={`flex-1 font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {sportLithuanian[sport]}
                </span>
                <span className={`text-[10px] tabular-nums ${active ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {activeSports.size < ALL_SPORTS.length && (
          <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground text-center">
            {visibleCourts.length} iš {courts.length} kortų
          </div>
        )}
      </div>
    </div>
  );
}
