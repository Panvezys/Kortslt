import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Search, Map } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

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

type Mode = "search" | "pin";

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

export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [mode, setMode] = useState<Mode>("search");
  const hasCoords = latitude !== 0 && longitude !== 0;
  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral | null>(
    hasCoords ? { lat: latitude, lng: longitude } : null
  );
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(
    hasCoords ? { lat: latitude, lng: longitude } : LITHUANIA_CENTER
  );
  const [mapZoom, setMapZoom] = useState(hasCoords ? 15 : 7);
  const [searchInput, setSearchInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Initialise Places Autocomplete once the Maps API has loaded and input is mounted
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "lt" },
      fields: ["geometry", "address_components", "formatted_address"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;

      const lat = parseFloat(place.geometry.location.lat().toFixed(6));
      const lng = parseFloat(place.geometry.location.lng().toFixed(6));
      const extracted = extractFromPlaceComponents(place.address_components ?? []);

      setMarkerPos({ lat, lng });
      setMapCenter({ lat, lng });
      setMapZoom(16);
      onChange({ lat, lng, ...extracted });
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
      {/* Mode toggle */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === "search"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          <Search className="w-4 h-4" />
          Ieškoti adreso
        </button>
        <button
          type="button"
          onClick={() => setMode("pin")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === "pin"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          <Map className="w-4 h-4" />
          Žymėti žemėlapyje
        </button>
      </div>

      {/* Address search input — always mounted so autocomplete ref stays valid */}
      <div className={mode === "search" ? "block" : "hidden"}>
        {isLoaded ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Pradėkite rašyti adresą Lietuvoje…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        ) : (
          <Skeleton className="h-10 w-full rounded-md" />
        )}
        {mode === "search" && (
          <p className="text-xs text-muted-foreground mt-1">
            Pasirinkite adresą iš sąrašo — miestas, pašto kodas ir koordinatės užsipildys automatiškai
          </p>
        )}
      </div>

      {mode === "pin" && (
        <p className="text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 inline mr-1 text-primary" />
          Spauskite žemėlapyje arba vilkite žymeklį, kad tiksliai pažymėtumėte kortą
        </p>
      )}

      {/* Map */}
      {!isLoaded ? (
        <Skeleton className="w-full rounded-lg" style={{ height: 260 }} />
      ) : (
        <div className="w-full rounded-lg overflow-hidden border border-border" style={{ height: 260 }}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={(map) => { mapRef.current = map; }}
            onClick={mode === "pin" ? handleMapClick : undefined}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false,
              cursor: mode === "pin" ? "crosshair" : undefined,
              styles: [
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
              ],
            }}
          >
            {markerPos && (
              <Marker
                position={markerPos}
                draggable={mode === "pin"}
                onDragEnd={mode === "pin" ? handleMarkerDragEnd : undefined}
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
