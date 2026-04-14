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

export function TennisIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <ellipse cx="11.5" cy="9.5" rx="7" ry="7.5" />
      <line x1="11.5" y1="2" x2="11.5" y2="17" strokeWidth={props.strokeWidth ?? 1.6} />
      <line x1="4.5" y1="9.5" x2="18.5" y2="9.5" strokeWidth={props.strokeWidth ?? 1.6} />
      <line x1="5.5" y1="6" x2="17.5" y2="6" strokeWidth={0.8} />
      <line x1="5.5" y1="13" x2="17.5" y2="13" strokeWidth={0.8} />
      <line x1="8" y1="2.5" x2="8" y2="16.5" strokeWidth={0.8} />
      <line x1="15" y1="2.5" x2="15" y2="16.5" strokeWidth={0.8} />
      <line x1="11.5" y1="17" x2="14" y2="23" />
    </Svg>
  );
}

export function BasketballIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2 C9 6 9 18 12 22" />
      <path d="M12 2 C15 6 15 18 12 22" />
      <path d="M2 11.5 Q7 9.5 12 11.5 Q17 9.5 22 11.5" />
    </Svg>
  );
}

export function PadelIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="2" width="14" height="15" rx="3.5" />
      <line x1="5" y1="7.5" x2="19" y2="7.5" strokeWidth={0.9} />
      <line x1="5" y1="11.5" x2="19" y2="11.5" strokeWidth={0.9} />
      <line x1="5" y1="14" x2="19" y2="14" strokeWidth={0.9} />
      <line x1="9.5" y1="2" x2="9.5" y2="17" strokeWidth={0.9} />
      <line x1="14.5" y1="2" x2="14.5" y2="17" strokeWidth={0.9} />
      <line x1="12" y1="17" x2="12" y2="23" />
      <line x1="10" y1="23" x2="14" y2="23" />
    </Svg>
  );
}

export function FootballIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,7.5 15,10 14,13.5 10,13.5 9,10" fill="currentColor" opacity={0.15} stroke="currentColor" strokeWidth={props.strokeWidth ?? 1.6} />
      <line x1="12" y1="2" x2="12" y2="7.5" />
      <line x1="15" y1="10" x2="20.5" y2="8.5" />
      <line x1="14" y1="13.5" x2="18" y2="17.5" />
      <line x1="10" y1="13.5" x2="6" y2="17.5" />
      <line x1="9" y1="10" x2="3.5" y2="8.5" />
    </Svg>
  );
}

export function BadmintonIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="20.5" r="1.8" />
      <line x1="12" y1="18.7" x2="5" y2="8" />
      <line x1="12" y1="18.7" x2="12" y2="5" />
      <line x1="12" y1="18.7" x2="19" y2="8" />
      <line x1="12" y1="18.7" x2="7.5" y2="6" />
      <line x1="12" y1="18.7" x2="16.5" y2="6" />
      <path d="M5 8 Q8.5 4.5 12 5 Q15.5 4.5 19 8" />
    </Svg>
  );
}

export function SquashIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="9" r="6.5" />
      <line x1="12" y1="2.5" x2="12" y2="15.5" />
      <line x1="5.5" y1="9" x2="18.5" y2="9" />
      <line x1="7.5" y1="4.5" x2="7.5" y2="13.5" strokeWidth={0.8} />
      <line x1="16.5" y1="4.5" x2="16.5" y2="13.5" strokeWidth={0.8} />
      <line x1="6.5" y1="6.5" x2="17.5" y2="6.5" strokeWidth={0.8} />
      <line x1="6.5" y1="11.5" x2="17.5" y2="11.5" strokeWidth={0.8} />
      <line x1="12" y1="15.5" x2="12" y2="22" />
      <line x1="10" y1="22" x2="14" y2="22" />
    </Svg>
  );
}

export function TableTennisIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      {/* paddle head */}
      <circle cx="9.5" cy="9.5" r="7.5" />
      {/* rubber dividing line */}
      <line x1="2" y1="9.5" x2="17" y2="9.5" strokeWidth={0.8} />
      {/* handle */}
      <path d="M14.5 16.5 L17.5 22" strokeWidth={props.strokeWidth ?? 1.6} strokeLinecap="round" />
      {/* ball */}
      <circle cx="20.5" cy="5" r="2.5" />
    </Svg>
  );
}

export function GolfIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      {/* flag pole */}
      <line x1="7" y1="22" x2="7" y2="2.5" />
      {/* flag */}
      <polygon points="7,2.5 16.5,6.5 7,10.5" fill="currentColor" opacity={0.25} stroke="currentColor" strokeWidth={props.strokeWidth ?? 1.6} />
      {/* hole cup */}
      <ellipse cx="9.5" cy="22" rx="5" ry="1.5" />
      {/* golf ball */}
      <circle cx="19.5" cy="17.5" r="3.5" />
      {/* dimple suggestion */}
      <line x1="18" y1="17.5" x2="21" y2="17.5" strokeWidth={0.6} />
      <line x1="19.5" y1="16" x2="19.5" y2="19" strokeWidth={0.6} />
    </Svg>
  );
}

export function SnookerIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      {/* cue stick */}
      <line x1="2" y1="22" x2="18" y2="6" strokeWidth={props.strokeWidth ?? 1.6} />
      {/* cue tip (thicker) */}
      <line x1="17.5" y1="6.5" x2="19.5" y2="4.5" strokeWidth={3} strokeLinecap="round" />
      {/* red target ball */}
      <circle cx="20" cy="5" r="3.5" fill="currentColor" opacity={0.2} />
      {/* white cue ball */}
      <circle cx="8" cy="17.5" r="3.5" />
    </Svg>
  );
}

export function BowlingIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      {/* bowling ball */}
      <circle cx="11" cy="14.5" r="8" />
      {/* finger holes */}
      <circle cx="8.5" cy="12.5" r="1.2" fill="currentColor" />
      <circle cx="11.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="13" cy="14" r="1.2" fill="currentColor" />
      {/* pin (top-right) */}
      <circle cx="20.5" cy="4" r="2" />
      <path d="M18.5 6 Q17.5 8 18 10.5 L23 10.5 Q23.5 8 22.5 6 Z" fill="currentColor" opacity={0.18} stroke="currentColor" strokeWidth={0.9} />
      <line x1="18" y1="10.5" x2="23" y2="10.5" strokeWidth={0.9} />
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
