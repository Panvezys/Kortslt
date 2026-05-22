import { SVGProps } from "react";

type SvgProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function Svg({ size = 20, strokeWidth = 1.6, children, ...props }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Tennis ball — circle with two S-curve seam lines left and right */
export function TennisIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M5.2 6.5 C9 9.5 9 14.5 5.2 17.5" strokeWidth={sw} />
      <path d="M18.8 6.5 C15 9.5 15 14.5 18.8 17.5" strokeWidth={sw} />
    </Svg>
  );
}

/** Basketball — circle with two vertical curves and a horizontal line */
export function BasketballIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2 C8.5 6 8.5 18 12 22" strokeWidth={sw} />
      <path d="M12 2 C15.5 6 15.5 18 12 22" strokeWidth={sw} />
      <line x1="2" y1="12" x2="22" y2="12" strokeWidth={sw} />
    </Svg>
  );
}

/** Padel racket — rounded rectangle face with grid + handle */
export function PadelIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <rect x="5" y="2" width="14" height="15" rx="3.5" />
      <line x1="5" y1="7.5" x2="19" y2="7.5" strokeWidth={0.9} />
      <line x1="5" y1="11.5" x2="19" y2="11.5" strokeWidth={0.9} />
      <line x1="5" y1="14" x2="19" y2="14" strokeWidth={0.9} />
      <line x1="9.5" y1="2" x2="9.5" y2="17" strokeWidth={0.9} />
      <line x1="14.5" y1="2" x2="14.5" y2="17" strokeWidth={0.9} />
      <line x1="12" y1="17" x2="12" y2="23" strokeWidth={sw} />
      <line x1="10" y1="23" x2="14" y2="23" strokeWidth={sw} />
    </Svg>
  );
}

/** Football/Soccer — circle with centre pentagon and radiating seam lines */
export function FootballIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,7.5 15.9,10.2 14.4,14.3 9.6,14.3 8.1,10.2" strokeWidth={sw} />
      <line x1="12" y1="7.5" x2="12" y2="2.1" strokeWidth={sw} />
      <line x1="15.9" y1="10.2" x2="20.4" y2="8.7" strokeWidth={sw} />
      <line x1="14.4" y1="14.3" x2="17.5" y2="18.5" strokeWidth={sw} />
      <line x1="9.6" y1="14.3" x2="6.5" y2="18.5" strokeWidth={sw} />
      <line x1="8.1" y1="10.2" x2="3.6" y2="8.7" strokeWidth={sw} />
    </Svg>
  );
}

/** Badminton — shuttlecock with dome, feather lines, stem, and cork */
export function BadmintonIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="12" cy="20.5" r="1.8" strokeWidth={sw} />
      <line x1="10.3" y1="18.8" x2="7.5" y2="9.5" strokeWidth={sw} />
      <line x1="13.7" y1="18.8" x2="16.5" y2="9.5" strokeWidth={sw} />
      <path d="M7.5 9.5 Q12 4.5 16.5 9.5" strokeWidth={sw} />
      <line x1="8.2" y1="12" x2="15.8" y2="12" strokeWidth={0.9} />
      <line x1="8.8" y1="14.5" x2="15.2" y2="14.5" strokeWidth={0.9} />
      <line x1="9.5" y1="17" x2="14.5" y2="17" strokeWidth={0.9} />
    </Svg>
  );
}

/** Squash — oval racket head with string grid and handle */
export function SquashIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="9.5" rx="6" ry="7" strokeWidth={sw} />
      <line x1="12" y1="16.5" x2="12" y2="22" strokeWidth={sw} />
      <line x1="10.5" y1="21" x2="13.5" y2="21" strokeWidth={sw} />
      <line x1="6" y1="9.5" x2="18" y2="9.5" strokeWidth={0.9} />
      <line x1="12" y1="2.5" x2="12" y2="16.5" strokeWidth={0.9} />
      <line x1="7" y1="6.5" x2="17" y2="6.5" strokeWidth={0.9} />
      <line x1="7" y1="12.5" x2="17" y2="12.5" strokeWidth={0.9} />
      <line x1="9" y1="3.5" x2="9" y2="15.5" strokeWidth={0.9} />
      <line x1="15" y1="3.5" x2="15" y2="15.5" strokeWidth={0.9} />
    </Svg>
  );
}

/** Table tennis — round paddle with handle and ball */
export function TableTennisIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="8" strokeWidth={sw} />
      <line x1="2.2" y1="10" x2="17.8" y2="10" strokeWidth={0.9} />
      <line x1="16" y1="16" x2="20.5" y2="21" strokeWidth={sw * 1.6} strokeLinecap="round" />
      <circle cx="21.5" cy="4" r="2" strokeWidth={sw} />
    </Svg>
  );
}

/** Golf — flag on pole, ground cup, and ball */
export function GolfIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <line x1="8" y1="22" x2="8" y2="2" strokeWidth={sw} />
      <path d="M8 2 L17.5 6 L8 10" strokeWidth={sw} />
      <ellipse cx="8" cy="22" rx="4.5" ry="1.2" strokeWidth={sw} />
      <circle cx="19.5" cy="18.5" r="2.5" strokeWidth={sw} />
    </Svg>
  );
}

/** Snooker — 8-ball (circle with inner white badge and two oval loops for "8") */
export function SnookerIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" strokeWidth={sw} />
      <circle cx="12" cy="12" r="4.5" strokeWidth={sw} />
      <ellipse cx="12" cy="10.2" rx="1.8" ry="1.5" strokeWidth={sw * 0.85} />
      <ellipse cx="12" cy="13.7" rx="2.1" ry="1.8" strokeWidth={sw * 0.85} />
    </Svg>
  );
}

/** Bowling — bowling ball with finger holes + a single standing pin */
export function BowlingIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="8" cy="15.5" r="6.5" strokeWidth={sw} />
      <circle cx="6" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="4.5" r="2" strokeWidth={sw} />
      <path d="M17.5 6.5 Q17 9.5 17.5 12 L21.5 12 Q22 9.5 21.5 6.5 Z" strokeWidth={sw} />
      <line x1="17.5" y1="12" x2="21.5" y2="12" strokeWidth={sw} />
    </Svg>
  );
}

/** Volleyball — ball with three curved seam panels meeting at the top-left */
export function VolleyballIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2.2 8.5 C 8 12 14 12 21.8 8.5" strokeWidth={sw} />
      <path d="M4 18 C 9 14 14 10 19.5 5" strokeWidth={sw} />
      <path d="M19.5 19 C 16 14 14 9 12 2.2" strokeWidth={sw} />
    </Svg>
  );
}

/** Hockey — two crossed sticks (with hooked blades) over a puck */
export function HockeyIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      {/* Left stick: shaft from top-left + blade at bottom */}
      <line x1="3" y1="3" x2="13" y2="13" strokeWidth={sw} />
      <path d="M13 13 L20 13 L20 16 L16 16 Z" strokeWidth={sw} />
      {/* Right stick: shaft from top-right + blade at bottom (mirrored) */}
      <line x1="21" y1="3" x2="11" y2="13" strokeWidth={sw} />
      <path d="M11 13 L4 13 L4 16 L8 16 Z" strokeWidth={sw} />
      {/* Puck */}
      <ellipse cx="12" cy="20.5" rx="4" ry="1.3" strokeWidth={sw} />
    </Svg>
  );
}

/** Futsal — indoor court layout (rectangle, halfway line, centre circle, penalty arcs) */
export function FutsalIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  const thin = Math.max(0.7, sw * 0.6);
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="0.5" strokeWidth={sw} />
      <line x1="12" y1="6" x2="12" y2="18" strokeWidth={thin} />
      <circle cx="12" cy="12" r="2" strokeWidth={thin} />
      <path d="M3 9.5 Q 7 12 3 14.5" strokeWidth={thin} fill="none" />
      <path d="M21 9.5 Q 17 12 21 14.5" strokeWidth={thin} fill="none" />
    </Svg>
  );
}

/** Floorball — straight stick with curved blade and a perforated plastic ball */
export function FloorballIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      {/* Stick shaft */}
      <line x1="7" y1="3" x2="15" y2="13" strokeWidth={sw} />
      {/* Curved blade */}
      <path d="M15 13 Q 19.5 14 20.5 17 Q 17.5 17 14 16 Z" strokeWidth={sw} />
      {/* Perforated ball */}
      <circle cx="6" cy="20" r="2.6" strokeWidth={sw} />
      <circle cx="5" cy="19.4" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="7" cy="20.4" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="6.4" cy="18.6" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="5.4" cy="21.2" r="0.45" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Beach volleyball — volleyball-style ball above a wavy sand line */
export function BeachVolleyballIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      {/* Ball with three seams */}
      <circle cx="11" cy="10.5" r="7.5" strokeWidth={sw} />
      <path d="M3.7 10.5 Q 11 6 18.3 10.5" strokeWidth={sw} />
      <path d="M3.7 10.5 Q 11 15 18.3 10.5" strokeWidth={sw} />
      <path d="M11 3 Q 7 10.5 11 18" strokeWidth={sw} />
      {/* Sand wave */}
      <path d="M2 21.5 Q 5 20 8 21.5 T 14 21.5 T 20 21.5 T 22 21" strokeWidth={sw} fill="none" />
    </Svg>
  );
}

/** Pickleball — rectangular paddle with rounded face + small perforated ball */
export function PickleballIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  return (
    <Svg {...props}>
      {/* Paddle face */}
      <rect x="3" y="2.5" width="11" height="13" rx="2" strokeWidth={sw} />
      {/* Handle */}
      <line x1="8.5" y1="15.5" x2="8.5" y2="22" strokeWidth={sw} />
      <line x1="6.5" y1="22" x2="10.5" y2="22" strokeWidth={sw} />
      {/* Perforated ball */}
      <circle cx="18.5" cy="17" r="3" strokeWidth={sw} />
      <circle cx="17.4" cy="16.4" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="16.4" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="18" r="0.45" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Court — generic tennis-style court diagram (outer frame, doubles alleys, net, service boxes) */
export function CourtIcon(props: SvgProps) {
  const sw = props.strokeWidth ?? 1.6;
  const thin = Math.max(0.7, sw * 0.6);
  return (
    <Svg {...props}>
      {/* Outer baselines + sidelines */}
      <rect x="4" y="2.5" width="16" height="19" rx="0.5" strokeWidth={sw} />
      {/* Doubles alleys */}
      <line x1="6.5" y1="2.5" x2="6.5" y2="21.5" strokeWidth={thin} />
      <line x1="17.5" y1="2.5" x2="17.5" y2="21.5" strokeWidth={thin} />
      {/* Net (extends slightly past sidelines for posts) */}
      <line x1="3" y1="12" x2="21" y2="12" strokeWidth={sw} />
      {/* Service lines */}
      <line x1="6.5" y1="7.5" x2="17.5" y2="7.5" strokeWidth={thin} />
      <line x1="6.5" y1="16.5" x2="17.5" y2="16.5" strokeWidth={thin} />
      {/* Center service line */}
      <line x1="12" y1="7.5" x2="12" y2="16.5" strokeWidth={thin} />
    </Svg>
  );
}

export type SportType =
  | "tennis"
  | "basketball"
  | "padel"
  | "football"
  | "badminton"
  | "squash"
  | "table_tennis"
  | "golf"
  | "snooker"
  | "bowling"
  | "volleyball"
  | "hockey"
  | "futsal"
  | "floorball"
  | "beach-volleyball"
  | "pickleball";

export function SportIcon({ sport, ...props }: SvgProps & { sport: string }) {
  switch (sport) {
    case "tennis":             return <TennisIcon {...props} />;
    case "basketball":         return <BasketballIcon {...props} />;
    case "padel":              return <PadelIcon {...props} />;
    case "football":           return <FootballIcon {...props} />;
    case "badminton":          return <BadmintonIcon {...props} />;
    case "squash":             return <SquashIcon {...props} />;
    case "table_tennis":
    case "table-tennis":       return <TableTennisIcon {...props} />;
    case "golf":               return <GolfIcon {...props} />;
    case "snooker":            return <SnookerIcon {...props} />;
    case "bowling":            return <BowlingIcon {...props} />;
    case "volleyball":         return <VolleyballIcon {...props} />;
    case "hockey":             return <HockeyIcon {...props} />;
    case "futsal":             return <FutsalIcon {...props} />;
    case "floorball":          return <FloorballIcon {...props} />;
    case "beach-volleyball":   return <BeachVolleyballIcon {...props} />;
    case "pickleball":         return <PickleballIcon {...props} />;
    // Neutral fallback so any unrecognised sport key never renders the
    // tennis-racket glyph and mislabels facilities/games.
    default:                   return <CourtIcon {...props} />;
  }
}

/**
 * Neutral fallback for sports that aren't in {@link sportColor}. Uses a muted
 * slate gray so an unknown sport never gets silently rendered in the lime
 * tennis brand color (which would otherwise mislabel it as tennis).
 */
export const SPORT_COLOR_FALLBACK = "#64748b";

/**
 * Returns the brand color for a known sport, or a neutral gray for any
 * unrecognised sport key. Centralises the lookup so call sites don't inline
 * `sportColor[sport] ?? "#84cc16"`, which previously made unknown sports
 * appear identical to tennis.
 */
export function getSportColor(sport?: string | null): string {
  if (!sport) return SPORT_COLOR_FALLBACK;
  return sportColor[sport] ?? SPORT_COLOR_FALLBACK;
}

export const sportColor: Record<string, string> = {
  tennis:             "#84cc16",
  basketball:         "#f97316",
  padel:              "#3b82f6",
  football:           "#22c55e",
  badminton:          "#a855f7",
  squash:             "#06b6d4",
  table_tennis:       "#f43f5e",
  "table-tennis":     "#f43f5e",
  golf:               "#ca8a04",
  snooker:            "#0d9488",
  bowling:            "#dc2626",
  volleyball:         "#eab308",
  hockey:             "#6366f1",
  futsal:             "#10b981",
  floorball:          "#e11d48",
  "beach-volleyball": "#0ea5e9",
  pickleball:         "#65a30d",
};

export const sportAbbr: Record<string, string> = {
  tennis:             "TN",
  basketball:         "BB",
  padel:              "PD",
  football:           "FT",
  badminton:          "BM",
  squash:             "SQ",
  table_tennis:       "TT",
  "table-tennis":     "TT",
  golf:               "GL",
  snooker:            "SN",
  bowling:            "BW",
  volleyball:         "VB",
  hockey:             "HK",
  futsal:             "FS",
  floorball:          "FB",
  "beach-volleyball": "BV",
  pickleball:         "PB",
};

/**
 * SINGLE SOURCE OF TRUTH — sport display labels (Lithuanian).
 * All UI surfaces must import from here. Aliases like "table-tennis" map to
 * the same label as "table_tennis" so legacy slugs keep working.
 *
 * The const-typed inner object preserves literal keys so other helpers (e.g.
 * `sport-images.ts`) can enforce exhaustive coverage at compile time via
 * {@link SportKey}. The exported `SPORT_LABELS` keeps its loose
 * `Record<string, string>` type so the many callers that index it with an
 * arbitrary `string` continue to compile unchanged.
 */
const SPORT_LABELS_BY_KEY = {
  tennis:               "Tenisas",
  basketball:           "Krepšinis",
  padel:                "Padelis",
  football:             "Futbolas",
  badminton:            "Badmintonas",
  squash:               "Skvošas",
  table_tennis:         "Stalo tenisas",
  "table-tennis":       "Stalo tenisas",
  golf:                 "Golfas",
  snooker:              "Snukeris",
  bowling:              "Boulingas",
  volleyball:           "Tinklinis",
  hockey:               "Ledo ritulys",
  futsal:               "Futsalas",
  floorball:            "Florbolas",
  "beach-volleyball":   "Paplūdimio tinklinis",
  pickleball:           "Pickleball",
} as const;

/** Literal union of every recognised sport slug, including legacy aliases. */
export type SportKey = keyof typeof SPORT_LABELS_BY_KEY;

export const SPORT_LABELS: Record<string, string> = SPORT_LABELS_BY_KEY;

export function getSportLabel(sport?: string | null): string {
  if (!sport) return "";
  return SPORT_LABELS[sport] ?? sport;
}

/**
 * SINGLE SOURCE OF TRUTH — sport emojis. Used for compact text contexts
 * (rank badges, chat fallbacks). Visual SVG should use <SportIcon>.
 */
export const SPORT_EMOJIS: Record<string, string> = {
  tennis:               "🎾",
  basketball:           "🏀",
  padel:                "🏓",
  football:             "⚽",
  badminton:            "🏸",
  squash:               "🎯",
  table_tennis:         "🏓",
  "table-tennis":       "🏓",
  golf:                 "⛳",
  snooker:              "🎱",
  bowling:              "🎳",
  volleyball:           "🏐",
  hockey:               "🏒",
  futsal:               "⚽",
  floorball:            "🏑",
  "beach-volleyball":   "🏐",
  pickleball:           "🏓",
};

export function getSportEmoji(sport?: string | null): string {
  if (!sport) return "🏅";
  return SPORT_EMOJIS[sport] ?? "🏅";
}

/** Canonical sport chip: colored SVG icon + Lithuanian label. Use instead of ad-hoc SportIcon+label combos. */
export type SportPillVariant = "solid" | "subtle" | "outline";
export type SportPillSize = "sm" | "md";

type SportPillProps = {
  sport: string;
  variant?: SportPillVariant;
  size?: SportPillSize;
  showLabel?: boolean;
  className?: string;
};

const PILL_SIZE: Record<SportPillSize, { text: string; padX: string; padY: string; gap: string; icon: number }> = {
  sm: { text: "text-[10px]", padX: "px-2",   padY: "py-0.5", gap: "gap-1",   icon: 11 },
  md: { text: "text-xs",     padX: "px-2.5", padY: "py-1",   gap: "gap-1.5", icon: 13 },
};

export function SportPill({
  sport,
  variant = "subtle",
  size = "sm",
  showLabel = true,
  className = "",
}: SportPillProps) {
  const color = getSportColor(sport);
  const label = SPORT_LABELS[sport] ?? sport;
  const s = PILL_SIZE[size];

  let layoutClass = "";
  let layoutStyle: React.CSSProperties | undefined;
  let iconStyle: React.CSSProperties | undefined;

  switch (variant) {
    case "solid":
      layoutClass = "text-white";
      layoutStyle = { background: color };
      iconStyle = { color: "#fff" };
      break;
    case "outline":
      layoutClass = "border bg-transparent";
      layoutStyle = { borderColor: color, color };
      iconStyle = { color };
      break;
    case "subtle":
    default:
      layoutClass = "bg-muted text-muted-foreground";
      iconStyle = { color };
      break;
  }

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.text} font-semibold ${s.padX} ${s.padY} rounded-full ${layoutClass} ${className}`}
      style={layoutStyle}
      title={label}
      aria-label={showLabel ? undefined : label}
    >
      <SportIcon sport={sport} size={s.icon} strokeWidth={2} className="shrink-0" style={iconStyle} aria-hidden="true" />
      {showLabel && <span className="leading-none">{label}</span>}
    </span>
  );
}
