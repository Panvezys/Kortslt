import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { useViewAsCoach, withCoachViewAs } from "@/lib/view-as-coach";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

// Sunday=0 to match coach_availabilities.day_of_week (JS getUTCDay/Date.getDay
// convention). Display order starts on Monday — matches LT calendar norms.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sekmadienis",
  1: "Pirmadienis",
  2: "Antradienis",
  3: "Trečiadienis",
  4: "Ketvirtadienis",
  5: "Penktadienis",
  6: "Šeštadienis",
};

interface AvailabilityRow {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface DayForm {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_DAY: DayForm = { enabled: false, startTime: "09:00", endTime: "18:00" };

function seedDays(rows: AvailabilityRow[]): Record<number, DayForm> {
  const out: Record<number, DayForm> = {};
  for (const dow of WEEK_ORDER) out[dow] = { ...DEFAULT_DAY };
  // Collapse multiple ranges per day to a single envelope. Earliest start,
  // latest end. Good enough for the V1 "one shift per day" UI.
  for (const r of rows) {
    const cur = out[r.dayOfWeek] ?? { ...DEFAULT_DAY };
    const start = cur.enabled ? (r.startTime < cur.startTime ? r.startTime : cur.startTime) : r.startTime;
    const end = cur.enabled ? (r.endTime > cur.endTime ? r.endTime : cur.endTime) : r.endTime;
    out[r.dayOfWeek] = { enabled: true, startTime: start, endTime: end };
  }
  return out;
}

function DayRow({
  day,
  label,
  onChange,
}: {
  day: DayForm;
  label: string;
  onChange: (next: DayForm) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <Switch
        checked={day.enabled}
        onCheckedChange={(checked) => onChange({ ...day, enabled: checked })}
        aria-label={label}
      />
      <span className="text-sm font-medium w-32 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Input
          type="time"
          value={day.startTime}
          onChange={(e) => onChange({ ...day, startTime: e.target.value })}
          disabled={!day.enabled}
          className="w-28"
        />
        <span className="text-muted-foreground text-xs">iki</span>
        <Input
          type="time"
          value={day.endTime}
          onChange={(e) => onChange({ ...day, endTime: e.target.value })}
          disabled={!day.enabled}
          className="w-28"
        />
      </div>
    </div>
  );
}

export function CoachWeeklyHours() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { asCoachId } = useViewAsCoach();
  const isViewingAs = asCoachId != null;
  const { data: rows, isLoading } = useQuery<AvailabilityRow[]>({
    queryKey: ["coach-availability", asCoachId],
    queryFn: () => customFetch<AvailabilityRow[]>(withCoachViewAs(`${API}/coaches/me/availability`)),
    staleTime: 60_000,
  });

  const [days, setDays] = useState<Record<number, DayForm>>(() => seedDays([]));

  useEffect(() => {
    if (!rows) return;
    setDays(seedDays(rows));
  }, [rows]);

  const save = useMutation({
    mutationFn: async () => {
      const entries: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = [];
      for (const dow of WEEK_ORDER) {
        const d = days[dow];
        if (!d?.enabled) continue;
        if (!d.startTime || !d.endTime) continue;
        if (d.startTime >= d.endTime) {
          throw new Error(`${WEEKDAY_LABELS[dow]}: pabaigos laikas turi būti vėlesnis už pradžią.`);
        }
        entries.push({ dayOfWeek: dow, startTime: d.startTime, endTime: d.endTime });
      }
      return customFetch<AvailabilityRow[]>(`${API}/coaches/me/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
    },
    onSuccess: () => {
      toast({ title: "Darbo valandos išsaugotos" });
      qc.invalidateQueries({ queryKey: ["coach-availability"] });
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Savaitės valandos</h2>
          <p className="text-xs text-muted-foreground">
            Šios valandos kartojasi kiekvieną savaitę. Vienkartinius pakeitimus
            pridėkite kortelėje „Blokai".
          </p>
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || isLoading || isViewingAs}
          title={isViewingAs ? "Žiūrite kaip kitas treneris — keisti negalima" : undefined}
        >
          {save.isPending ? "Saugoma..." : "Išsaugoti"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card divide-y">
          {WEEK_ORDER.map((dow) => (
            <DayRow
              key={dow}
              day={days[dow] ?? DEFAULT_DAY}
              label={WEEKDAY_LABELS[dow]}
              onChange={(next) => setDays((prev) => ({ ...prev, [dow]: next }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
