import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";
import { resolveCourtImage } from "@/lib/imageUrl";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function getRatingColor(rating?: number | null): string {
  if (!rating) return "#94a3b8";       // gray — no rating
  if (rating >= 4.5) return "#84cc16"; // lime green — excellent
  if (rating >= 3.5) return "#22c55e"; // green — good
  if (rating >= 2.5) return "#eab308"; // yellow — average
  if (rating >= 1.5) return "#f97316"; // orange — below average
  return "#ef4444";                    // red — poor
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const empty = 5 - Math.ceil(rating);
  const half = rating % 1 >= 0.25 && rating % 1 < 0.75 ? 1 : 0;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

const sportEmoji: Record<string, string> = {
  tennis: "🎾", basketball: "🏀", padel: "🏓",
  football: "⚽", badminton: "🏸", squash: "🎯",
};

const createCourtIcon = (court: Court) => {
  const base = sportEmoji[court.type] ?? "🏟";
  const color = getRatingColor(court.rating);
  return new L.DivIcon({
    className: "custom-court-icon",
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;">${base}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
};

const LITHUANIA_CENTER: [number, number] = [55.1694, 23.8813];

function FitBounds({ courts }: { courts: Court[] }) {
  const map = useMap();
  useEffect(() => {
    if (courts.length === 0) {
      map.setView(LITHUANIA_CENTER, 7);
      return;
    }
    if (courts.length === 1) {
      map.setView([courts[0].latitude, courts[0].longitude], 13);
      return;
    }
    const bounds = L.latLngBounds(courts.map(c => [c.latitude, c.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [courts, map]);
  return null;
}

const surfaceLabels: Record<string, string> = {
  clay: "Gruntas",
  hard: "Kieta danga",
  carpet: "Kilimas",
  synthetic_grass: "Sintetinė žolė",
  parquet: "Parketas",
  rubber: "Guma",
};

const TILE_LAYERS = {
  street: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
};

export function CourtMap({ courts }: { courts: Court[] }) {
  const [viewMode, setViewMode] = useState<"street" | "satellite">("street");
  const tile = TILE_LAYERS[viewMode];

  return (
    <div className="w-full h-full min-h-[400px] z-0 relative rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <MapContainer
        center={LITHUANIA_CENTER}
        zoom={7}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer key={viewMode} attribution={tile.attribution} url={tile.url} />
        <FitBounds courts={courts} />
        {courts.map((court) => (
          <Marker
            key={court.id}
            position={[court.latitude, court.longitude]}
            icon={createCourtIcon(court)}
          >
            <Popup minWidth={220}>
              <div style={{ margin: "-12px -20px -12px -20px", overflow: "hidden", borderRadius: "8px", minWidth: "200px" }}>
                {resolveCourtImage(court.imageUrl) ? (
                  <div style={{ width: "100%", height: "120px", overflow: "hidden" }}>
                    <img
                      src={resolveCourtImage(court.imageUrl)!}
                      alt={court.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : null}
                <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div className="font-bold text-sm leading-tight">{court.name}</div>
                  <div className="text-xs text-gray-500">{court.city}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: court.type === "tennis" ? "#84cc16" : "#f97316", color: "white" }}>
                      {court.type === "tennis" ? "Tenisas" : "Krepšinis"}
                    </span>
                    {court.isIndoor && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">Vidaus</span>
                    )}
                    {court.surface && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {surfaceLabels[court.surface] ?? court.surface}
                      </span>
                    )}
                  </div>
                  {court.rating ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span style={{ color: getRatingColor(court.rating), fontSize: "13px", letterSpacing: "1px" }}>
                        {renderStars(court.rating)}
                      </span>
                      <span className="font-bold text-gray-700">{court.rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">Nėra įvertinimų</div>
                  )}
                  <div className="font-bold text-base" style={{ color: "#84cc16" }}>
                    {court.pricePerHour}€/val
                  </div>
                  <Link href={`/courts/${court.id}`}>
                    <div className="mt-1 text-xs font-semibold text-center py-1.5 px-3 rounded-md cursor-pointer" style={{ background: "#84cc16", color: "black" }}>
                      Rezervuoti
                    </div>
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Satellite / Street toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex rounded-lg overflow-hidden border border-border shadow-md text-xs font-medium">
        <button
          onClick={() => setViewMode("street")}
          className={`px-3 py-1.5 transition-colors ${
            viewMode === "street"
              ? "bg-primary text-primary-foreground"
              : "bg-background/95 backdrop-blur text-foreground hover:bg-muted"
          }`}
        >
          Žemėlapis
        </button>
        <button
          onClick={() => setViewMode("satellite")}
          className={`px-3 py-1.5 transition-colors ${
            viewMode === "satellite"
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
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#84cc16" }}></div>
          <span>4.5 – 5.0 ★★★★★</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#22c55e" }}></div>
          <span>3.5 – 4.4 ★★★★</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#eab308" }}></div>
          <span>2.5 – 3.4 ★★★</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#f97316" }}></div>
          <span>1.5 – 2.4 ★★</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#94a3b8" }}></div>
          <span>Nėra įvertinimų</span>
        </div>
        <div className="border-t border-border pt-2 mt-1 space-y-1">
          <div className="flex items-center gap-1.5">🎾 <span>Tenisas</span></div>
          <div className="flex items-center gap-1.5">🏀 <span>Krepšinis</span></div>
          <div className="flex items-center gap-1.5">🏓 <span>Padelis</span></div>
          <div className="flex items-center gap-1.5">⚽ <span>Futbolas</span></div>
          <div className="flex items-center gap-1.5">🏸 <span>Badmintonas</span></div>
          <div className="flex items-center gap-1.5">🎯 <span>Squash</span></div>
        </div>
      </div>
    </div>
  );
}
