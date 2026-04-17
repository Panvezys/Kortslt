import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const LITHUANIA_CENTER = { lat: 55.1694, lng: 23.8813 };
const LIBRARIES: ("places")[] = ["places"];

export interface LocationPickerResult {
  lat: number;
  lng: number;
  city?: string;
  address?: string;
  postcode?: string;
}

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (result: LocationPickerResult) => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<Omit<LocationPickerResult, "lat" | "lng">> {
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
    const postcode = addr.postcode ?? "";
    return { city, address, postcode };
  } catch {
    return {};
  }
}

function extractFromPlaceComponents(
  components: google.maps.GeocoderAddressComponent[]
): Omit<LocationPickerResult, "lat" | "lng"> {
  const get = (type: string) =>
    components.find(c => c.types.includes(type))?.long_name ?? "";

  const streetNumber = get("street_number");
  const route = get("route");
  const address = route ? `${route}${streetNumber ? " " + streetNumber : ""}` : "";
  const city =
    get("locality") ||
    get("administrative_area_level_2") ||
    get("administrative_area_level_1");
  const postcode = get("postal_code");

  return { address, city, postcode };
}

const MAP_STYLES_DARK: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b3b5e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
];

const MAP_STYLES_LIGHT: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const { theme } = useTheme();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const hasCoords = latitude !== 0 && longitude !== 0;
  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral | null>(
    hasCoords ? { lat: latitude, lng: longitude } : null
  );
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(
    hasCoords ? { lat: latitude, lng: longitude } : LITHUANIA_CENTER
  );
  const [mapZoom, setMapZoom] = useState(hasCoords ? 15 : 7);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "lt" },
      fields: ["geometry", "address_components", "formatted_address"],
    });

    ac.addListener("place_changed", () => {
      try {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;

        const lat = parseFloat(place.geometry.location.lat().toFixed(6));
        const lng = parseFloat(place.geometry.location.lng().toFixed(6));
        const extracted = extractFromPlaceComponents(place.address_components ?? []);

        setMarkerPos({ lat, lng });
        setMapCenter({ lat, lng });
        setMapZoom(16);
        onChange({ lat, lng, ...extracted });

        if (inputRef.current && place.formatted_address) {
          inputRef.current.value = place.formatted_address;
        }
      } catch {
        return;
      }
    });

    autocompleteRef.current = ac;
  }, [isLoaded, onChange]);

  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = parseFloat(e.latLng.lat().toFixed(6));
    const lng = parseFloat(e.latLng.lng().toFixed(6));
    setMarkerPos({ lat, lng });
    const geo = await reverseGeocode(lat, lng);
    onChange({ lat, lng, ...geo });
  }, [onChange]);

  const handleMarkerDragEnd = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = parseFloat(e.latLng.lat().toFixed(6));
    const lng = parseFloat(e.latLng.lng().toFixed(6));
    setMarkerPos({ lat, lng });
    const geo = await reverseGeocode(lat, lng);
    onChange({ lat, lng, ...geo });
  }, [onChange]);

  return (
    <div className="space-y-3">
      {!isLoaded ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : (
        <div
          ref={wrapperRef}
          className="relative"
          onPointerDownCapture={e => e.stopPropagation()}
          onMouseDownCapture={e => e.stopPropagation()}
          onClickCapture={e => e.stopPropagation()}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Pradėkite rašyti adresą Lietuvoje…"
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoComplete="off"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Pasirinkite adresą iš sąrašo arba{" "}
        <MapPin className="w-3 h-3 inline mx-0.5 text-primary" />
        spauskite žemėlapyje, kad pažymėtumėte aikštelę
      </p>

      {!isLoaded ? (
        <Skeleton className="w-full rounded-lg" style={{ height: 260 }} />
      ) : (
        <div className="w-full rounded-lg overflow-hidden border border-border" style={{ height: 260 }}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={mapZoom}
            onClick={handleMapClick}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false,
              cursor: "crosshair",
              styles: theme === "dark" ? MAP_STYLES_DARK : MAP_STYLES_LIGHT,
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
