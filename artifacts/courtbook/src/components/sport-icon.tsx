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

export type SportType = "tennis" | "basketball" | "padel" | "football" | "badminton" | "squash";

export function SportIcon({ sport, ...props }: SvgProps & { sport: string }) {
  switch (sport) {
    case "tennis":    return <TennisIcon {...props} />;
    case "basketball": return <BasketballIcon {...props} />;
    case "padel":     return <PadelIcon {...props} />;
    case "football":  return <FootballIcon {...props} />;
    case "badminton": return <BadmintonIcon {...props} />;
    case "squash":    return <SquashIcon {...props} />;
    default:          return <TennisIcon {...props} />;
  }
}

export const sportColor: Record<string, string> = {
  tennis:     "#84cc16",
  basketball: "#f97316",
  padel:      "#3b82f6",
  football:   "#22c55e",
  badminton:  "#a855f7",
  squash:     "#06b6d4",
};

export const sportAbbr: Record<string, string> = {
  tennis:     "TN",
  basketball: "BB",
  padel:      "PD",
  football:   "FT",
  badminton:  "BM",
  squash:     "SQ",
};
