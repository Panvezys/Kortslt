import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";

// Fix leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const createCustomIcon = (color: string) => {
  return new L.DivIcon({
    className: "custom-icon",
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const tennisIcon = createCustomIcon("#84cc16"); // Green
const basketballIcon = createCustomIcon("#f97316"); // Orange

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function CourtMap({ courts }: { courts: Court[] }) {
  // Default to a generic center if no courts
  const center: [number, number] = courts.length > 0 ? [courts[0].latitude, courts[0].longitude] : [37.7749, -122.4194];

  return (
    <div className="w-full h-full min-h-[400px] z-0 relative rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapUpdater center={center} />
        {courts.map((court) => (
          <Marker
            key={court.id}
            position={[court.latitude, court.longitude]}
            icon={court.type === "tennis" ? tennisIcon : basketballIcon}
          >
            <Popup>
              <div className="flex flex-col gap-1 min-w-[150px]">
                <strong className="text-base">{court.name}</strong>
                <span className="text-xs text-muted-foreground capitalize">{court.type} Court</span>
                <span className="font-semibold">${court.pricePerHour}/hr</span>
                <Link href={`/courts/${court.id}`} className="mt-2 text-xs bg-primary text-primary-foreground py-1 px-2 rounded text-center font-medium">
                  View Details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
