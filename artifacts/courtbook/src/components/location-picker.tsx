import { useCallback, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const LITHUANIA_CENTER = { lat: 55.1694, lng: 23.8813 };
const LIBRARIES: ("places")[] = [];

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number, city?: string, address?: string) => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; address?: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "lt,en" } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const addr = data.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
    const road = addr.road ?? "";
    const houseNumber = addr.house_number ? ` ${addr.house_number}` : "";
    const address = road ? `${road}${houseNumber}` : "";
    return { city, address };
  } catch {
    return {};
  }
}

export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const hasCoords = latitude !== 0 && longitude !== 0;
  const center = hasCoords ? { lat: latitude, lng: longitude } : LITHUANIA_CENTER;
  const zoom = hasCoords ? 15 : 7;

  const mapRef = useRef<google.maps.Map | null>(null);
  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral | null>(
    hasCoords ? { lat: latitude, lng: longitude } : null
  );

  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = parseFloat(e.latLng.lat().toFixed(6));
    const lng = parseFloat(e.latLng.lng().toFixed(6));
    setMarkerPos({ lat, lng });
    const { city, address } = await reverseGeocode(lat, lng);
    onChange(lat, lng, city, address);
  }, [onChange]);

  const handleMarkerDragEnd = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = parseFloat(e.latLng.lat().toFixed(6));
    const lng = parseFloat(e.latLng.lng().toFixed(6));
    setMarkerPos({ lat, lng });
    const { city, address } = await reverseGeocode(lat, lng);
    onChange(lat, lng, city, address);
  }, [onChange]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MapPin className="w-4 h-4 text-primary" />
        <span>Korto vieta žemėlapyje</span>
        <span className="text-xs text-muted-foreground font-normal">(spauskite, kad pažymėti)</span>
      </div>

      {!isLoaded ? (
        <Skeleton className="w-full rounded-lg" style={{ height: 260 }} />
      ) : (
        <div className="w-full rounded-lg overflow-hidden border border-border" style={{ height: 260 }}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={center}
            zoom={zoom}
            onLoad={(map) => { mapRef.current = map; }}
            onClick={handleMapClick}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              styles: [
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
              ],
            }}
          >
            {markerPos && (
              <Marker
                position={markerPos}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            )}
          </GoogleMap>
        </div>
      )}

      {markerPos && (
        <p className="text-xs text-muted-foreground font-mono">
          {markerPos.lat.toFixed(6)}, {markerPos.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
