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

export type SportType = "tennis" | "basketball" | "padel" | "football" | "badminton" | "squash" | "table_tennis" | "golf" | "snooker" | "bowling";

export function SportIcon({ sport, ...props }: SvgProps & { sport: string }) {
  switch (sport) {
    case "tennis":       return <TennisIcon {...props} />;
    case "basketball":   return <BasketballIcon {...props} />;
    case "padel":        return <PadelIcon {...props} />;
    case "football":     return <FootballIcon {...props} />;
    case "badminton":    return <BadmintonIcon {...props} />;
    case "squash":       return <SquashIcon {...props} />;
    case "table_tennis": return <TableTennisIcon {...props} />;
    case "golf":         return <GolfIcon {...props} />;
    case "snooker":      return <SnookerIcon {...props} />;
    case "bowling":      return <BowlingIcon {...props} />;
    default:             return <TennisIcon {...props} />;
  }
}

export const sportColor: Record<string, string> = {
  tennis:       "#84cc16",
  basketball:   "#f97316",
  padel:        "#3b82f6",
  football:     "#22c55e",
  badminton:    "#a855f7",
  squash:       "#06b6d4",
  table_tennis: "#f43f5e",
  golf:         "#ca8a04",
  snooker:      "#0d9488",
  bowling:      "#dc2626",
};

export const sportAbbr: Record<string, string> = {
  tennis:       "TN",
  basketball:   "BB",
  padel:        "PD",
  football:     "FT",
  badminton:    "BM",
  squash:       "SQ",
  table_tennis: "TT",
  golf:         "GL",
  snooker:      "SN",
  bowling:      "BW",
};
