import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { getSportColor, getSportLabel } from "@/components/sport-icon";

/**
 * Per-sport icon configuration. The SVG art lives in `sport-icon.tsx` (keyed by
 * `iconKey`); this layer carries the editable metadata served from the
 * `sport_icons` DB table. DB values override the code defaults below; if the
 * fetch hasn't resolved (or fails), callers fall back to the defaults so icons
 * never flicker or disappear.
 */
export interface SportIconConfig {
  sport: string;
  iconKey: string;
  color: string;
  label: string;
}

/** Canonical sport slugs that have a court diagram + color/label in code. */
const SPORT_KEYS = [
  "tennis", "basketball", "padel", "football", "badminton", "squash",
  "table_tennis", "golf", "snooker", "bowling", "volleyball", "hockey",
  "futsal", "floorball", "beach-volleyball", "pickleball",
] as const;

/** Code defaults — mirror of the seed, derived from the in-code sport maps. */
const DEFAULT_CONFIG: Record<string, SportIconConfig> = Object.fromEntries(
  SPORT_KEYS.map((s) => [s, { sport: s, iconKey: s, color: getSportColor(s), label: getSportLabel(s) }]),
);

function defaultFor(sport: string): SportIconConfig {
  return DEFAULT_CONFIG[sport] ?? {
    sport,
    iconKey: sport,
    color: getSportColor(sport),
    label: getSportLabel(sport),
  };
}

type SportIconRow = { sport: string; iconKey: string; color: string; label: string; sortOrder: number };

/** Fetches + caches the sport icon config map (DB overrides merged over code). */
export function useSportIcons(): Record<string, SportIconConfig> {
  const { data } = useQuery<SportIconRow[]>({
    queryKey: ["sport-icons"],
    queryFn: () => customFetch<SportIconRow[]>("/api/sport-icons", { method: "GET" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!data) return DEFAULT_CONFIG;

  const merged: Record<string, SportIconConfig> = { ...DEFAULT_CONFIG };
  for (const row of data) {
    merged[row.sport] = { sport: row.sport, iconKey: row.iconKey, color: row.color, label: row.label };
  }
  return merged;
}

/** Resolved config for a single sport (DB override → code default → fallback). */
export function useSportIconConfig(sport?: string | null): SportIconConfig {
  const map = useSportIcons();
  if (!sport) return defaultFor("");
  return map[sport] ?? defaultFor(sport);
}
