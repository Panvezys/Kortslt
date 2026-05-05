import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface WeatherData {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  windSpeed: number;
  uvIndex: number;
  weatherCode: number;
}

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code <= 3) return "☁️";
  if (code <= 49) return "🌫️";
  if (code <= 59) return "🌦️";
  if (code <= 69) return "🌧️";
  if (code <= 79) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 84) return "🌨️";
  if (code <= 86) return "❄️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

function weatherLabel(code: number): string {
  if (code === 0) return "Giedra";
  if (code <= 2) return "Daugiausia giedra";
  if (code <= 3) return "Debesuota";
  if (code <= 49) return "Rūkas";
  if (code <= 59) return "Dulksna";
  if (code <= 69) return "Lietus";
  if (code <= 79) return "Sningą";
  if (code <= 82) return "Liūtis";
  if (code <= 86) return "Snieguota";
  if (code <= 99) return "Griaustinis";
  return "Kita";
}

interface Props {
  lat: number | null | undefined;
  lon: number | null | undefined;
  date: string;
  isIndoor: boolean;
}

export function WeatherWidget({ lat, lon, date, isIndoor }: Props) {
  const enabled = !isIndoor && !!lat && !!lon && !!date;

  const { data, isLoading, isError } = useQuery<WeatherData>({
    queryKey: ["weather", lat, lon, date],
    queryFn: async () => {
      const r = await fetch(`${API}/weather?lat=${lat}&lon=${lon}&date=${date}`);
      if (!r.ok) throw new Error("weather unavailable");
      return r.json();
    },
    enabled,
    staleTime: 2 * 60 * 60 * 1000,
    retry: false,
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-muted/20 p-3 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-8 w-32 bg-muted rounded" />
      </div>
    );
  }

  if (isError || !data) return null;

  const rainHigh = data.precipitationProbability >= 60;
  const windHigh = data.windSpeed >= 30;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-sky-500/5 to-blue-500/5 border-sky-400/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-3xl leading-none select-none">{weatherEmoji(data.weatherCode)}</span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Orų prognozė žaidimo dienai</p>
            <p className="font-semibold text-sm leading-tight">{weatherLabel(data.weatherCode)}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold leading-tight">{data.temperatureMax}°</p>
          <p className="text-xs text-muted-foreground">{data.temperatureMin}° min</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${rainHigh ? "bg-blue-500/15 border-blue-400/30 text-blue-400" : "bg-muted/40 border-transparent text-muted-foreground"}`}>
          🌧️ {data.precipitationProbability}% lietus
        </span>
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${windHigh ? "bg-yellow-500/15 border-yellow-400/30 text-yellow-400" : "bg-muted/40 border-transparent text-muted-foreground"}`}>
          💨 {data.windSpeed} km/h vėjas
        </span>
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-muted/40 border-transparent text-muted-foreground">
          ☀️ UV {data.uvIndex}
        </span>
      </div>

      {rainHigh && (
        <p className="mt-2 text-xs text-blue-400 font-medium">
          ⚠️ Tikimybė lietaus — rekomenduojame patikrinti prieš atvykstant.
        </p>
      )}
    </div>
  );
}
