import { useEffect } from "react";
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

const conditionColors: Record<string, string> = {
  excellent: "#84cc16",
  good: "#f97316",
  fair: "#ef4444",
};

const createCourtIcon = (court: Court) => {
  const base = court.type === "tennis" ? "🎾" : "🏀";
  const color = conditionColors[court.condition] ?? "#84cc16";
  return new L.DivIcon({
    className: "custom-court-icon",
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;">${base}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
};

// Lithuania center
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

const conditionLabels: Record<string, string> = {
  excellent: "Puiki",
  good: "Gera",
  fair: "Patenkinama",
};

export function CourtMap({ courts }: { courts: Court[] }) {
  return (
    <div className="w-full h-full min-h-[400px] z-0 relative rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <MapContainer
        center={LITHUANIA_CENTER}
        zoom={7}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
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
                  {court.condition && (
                    <div className="text-xs text-gray-600">
                      Bukle: <span style={{ color: conditionColors[court.condition] }} className="font-semibold">{conditionLabels[court.condition]}</span>
                    </div>
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

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-background/95 backdrop-blur border border-border rounded-lg p-3 text-xs shadow-lg space-y-2">
        <div className="font-semibold text-xs mb-2 text-muted-foreground uppercase tracking-wide">Legenda</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#84cc16" }}></div>
          <span>Puiki bukle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#f97316" }}></div>
          <span>Gera bukle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: "#ef4444" }}></div>
          <span>Patenkinama</span>
        </div>
        <div className="border-t border-border pt-2 mt-1">
          <div className="flex items-center gap-1.5">🎾 <span>Tenisas</span></div>
          <div className="flex items-center gap-1.5 mt-1">🏀 <span>Krepšinis</span></div>
        </div>
      </div>
    </div>
  );
}
