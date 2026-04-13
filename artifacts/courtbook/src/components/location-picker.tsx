import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { MapPin } from "lucide-react";

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number, city?: string, address?: string) => void;
}

const LITHUANIA_CENTER: [number, number] = [55.1694, 23.8813];

export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const initializedRef = useRef(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=lt`,
        { headers: { "Accept-Language": "lt,en" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address ?? {};
      const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
      const road = addr.road ?? "";
      const houseNumber = addr.house_number ? ` ${addr.house_number}` : "";
      const address = road ? `${road}${houseNumber}` : "";
      onChange(lat, lng, city, address);
    } catch {
      onChange(lat, lng);
    }
  }, [onChange]);

  const placeMarker = useCallback((map: L.Map, lat: number, lng: number, geocode = true) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:#84cc16;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
      marker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        const newLat = parseFloat(pos.lat.toFixed(6));
        const newLng = parseFloat(pos.lng.toFixed(6));
        reverseGeocode(newLat, newLng);
      });
      markerRef.current = marker;
    }
    if (geocode) reverseGeocode(lat, lng);
    else onChange(lat, lng);
  }, [onChange, reverseGeocode]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const hasCoords = latitude !== 0 && longitude !== 0;
    const center: [number, number] = hasCoords ? [latitude, longitude] : LITHUANIA_CENTER;
    const zoom = hasCoords ? 15 : 7;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, zoom);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    if (hasCoords) {
      placeMarker(map, latitude, longitude, false);
    }

    map.on("click", (e) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lng = parseFloat(e.latlng.lng.toFixed(6));
      placeMarker(map, lat, lng, true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MapPin className="w-4 h-4 text-primary" />
        <span>Korto vieta žemėlapyje</span>
        <span className="text-xs text-muted-foreground font-normal">(spauskite, kad pažymėti)</span>
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-border"
        style={{ height: 260 }}
      />
      {latitude !== 0 && longitude !== 0 && (
        <p className="text-xs text-muted-foreground font-mono">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}
