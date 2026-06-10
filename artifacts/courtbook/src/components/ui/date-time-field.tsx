import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { lt as ltLocale, enUS, ru as ruLocale } from "date-fns/locale";
import { CalendarDays, Clock, X } from "lucide-react";
import { DateCalendar } from "@/components/ui/date-calendar";

// Site-standard date and start-time pickers, extracted from the home-page hero
// search. Use these everywhere a date/time filter appears (home, /explore,
// /coaches, …) so the controls stay visually identical.

const DEFAULT_ACCENT = "hsl(var(--primary))";
const DEFAULT_ACCENT_FG = "hsl(var(--primary-foreground))";

// Trigger skins: "default" follows the theme (home hero, sidebars); "on-dark"
// is for permanently dark banners (coaches hero) where theme tokens would
// render a light pill on a dark backdrop.
const TRIGGER_CLS = {
  default: "bg-muted/70 dark:bg-white/20 dark:backdrop-blur-md border-border",
  "on-dark": "bg-white/10 backdrop-blur-md border-white/20",
} as const;
const TRIGGER_TEXT = {
  default: "text-foreground dark:text-white",
  "on-dark": "text-white/80",
} as const;
const TRIGGER_ICON = {
  default: "text-muted-foreground dark:text-white/75",
  "on-dark": "text-white/50",
} as const;
const TRIGGER_CLEAR = {
  default: "text-muted-foreground/60 hover:text-muted-foreground dark:text-white/40 dark:hover:text-white/70",
  "on-dark": "text-white/40 hover:text-white/70",
} as const;

type Variant = keyof typeof TRIGGER_CLS;

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [open, onClose]);
  return ref;
}

// ── DateField ─────────────────────────────────────────────────────────────────

interface DateFieldProps {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  accentColor?: string;
  accentFg?: string;
  locale?: string;
  minDate?: Date;
  placeholder?: string;
  /** Which trigger edge the desktop dropdown aligns to. */
  align?: "left" | "right";
  variant?: Variant;
}

export function DateField({
  value, onChange,
  accentColor = DEFAULT_ACCENT, accentFg = DEFAULT_ACCENT_FG,
  locale = "lt", minDate, placeholder = "Data", align = "left", variant = "default",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const dnLocale = locale === "lt" ? ltLocale : locale === "ru" ? ruLocale : enUS;

  return (
    <div className="relative w-full min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex w-full items-center gap-2 border rounded-xl px-3 py-2.5 transition-colors whitespace-nowrap justify-between ${TRIGGER_CLS[variant]}`}
        style={{ borderColor: open ? accentColor : undefined }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarDays className={`h-3.5 w-3.5 shrink-0 ${TRIGGER_ICON[variant]}`} style={{ color: (open || value) ? accentColor : undefined }} />
          <span className={`text-sm truncate ${TRIGGER_TEXT[variant]}`}>
            {value ? format(value, "d MMM", { locale: dnLocale }) : placeholder}
          </span>
        </span>
        {value && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange(undefined); }}
            className={`text-lg leading-none ml-1 shrink-0 ${TRIGGER_CLEAR[variant]}`}
          >×</span>
        )}
      </button>

      {open && (
        <>
          <div className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
          <div className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(280px,calc(100vw-1.5rem))] sm:absolute sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-1 sm:w-[252px] ${align === "right" ? "sm:right-0 sm:left-auto" : "sm:left-0"}`}>
            <DateCalendar
              selected={value}
              onSelect={(d) => { onChange(d); setOpen(false); }}
              onClose={() => setOpen(false)}
              accentColor={accentColor}
              accentFg={accentFg}
              locale={locale}
              minDate={minDate}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── TimeField ─────────────────────────────────────────────────────────────────

const TIME_MIN = 6 * 60;  // 06:00
const TIME_MAX = 23 * 60; // 23:00

function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function parseTimeMinutes(s: string): number | null {
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

interface TimeFieldProps {
  /** Start time "HH:MM" (06:00–23:00), or null = any time. */
  value: string | null;
  onChange: (t: string | null) => void;
  /** Slider granularity in minutes (60 = home hero, 30 = coaches search). */
  stepMinutes?: 30 | 60;
  accentColor?: string;
  accentFg?: string;
  placeholder?: string;
  align?: "left" | "right";
  variant?: Variant;
}

export function TimeField({
  value, onChange, stepMinutes = 60,
  accentColor = DEFAULT_ACCENT, accentFg = DEFAULT_ACCENT_FG,
  placeholder = "Laikas", align = "right", variant = "default",
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  const minutes = value ? parseTimeMinutes(value) : null;
  const sliderValue = minutes ?? 9 * 60;
  const pct = (((sliderValue - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100).toFixed(1);

  return (
    <div className="relative w-full min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex w-full items-center gap-2 border rounded-xl px-3 py-2.5 transition-colors whitespace-nowrap justify-between ${TRIGGER_CLS[variant]}`}
        style={{ borderColor: open ? accentColor : undefined }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Clock className={`h-3.5 w-3.5 shrink-0 ${TRIGGER_ICON[variant]}`} style={{ color: (open || value) ? accentColor : undefined }} />
          <span className={`text-sm truncate ${TRIGGER_TEXT[variant]}`}>
            {value ?? placeholder}
          </span>
        </span>
        {value && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange(null); }}
            className={`text-lg leading-none ml-1 shrink-0 ${TRIGGER_CLEAR[variant]}`}
          >×</span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
          <div className={`
            fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(280px,calc(100vw-1.5rem))]
            sm:absolute sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-1 sm:w-56
            ${align === "right" ? "sm:right-0 sm:left-auto" : "sm:left-0"}
            bg-popover text-popover-foreground border border-border rounded-xl p-3 shadow-2xl
          `}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Pradžios laikas</span>
              <div className="flex items-center gap-1.5">
                {value && (
                  <button onClick={() => onChange(null)} className="text-[10px] hover:underline" style={{ color: accentColor }}>Išvalyti</button>
                )}
                <button onClick={() => setOpen(false)} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="text-center mb-2">
              <span className="text-2xl font-bold tabular-nums">
                {value ?? "--:--"}
              </span>
            </div>

            <div className="relative px-0.5">
              <input
                type="range" min={TIME_MIN} max={TIME_MAX} step={stepMinutes} value={sliderValue}
                onChange={e => onChange(formatMinutes(Number(e.target.value)))}
                onMouseDown={() => { if (!value) onChange(formatMinutes(9 * 60)); }}
                onTouchStart={() => { if (!value) onChange(formatMinutes(9 * 60)); }}
                className="time-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: value ? `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, hsl(var(--muted)) ${pct}%, hsl(var(--muted)) 100%)` : "hsl(var(--muted))" }}
              />
              <div className="flex justify-between mt-1.5">
                {[6, 10, 14, 18, 22].map(h => (
                  <button key={h} onClick={() => onChange(formatMinutes(h * 60))}
                    className="text-[9px] tabular-nums transition-colors text-muted-foreground"
                    style={{ color: minutes === h * 60 ? accentColor : undefined, fontWeight: minutes === h * 60 ? "700" : "400" }}
                  >{h}:00</button>
                ))}
              </div>
            </div>

            <button onClick={() => setOpen(false)} className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: accentColor, color: accentFg }}>
              Patvirtinti
            </button>
          </div>
        </>
      )}
    </div>
  );
}
