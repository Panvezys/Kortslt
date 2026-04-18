import { useState } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, addMonths, subMonths,
} from "date-fns";
import { lt as ltLocale, enUS, ru as ruLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface DateCalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  onClose?: () => void;
  accentColor?: string;
  accentFg?: string;
  locale?: string;
  minDate?: Date;
}

export function DateCalendar({
  selected,
  onSelect,
  onClose,
  accentColor = "#84cc16",
  accentFg = "#000",
  locale = "lt",
  minDate,
}: DateCalendarProps) {
  const [calMonth, setCalMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const dnLocale = locale === "lt" ? ltLocale : locale === "ru" ? ruLocale : enUS;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minD = minDate ?? today;

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const refMon = new Date(2024, 3, 1);
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(refMon);
    d.setDate(d.getDate() + i);
    return format(d, "EEEEE", { locale: dnLocale });
  });

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => setCalMonth(m => subMonths(m, 1))}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize tracking-wide">
          {format(calMonth, "LLLL yyyy", { locale: dnLocale })}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => setCalMonth(m => addMonths(m, 1))}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-7 mb-1">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-semibold py-1 text-muted-foreground"
              style={i >= 5 ? { color: accentColor + "aa" } : undefined}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map(day => {
            const inMonth = isSameMonth(day, calMonth);
            const isPast = isBefore(day, minD);
            const isSelected = selected ? isSameDay(day, selected) : false;
            const isTodayDay = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <button
                key={day.toISOString()}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { if (!isPast) onSelect(day); }}
                disabled={isPast}
                className={[
                  "relative h-8 w-full rounded-lg text-xs font-medium transition-all duration-100 flex items-center justify-center",
                  !inMonth ? "text-muted-foreground/20" :
                  isSelected ? "font-bold shadow-md" :
                  isPast ? "text-muted-foreground/30 cursor-not-allowed" :
                  isTodayDay ? "bg-accent text-accent-foreground ring-1 ring-border hover:bg-accent/80" :
                  "hover:bg-accent text-foreground",
                ].join(" ")}
                style={
                  isSelected ? { background: accentColor, color: accentFg } :
                  (!isPast && !isTodayDay && inMonth && isWeekend) ? { color: accentColor + "cc" } :
                  undefined
                }
              >
                {format(day, "d")}
                {isTodayDay && !isSelected && (
                  <span
                    className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
