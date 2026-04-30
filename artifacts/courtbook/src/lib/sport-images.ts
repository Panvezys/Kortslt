import { SPORT_LABELS, type SportKey } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * SINGLE SOURCE OF TRUTH — court hero photos keyed by sport.
 *
 * The `satisfies` clause requires an entry for every {@link SportKey} so a
 * newly added sport in `SPORT_LABELS` will fail to compile here until its
 * fallback photo is registered. The synthetic `total` key supplies the photo
 * used for "all sports" surfaces (e.g. the home page stats overview).
 *
 * Aliases such as `"table-tennis"` deliberately point at the same asset as
 * their canonical key so legacy slugs keep working.
 */
const SPORT_IMAGE_PATHS = {
  tennis:               "courts/court_2_bernardinu.webp",
  basketball:           "courts/court_17_zalgiris.webp",
  padel:                "courts/padel/padel_court_indoor_1.webp",
  football:             "courts/football/football_futsal_court_2.webp",
  badminton:            "courts/badminton/badminton_court_indoor_1.webp",
  squash:               "courts/squash/squash_court_1.webp",
  table_tennis:         "courts/table_tennis/table_tennis_court_1.jpg",
  "table-tennis":       "courts/table_tennis/table_tennis_court_1.jpg",
  golf:                 "courts/golf/golf_course_1.jpg",
  snooker:              "courts/snooker/snooker_table_1.jpg",
  bowling:              "courts/bowling/bowling_alley_1.jpg",
  volleyball:           "courts/volleyball/volleyball_court_1.jpg",
  hockey:               "courts/hockey/hockey_rink_1.jpg",
  futsal:               "courts/futsal/futsal_court_1.jpg",
  floorball:            "courts/floorball/floorball_court_1.jpg",
  "beach-volleyball":   "courts/beach_volleyball/beach_volleyball_court_1.jpg",
  pickleball:           "courts/pickleball/pickleball_court_1.png",
  total:                "courts/court_1_seb_arena.webp",
} as const satisfies Record<SportKey | "total", string>;

if (import.meta.env.DEV) {
  // Defence in depth: also catch sport keys that exist at runtime (e.g. via
  // server data) but have somehow drifted out of the SportKey union.
  for (const key of Object.keys(SPORT_LABELS)) {
    if (!(key in SPORT_IMAGE_PATHS)) {
      console.warn(
        `[sport-images] Missing entry for sport "${key}". Add it to SPORT_IMAGE_PATHS so list/detail surfaces have a sport-appropriate fallback.`,
      );
    }
  }
}

export const SPORT_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_IMAGE_PATHS).map(([key, path]) => [key, `${BASE_URL}/${path}`]),
);

/**
 * Returns the sport-specific hero photo URL for the given sport key, or
 * `null` if the sport is unknown / not provided.
 */
export function getSportImage(sport?: string | null): string | null {
  if (!sport) return null;
  return SPORT_IMAGES[sport] ?? null;
}
