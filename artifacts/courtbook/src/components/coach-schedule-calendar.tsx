import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X, Lock, User, Mail, Phone, MapPin, Loader2, AlertCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useViewAsCoach, withCoachViewAs } from "@/lib/view-as-coach";
import { centsToEuroString } from "@/lib/money";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkingHour { dayOfWeek: number; startTime: string; endTime: string }
interface BlockedSlot { id: number; startTime: string; endTime: string; reason: string | null }
interface ScheduleBooking {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  courtId: number | null;
  courtName: string | null;
  facilityName: string | null;
  serviceId: number | null;
  serviceName: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  totalPriceCents: number;
  isManual: boolean;
  isPaid: boolean;
}

interface ScheduleResponse {
  range: { from: string; to: string; days: string[] };
  workingHours: WorkingHour[];
  blocks: BlockedSlot[];
  bookings: ScheduleBooking[];
}

interface AffiliatedFacility {
  facilityId: number | null;
  facilityName: string | null;
  city: string | null;
  courts: Array<{ id: number; name: string }>;
}

type Cell =
  | { kind: "free"; slot: string }
  | { kind: "blocked"; block: BlockedSlot }
  | { kind: "booked"; booking: ScheduleBooking };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ["Sk", "Pr", "An", "Tr", "Kt", "Pn", "Št"];
const WEEKDAY_LONG = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];

function ymd(d: Date): string {
  // Format a Date as YYYY-MM-DD in local time. The calendar pivots on Vilnius
  // local days (which is what the backend stores), and our dev/host machines
  // are configured to that zone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymdStr: string, n: number): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return ymd(date);
}

function dayOfWeek(ymdStr: string): number {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function formatDateLong(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("lt-LT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatDateShort(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("lt-LT", { month: "short", day: "numeric" });
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 30-minute slot starts within the working hours envelope for a given day.
function slotsForDay(date: string, workingHours: WorkingHour[]): string[] {
  const dow = dayOfWeek(date);
  const rows = workingHours.filter((h) => h.dayOfWeek === dow);
  if (rows.length === 0) return [];
  const slots: string[] = [];
  for (const r of rows) {
    for (let m = toMin(r.startTime); m + 30 <= toMin(r.endTime); m += 30) {
      slots.push(fromMin(m));
    }
  }
  return Array.from(new Set(slots)).sort();
}

// Convert an ISO instant to local HH:MM. Local-time math; the backend stores
// blocks as UTC instants but the dashboard runs in the coach's zone.
function isoToLocalHM(iso: string): { date: string; hm: string } {
  const d = new Date(iso);
  return { date: ymd(d), hm: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
}

// Build a (date → HH:MM → Cell) map from raw schedule data so the renderer can
// just look up `cells[date][slot]` per row.
function buildCellMap(
  days: string[],
  workingHours: WorkingHour[],
  blocks: BlockedSlot[],
  bookings: ScheduleBooking[],
): Record<string, Record<string, Cell>> {
  const out: Record<string, Record<string, Cell>> = {};
  for (const d of days) {
    const dayCells: Record<string, Cell> = {};
    const slots = slotsForDay(d, workingHours);
    for (const s of slots) dayCells[s] = { kind: "free", slot: s };
    out[d] = dayCells;
  }
  // Apply blocks. A block can span multiple slots; mark every 30-min slot it
  // covers as blocked. We trust the user's working-hours envelope — blocks
  // outside it are ignored for display.
  for (const b of blocks) {
    const startLocal = isoToLocalHM(b.startTime);
    const endLocal = isoToLocalHM(b.endTime);
    const startMin = toMin(startLocal.hm);
    const endMin = endLocal.date === startLocal.date ? toMin(endLocal.hm) : 24 * 60;
    if (!out[startLocal.date]) continue;
    for (let m = startMin; m < endMin; m += 30) {
      const slot = fromMin(m);
      if (out[startLocal.date][slot]) out[startLocal.date][slot] = { kind: "blocked", block: b };
    }
  }
  for (const bk of bookings) {
    if (!out[bk.date]) continue;
    const startMin = toMin(bk.startTime);
    const endMin = toMin(bk.endTime);
    for (let m = startMin; m < endMin; m += 30) {
      const slot = fromMin(m);
      if (out[bk.date][slot]) out[bk.date][slot] = { kind: "booked", booking: bk };
    }
  }
  return out;
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CoachScheduleCalendar() {
  const { asCoachId } = useViewAsCoach();
  const isViewingAs = asCoachId != null;
  const [view, setView] = useState<"day" | "week">("day");
  const [anchor, setAnchor] = useState<string>(ymd(new Date()));

  // For week view, anchor snaps to the Monday of the week.
  const weekStart = useMemo(() => {
    const d = new Date(anchor + "T00:00:00");
    // JS getDay: 0=Sun..6=Sat. We want Mon..Sun ordering, so shift to Monday.
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return ymd(d);
  }, [anchor]);

  const from = view === "day" ? anchor : weekStart;
  const to = view === "day" ? anchor : addDays(weekStart, 6);

  const { data, isLoading } = useQuery<ScheduleResponse>({
    queryKey: ["coach-schedule", from, to, asCoachId],
    queryFn: () => customFetch<ScheduleResponse>(
      withCoachViewAs(`${API}/coaches/me/schedule?from=${from}&to=${to}`),
    ),
  });

  const days = data?.range.days ?? (view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
  const cells = useMemo(() => {
    if (!data) return {};
    return buildCellMap(days, data.workingHours, data.blocks, data.bookings);
  }, [data, days]);

  // The union of all slot times shown across visible days. Used as the row
  // axis for the week grid so every column lines up. Day view uses only the
  // single day's slots.
  const allSlots = useMemo(() => {
    const s = new Set<string>();
    for (const d of days) for (const slot of Object.keys(cells[d] ?? {})) s.add(slot);
    return Array.from(s).sort();
  }, [cells, days]);

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [openAction, setOpenAction] = useState<{ date: string; slot: string } | null>(null);
  const [openBooking, setOpenBooking] = useState<ScheduleBooking | null>(null);
  const [openRemoveBlock, setOpenRemoveBlock] = useState<BlockedSlot | null>(null);

  const onCellClick = (date: string, slot: string) => {
    const c = cells[date]?.[slot];
    if (!c) return;
    if (c.kind === "free") setOpenAction({ date, slot });
    else if (c.kind === "booked") setOpenBooking(c.booking);
    else if (c.kind === "blocked") setOpenRemoveBlock(c.block);
  };

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Tvarkaraštis
          </h2>
          <p className="text-xs text-muted-foreground">
            Spauskite ant langelio: laisvą — užblokuoti arba rezervuoti, užimtą — peržiūrėti.
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week")}>
          <TabsList className="h-8">
            <TabsTrigger value="day" className="text-xs px-3">Diena</TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-3">Savaitė</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <DateNav
        view={view}
        anchor={anchor}
        weekStart={weekStart}
        onPrev={() => setAnchor((a) => addDays(a, view === "day" ? -1 : -7))}
        onNext={() => setAnchor((a) => addDays(a, view === "day" ? 1 : 7))}
        onToday={() => setAnchor(ymd(new Date()))}
      />

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : view === "day" ? (
        <DayGrid date={anchor} cells={cells[anchor] ?? {}} onSlotClick={(slot) => onCellClick(anchor, slot)} />
      ) : (
        <WeekGrid days={days} slots={allSlots} cells={cells} onCellClick={onCellClick} />
      )}

      {/* Slot action: block or reserve manually */}
      {openAction && (
        <SlotActionDialog
          date={openAction.date}
          slot={openAction.slot}
          isViewingAs={isViewingAs}
          onClose={() => setOpenAction(null)}
        />
      )}

      {/* Booking details + cancel */}
      {openBooking && (
        <BookingDetailsDialog
          booking={openBooking}
          isViewingAs={isViewingAs}
          onClose={() => setOpenBooking(null)}
        />
      )}

      {/* Remove block */}
      {openRemoveBlock && (
        <RemoveBlockDialog
          block={openRemoveBlock}
          isViewingAs={isViewingAs}
          onClose={() => setOpenRemoveBlock(null)}
        />
      )}
    </section>
  );
}

// ─── Date nav ────────────────────────────────────────────────────────────────

function DateNav({
  view, anchor, weekStart, onPrev, onNext, onToday,
}: {
  view: "day" | "week";
  anchor: string;
  weekStart: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const label = view === "day"
    ? formatDateLong(anchor)
    : `${formatDateShort(weekStart)} – ${formatDateShort(addDays(weekStart, 6))}`;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrev} aria-label="Atgal">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onToday}>
        Šiandien
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext} aria-label="Pirmyn">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium ml-2 truncate">{label}</span>
    </div>
  );
}

// ─── Day grid ────────────────────────────────────────────────────────────────

function DayGrid({
  date, cells, onSlotClick,
}: {
  date: string;
  cells: Record<string, Cell>;
  onSlotClick: (slot: string) => void;
}) {
  const slots = Object.keys(cells).sort();
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground space-y-1">
        <p>Šiai dienai nenustatytos darbo valandos.</p>
        <p className="text-xs">Tvarkaraštį galite nustatyti puslapyje „Tvarkaraštis".</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <ul className="divide-y">
        {slots.map((s) => (
          <DayRow key={s} slot={s} cell={cells[s]!} onClick={() => onSlotClick(s)} />
        ))}
      </ul>
    </div>
  );
}

function DayRow({ slot, cell, onClick }: { slot: string; cell: Cell; onClick: () => void }) {
  const next = fromMin(toMin(slot) + 30);
  // Booked cells span multiple slot rows; we still render one row per slot so
  // the underlying timeline is uniform. The booking label appears on the
  // first slot of the run (which the renderer can spot when prevCell !== this
  // cell), but for simplicity we repeat it on every covered row.
  const isBooked = cell.kind === "booked";
  const isBlocked = cell.kind === "blocked";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors
          ${isBooked ? "bg-primary/10 hover:bg-primary/15" : ""}
          ${isBlocked ? "bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200/60 dark:hover:bg-amber-900/40" : ""}
          ${cell.kind === "free" ? "hover:bg-muted/60" : ""}
        `}
      >
        <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{slot}–{next}</span>
        <span className="flex-1 min-w-0 text-sm truncate">
          {cell.kind === "free" && <span className="text-muted-foreground">Laisva</span>}
          {cell.kind === "blocked" && (
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{cell.block.reason || "Užblokuota"}</span>
            </span>
          )}
          {cell.kind === "booked" && (
            <span className="flex items-center gap-1.5 text-foreground">
              <User className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium truncate">{cell.booking.customerName}</span>
              {cell.booking.courtName && (
                <span className="text-xs text-muted-foreground truncate">· {cell.booking.courtName}</span>
              )}
              {cell.booking.isManual && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">Rankinis</span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

// ─── Week grid ───────────────────────────────────────────────────────────────

function WeekGrid({
  days, slots, cells, onCellClick,
}: {
  days: string[];
  slots: string[];
  cells: Record<string, Record<string, Cell>>;
  onCellClick: (date: string, slot: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Šiai savaitei nenustatytos darbo valandos.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border bg-card overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header row */}
        <div className="grid border-b text-xs font-semibold sticky top-0 bg-card z-10" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
          <div className="px-2 py-2"></div>
          {days.map((d) => {
            const dow = dayOfWeek(d);
            const isToday = d === ymd(new Date());
            return (
              <div key={d} className={`px-2 py-2 text-center ${isToday ? "text-primary" : ""}`}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{WEEKDAY_SHORT[dow]}</div>
                <div className="text-sm">{formatDateShort(d)}</div>
              </div>
            );
          })}
        </div>
        {/* Slot rows */}
        {slots.map((slot) => (
          <div key={slot} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
            <div className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground border-r">{slot}</div>
            {days.map((d) => {
              const cell = cells[d]?.[slot];
              return <WeekCell key={d + slot} cell={cell} onClick={() => cell && onCellClick(d, slot)} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekCell({ cell, onClick }: { cell: Cell | undefined; onClick: () => void }) {
  if (!cell) {
    return <div className="border-r last:border-r-0 bg-muted/30" />;
  }
  const base = "border-r last:border-r-0 px-1.5 py-1 text-[11px] cursor-pointer transition-colors min-h-[28px]";
  if (cell.kind === "free") {
    return <button type="button" onClick={onClick} className={`${base} hover:bg-muted/60 text-left text-muted-foreground/60`}>·</button>;
  }
  if (cell.kind === "blocked") {
    return (
      <button type="button" onClick={onClick} className={`${base} text-left bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300`}>
        <span className="truncate block">{cell.block.reason || "Užbl."}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} text-left bg-primary/15 hover:bg-primary/25 text-foreground`}>
      <span className="truncate block font-medium">{cell.booking.customerName}</span>
    </button>
  );
}

// ─── Slot action dialog (block / reserve) ───────────────────────────────────

function SlotActionDialog({
  date, slot, isViewingAs, onClose,
}: {
  date: string;
  slot: string;
  isViewingAs: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<"block" | "reserve">("block");
  const slotEnd = fromMin(toMin(slot) + 30);

  // Convert slot HH:MM on the given date into an ISO instant. We treat the
  // user's local time as authoritative — `new Date("YYYY-MM-DDTHH:MM:00")`
  // interprets it as local, which is what we want.
  const startIso = new Date(`${date}T${slot}:00`).toISOString();
  const endIso = new Date(`${date}T${slotEnd}:00`).toISOString();

  // Block form
  const [reason, setReason] = useState("");
  const block = useMutation({
    mutationFn: () => customFetch(`${API}/coaches/me/blocked-slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: startIso, endTime: endIso, reason: reason || null }),
    }),
    onSuccess: () => {
      toast({ title: "Slotas užblokuotas" });
      qc.invalidateQueries({ queryKey: ["coach-schedule"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  // Reserve form — fetch affiliated courts so the coach can pick one.
  const { asCoachId } = useViewAsCoach();
  const { data: facilities = [] } = useQuery<AffiliatedFacility[]>({
    queryKey: ["coach-me-facilities", asCoachId],
    queryFn: () => customFetch<AffiliatedFacility[]>(withCoachViewAs(`${API}/coaches/me/facilities`)),
    enabled: mode === "reserve",
  });
  const courtOptions = useMemo(() => {
    const out: Array<{ id: number; label: string }> = [];
    for (const f of facilities) {
      for (const c of f.courts) {
        out.push({ id: c.id, label: f.facilityName ? `${f.facilityName} · ${c.name}` : c.name });
      }
    }
    return out;
  }, [facilities]);

  const [courtId, setCourtId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");

  const reserve = useMutation({
    mutationFn: () => {
      if (!courtId) throw new Error("Pasirinkite aikštelę");
      if (!customerName.trim()) throw new Error("Įveskite mokinio vardą");
      return customFetch(`${API}/coaches/me/manual-bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          date,
          startTime: slot,
          endTime: slotEnd,
          note: note.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Rezervacija sukurta" });
      qc.invalidateQueries({ queryKey: ["coach-schedule"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatDateLong(date)} · {slot}–{slotEnd}</DialogTitle>
          <DialogDescription>Pasirinkite veiksmą šiam laiko langui.</DialogDescription>
        </DialogHeader>

        {isViewingAs && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            Tik skaitymo režimas — žiūrite kaip kitas treneris.
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as "block" | "reserve")}>
          <TabsList className="w-full">
            <TabsTrigger value="block" className="flex-1"><Lock className="h-3.5 w-3.5 mr-1.5" />Blokuoti</TabsTrigger>
            <TabsTrigger value="reserve" className="flex-1"><Plus className="h-3.5 w-3.5 mr-1.5" />Rezervuoti</TabsTrigger>
          </TabsList>

          <TabsContent value="block" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-reason">Priežastis (neprivaloma)</Label>
              <Input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Atostogos, asmeniniai reikalai..." maxLength={280} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Atšaukti</Button>
              <Button onClick={() => block.mutate()} disabled={block.isPending || isViewingAs}>
                {block.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Užblokuoti
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="reserve" className="space-y-3 mt-3">
            {courtOptions.length === 0 ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Norėdami sukurti rezervaciją, pirmiausia užmegzkite partnerystę su bent viena aikštele puslapyje „Nustatymai".
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Aikštelė</Label>
                  <Select value={courtId?.toString() ?? ""} onValueChange={(v) => setCourtId(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Pasirinkite aikštelę" /></SelectTrigger>
                    <SelectContent>
                      {courtOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-name">Mokinio vardas</Label>
                  <Input id="m-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-email">El. paštas</Label>
                    <Input id="m-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="neprivaloma" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-phone">Telefonas</Label>
                    <Input id="m-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="neprivaloma" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-note">Pastaba</Label>
                  <Textarea id="m-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="neprivaloma" maxLength={280} />
                </div>
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Atšaukti</Button>
              <Button onClick={() => reserve.mutate()} disabled={reserve.isPending || isViewingAs || courtOptions.length === 0}>
                {reserve.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Rezervuoti
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Booking details + cancel ───────────────────────────────────────────────

function BookingDetailsDialog({
  booking, isViewingAs, onClose,
}: {
  booking: ScheduleBooking;
  isViewingAs: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancel = useMutation({
    mutationFn: () => customFetch(`${API}/bookings/${booking.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Rezervacija atšaukta" });
      qc.invalidateQueries({ queryKey: ["coach-schedule"] });
      setConfirmCancel(false);
      onClose();
    },
    onError: (e: Error) => toast({ title: "Klaida atšaukiant", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rezervacija</DialogTitle>
            <DialogDescription>
              {formatDateLong(booking.date)} · {booking.startTime}–{booking.endTime}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <DetailRow icon={User} label="Mokinys" value={booking.customerName} />
            {booking.customerEmail && <DetailRow icon={Mail} label="El. paštas" value={booking.customerEmail} />}
            {booking.customerPhone && <DetailRow icon={Phone} label="Telefonas" value={booking.customerPhone} />}
            {booking.courtName && (
              <DetailRow icon={MapPin} label="Aikštelė" value={`${booking.facilityName ? booking.facilityName + " · " : ""}${booking.courtName}`} />
            )}
            {booking.serviceName && <DetailRow icon={CalendarDays} label="Paslauga" value={booking.serviceName} />}
            <div className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_CLASS[booking.status] ?? "bg-muted text-muted-foreground"}`}>
                {STATUS_LABEL[booking.status] ?? booking.status}
              </span>
              {booking.isPaid && (
                <span className="text-muted-foreground">{centsToEuroString(booking.totalPriceCents)} €</span>
              )}
              {booking.isManual && (
                <span className="text-muted-foreground">Rankinis įrašas</span>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose}>Uždaryti</Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmCancel(true)}
              disabled={isViewingAs || booking.status === "cancelled"}
            >
              <Ban className="h-4 w-4 mr-1.5" />
              Atšaukti rezervaciją
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atšaukti rezervaciją?</AlertDialogTitle>
            <AlertDialogDescription>
              {booking.isPaid
                ? "Mokėta rezervacija — bus pritaikyta jūsų atšaukimo politika ir, jei reikia, grąžinta pinigų suma."
                : "Šis rankinis įrašas bus pažymėtas kaip atšauktas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Grįžti</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              {cancel.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Patvirtinti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Laukia",
  awaiting_players: "Renkasi žaidėjai",
  confirmed: "Patvirtinta",
  cancelled: "Atšaukta",
  blocked: "Užblokuota",
};
const STATUS_CLASS: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  awaiting_players: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
  blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

// ─── Remove block dialog ────────────────────────────────────────────────────

function RemoveBlockDialog({
  block, isViewingAs, onClose,
}: {
  block: BlockedSlot;
  isViewingAs: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const start = new Date(block.startTime);
  const end = new Date(block.endTime);

  const remove = useMutation({
    mutationFn: () => customFetch(`${API}/coaches/me/blocked-slots/${block.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Blokas pašalintas" });
      qc.invalidateQueries({ queryKey: ["coach-schedule"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Užblokuotas laikas</DialogTitle>
          <DialogDescription>
            {start.toLocaleString("lt-LT", { dateStyle: "full", timeStyle: "short" })} – {end.toLocaleTimeString("lt-LT", { timeStyle: "short" })}
          </DialogDescription>
        </DialogHeader>
        {block.reason && (
          <p className="text-sm text-muted-foreground">{block.reason}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Uždaryti</Button>
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending || isViewingAs}>
            {remove.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <X className="h-4 w-4 mr-1.5" />
            Pašalinti bloką
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
