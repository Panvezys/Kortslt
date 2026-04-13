import { useCallback, useRef, useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
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

const MAP_STYLES_LIGHT: google.maps.MapTypeStyle[] = [];

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

function getRatingColor(rating?: number | null): string {
  if (!rating) return "#94a3b8";
  if (rating >= 4.5) return "#84cc16";
  if (rating >= 3.5) return "#22c55e";
  if (rating >= 2.5) return "#eab308";
  if (rating >= 1.5) return "#f97316";
  return "#ef4444";
}

interface CourtMarkerProps {
  court: Court;
  isSelected: boolean;
  onClick: (court: Court) => void;
}

function CourtMarker({ court, isSelected, onClick }: CourtMarkerProps) {
  const color = sportColor[court.type] ?? "#84cc16";
  const emoji = sportEmoji[court.type] ?? "🏟";

  return (
    <OverlayView
      position={{ lat: court.latitude, lng: court.longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        onClick={() => onClick(court)}
        className="cursor-pointer select-none"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <div
          style={{
            background: color,
            width: isSelected ? "42px" : "34px",
            height: isSelected ? "42px" : "34px",
            borderRadius: "50%",
            border: isSelected ? "3px solid white" : "2.5px solid white",
            boxShadow: isSelected
              ? `0 0 0 3px ${color}60, 0 4px 16px rgba(0,0,0,0.5)`
              : "0 2px 8px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isSelected ? "18px" : "14px",
            transition: "all 0.18s ease",
          }}
        >
          {emoji}
        </div>
        {isSelected && (
          <div
            style={{
              width: "10px",
              height: "10px",
              background: color,
              borderRadius: "50%",
              margin: "2px auto 0",
              opacity: 0.6,
            }}
          />
        )}
      </div>
    </OverlayView>
  );
}

interface CourtPopupProps {
  court: Court;
  onClose: () => void;
}

function CourtPopup({ court, onClose }: CourtPopupProps) {
  const color = sportColor[court.type] ?? "#84cc16";
  const img = resolveCourtImage(court.imageUrl);

  return (
    <OverlayView
      position={{ lat: court.latitude, lng: court.longitude }}
      mapPaneName={OverlayView.FLOAT_PANE}
    >
      <div
        style={{ transform: "translate(-50%, -110%)", marginTop: "-14px" }}
        className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden w-52 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {img && (
          <div className="w-full h-28 overflow-hidden">
            <img src={img} alt={court.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <div className="font-bold text-sm leading-tight">{court.name}</div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none ml-1 shrink-0"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {court.city}
          </div>
          <div className="flex flex-wrap gap-1">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ background: color }}
            >
              {sportEmoji[court.type]} {court.type}
            </span>
            {court.isIndoor && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                Indoor
              </span>
            )}
          </div>
          {court.rating ? (
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">{court.rating.toFixed(1)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold" style={{ color }}>
              {court.pricePerHour}€<span className="text-muted-foreground text-xs font-normal">/val</span>
            </span>
            <Link href={`/courts/${court.id}`}>
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer text-black"
                style={{ background: color }}
              >
                Rezervuoti
              </span>
            </Link>
          </div>
        </div>
        {/* Arrow */}
        <div
          style={{
            position: "absolute",
            bottom: "-7px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "8px solid var(--border)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-5px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "7px solid hsl(var(--card))",
          }}
        />
      </div>
    </OverlayView>
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

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    if (courts.length === 0) {
      map.setCenter(LITHUANIA_CENTER);
      map.setZoom(7);
      return;
    }
    if (courts.length === 1) {
      map.setCenter({ lat: courts[0].latitude, lng: courts[0].longitude });
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    courts.forEach(c => bounds.extend({ lat: c.latitude, lng: c.longitude }));
    map.fitBounds(bounds, 60);
  }, [courts]);

  useEffect(() => {
    if (!mapRef.current || courts.length === 0) return;
    if (courts.length === 1) {
      mapRef.current.setCenter({ lat: courts[0].latitude, lng: courts[0].longitude });
      mapRef.current.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    courts.forEach(c => bounds.extend({ lat: c.latitude, lng: c.longitude }));
    mapRef.current.fitBounds(bounds, 60);
  }, [courts]);

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
        {courts.map((court) => (
          <CourtMarker
            key={court.id}
            court={court}
            isSelected={selectedCourt?.id === court.id}
            onClick={(c) => setSelectedCourt(prev => prev?.id === c.id ? null : c)}
          />
        ))}
        {selectedCourt && (
          <CourtPopup
            court={selectedCourt}
            onClose={() => setSelectedCourt(null)}
          />
        )}
      </GoogleMap>

      {/* Map/Satellite toggle */}
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
        <div className="font-semibold text-xs mb-2 text-muted-foreground uppercase tracking-wide">Įvertinimas</div>
        {[
          { color: "#84cc16", label: "4.5 – 5.0 ★★★★★" },
          { color: "#22c55e", label: "3.5 – 4.4 ★★★★" },
          { color: "#eab308", label: "2.5 – 3.4 ★★★" },
          { color: "#f97316", label: "1.5 – 2.4 ★★" },
          { color: "#94a3b8", label: "Nėra įvertinimų" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="border-t border-border pt-2 mt-1 space-y-1">
          {Object.entries(sportEmoji).map(([sport, emoji]) => (
            <div key={sport} className="flex items-center gap-1.5">
              {emoji} <span className="capitalize">{sport === "football" ? "Futbolas" : sport === "tennis" ? "Tenisas" : sport === "basketball" ? "Krepšinis" : sport === "padel" ? "Padelis" : sport === "badminton" ? "Badmintonas" : "Squash"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
