import { useCallback, useRef, useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";
import { resolveCourtImage } from "@/lib/imageUrl";
import { Star, MapPin } from "lucide-react";

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

const sportEmoji: Record<string, string> = {
  tennis: "🎾", basketball: "🏀", padel: "🏓",
  football: "⚽", badminton: "🏸", squash: "🎯",
};

const sportColor: Record<string, string> = {
  tennis: "#84cc16",
  basketball: "#f97316",
  padel: "#3b82f6",
  football: "#22c55e",
  badminton: "#a855f7",
  squash: "#06b6d4",
};

const sportLithuanian: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Squash",
};

function createMarkerIcon(
  color: string,
  emoji: string,
  isSelected: boolean
): google.maps.Icon {
  const size = isSelected ? 44 : 36;
  const border = isSelected ? 3 : 2.5;
  const fontSize = isSelected ? 20 : 16;
  const shadow = isSelected
    ? `filter: drop-shadow(0 0 6px ${color}80) drop-shadow(0 3px 8px rgba(0,0,0,0.5))`
    : `filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4))`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="${shadow}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - border / 2}" fill="${color}" stroke="white" stroke-width="${border}"/>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.35}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}">${emoji}</text>
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
  const color = sportColor[court.type] ?? "#84cc16";
  const emoji = sportEmoji[court.type] ?? "🏟";
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
            <span>📍</span>
            <span>{court.city}</span>
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <span
              style={{
                background: color,
                color: "black",
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {emoji} {sportLithuanian[court.type] ?? court.type}
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

export function CourtMap({ courts }: { courts: Court[] }) {
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const mapRef = useRef<google.maps.Map | null>(null);

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
        {courts.map((court) => {
          const color = sportColor[court.type] ?? "#84cc16";
          const emoji = sportEmoji[court.type] ?? "🏟";
          const isSelected = selectedCourt?.id === court.id;

          return (
            <MarkerF
              key={court.id}
              position={{ lat: court.latitude, lng: court.longitude }}
              icon={createMarkerIcon(color, emoji, isSelected)}
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

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-background/95 backdrop-blur border border-border rounded-lg p-3 text-xs shadow-lg space-y-1.5">
        <div className="font-semibold text-xs mb-2 text-muted-foreground uppercase tracking-wide">Sporto aikštelės</div>
        {Object.entries(sportEmoji).map(([sport, emoji]) => (
          <div key={sport} className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs"
              style={{ background: sportColor[sport] }}
            >
              <span style={{ fontSize: "10px" }}>{emoji}</span>
            </div>
            <span>{sportLithuanian[sport]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
