import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X, ArrowLeft, CalendarDays, ExternalLink, Ban, Plus,
} from "lucide-react";
import { SportPill } from "@/components/sport-icon";
import { OwnerLayout } from "@/components/owner-layout";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};
const STATUS_LT: Record<string, string> = {
  confirmed: "Patvirtinta", pending: "Laukiama", cancelled: "Atšaukta", rejected: "Atmesta",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(diff + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

const DAY_NAMES = ["Pir", "Ant", "Tre", "Ket", "Pen", "Šeš", "Sek"];

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  return `${day}.${m}`;
}

function fmtPrice(n: number) {
  return n.toLocaleString("lt-LT", { style: "currency", currency: "EUR" });
}

interface CourtStats {
  court: {
    id: number; name: string; type: string; status: string;
    pricePerHour: number; facilityId: number | null; isIndoor: boolean | null; imageUrl: string | null;
  };
  todayPricing: Record<string, number>;
  facility: { id: number; name: string } | null;
  monthlyRevenue: number;
  monthlyBookingCount: number;
  todayBookings: Booking[];
  weeklyBookings: Booking[];
  recentBookings: Booking[];
}

interface Booking {
  id: number; courtId: number; customerName: string; customerEmail: string;
  customerPhone?: string | null; date: string; startTime: string; endTime: string;
  totalPrice: number; status: string; createdAt: string;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);
function hhmm(h: number) { return `${String(h).padStart(2, "0")}:00`; }

function BlockCourtModal({
  open, onClose, courtId,
}: {
  open: boolean;
  onClose: () => void;
  courtId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();
  const [date, setDate] = useState(today);
  const [startHour, setStartHour] = useState(hhmm(8));
  const [endHour, setEndHour] = useState(hhmm(9));
  const [notes, setNotes] = useState("");
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  function reset() { setNotes(""); setConflictMsg(null); }

  const mutation = useMutation({
    mutationFn: () =>
      customFetch(`${API_URL}/owner/bookings/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtId, date, startTime: startHour, endTime: endHour, notes: notes || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "Kortas užblokuotas" });
      queryClient.invalidateQueries({ queryKey: ["owner-court-stats", String(courtId)] });
      onClose(); reset();
    },
    onError: (e: any) => {
      const code = e?.data?.code;
      if (code === "CONFIRMED_EXISTS") {
        setConflictMsg("⚠️ Šiuo laiku jau yra patvirtinta rezervacija. Negalite blokuoti užimto laiko.");
      } else if (code === "PENDING_EXISTS") {
        setConflictMsg("ℹ️ Šiuo metu klientas atlieka mokėjimą šiam laikui. Palaukite ir bandykite vėliau.");
      } else {
        toast({ title: "Klaida blokuojant", description: e?.data?.error || e?.message || "Nepavyko užblokuoti korto", variant: "destructive" });
      }
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { onClose(); reset(); }} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={() => { onClose(); reset(); }} className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold mb-1">Blokuoti kortą</h2>
        <p className="text-sm text-muted-foreground mb-5">Pasirinkite datą ir laiką, kurį norite uždaryti.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Data</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setConflictMsg(null); }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Nuo</label>
              <select value={startHour} onChange={e => { setStartHour(e.target.value); setConflictMsg(null); }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.map(h => <option key={h} value={hhmm(h)}>{hhmm(h)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Iki</label>
              <select value={endHour} onChange={e => { setEndHour(e.target.value); setConflictMsg(null); }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.filter(h => h > Number(startHour.split(":")[0])).map(h => <option key={h} value={hhmm(h)}>{hhmm(h)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Pastaba (neprivaloma)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="pvz. Priežiūra, privatus renginys…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
          {conflictMsg && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
              {conflictMsg}
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={() => { onClose(); reset(); }}>Atšaukti</Button>
          <Button className="flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Blokuojama…" : "Blokuoti"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = "text-primary" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function TodayGrid({
  todayBookings,
  pricePerHour,
  todayPricing,
}: {
  todayBookings: Booking[];
  pricePerHour: number;
  todayPricing: Record<string, number>;
}) {
  const now = new Date();
  const currentHour = now.getHours();
  const defaultHalf = pricePerHour / 2;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Šiandien — grafikas</h3>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[360px] max-h-[340px] overflow-y-auto">
          {HOURS.map(hour => {
            const slotStart = `${String(hour).padStart(2, "0")}:00`;
            const slotStart30 = `${String(hour).padStart(2, "0")}:30`;
            const slotEnd = `${String(hour + 1).padStart(2, "0")}:00`;

            const booking = todayBookings.find(b => {
              const bStart = toMin(b.startTime);
              const bEnd = toMin(b.endTime);
              return bStart <= hour * 60 && bEnd > hour * 60 && ["confirmed","pending","blocked"].includes(b.status);
            });

            const isNow = hour === currentHour;
            const isPast = hour < currentHour;

            // Per-slot price for display: check :00 first, then :30
            const slotPrice = todayPricing[slotStart] ?? todayPricing[slotStart30] ?? defaultHalf;

            return (
              <div
                key={hour}
                className={`flex items-center border-b border-border/40 last:border-0 px-3 py-1.5 gap-3 min-h-[44px] ${isNow ? "bg-primary/5" : isPast ? "bg-muted/20" : ""}`}
              >
                <span className={`text-xs tabular-nums font-mono w-10 shrink-0 ${isNow ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {slotStart}
                </span>
                {booking ? (
                  <div className={`flex-1 rounded px-2 py-1 text-xs font-medium border ${
                    booking.status === "confirmed"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-400/30"
                      : booking.status === "pending"
                        ? "bg-amber-400/15 text-amber-700 dark:text-amber-300 border-amber-400/30"
                        : "bg-zinc-200 dark:bg-zinc-700/50 text-zinc-500 border-zinc-300/40"
                  }`}>
                    <span className="truncate block">{booking.customerName}</span>
                    <span className="text-[10px] opacity-70">{booking.startTime.slice(0,5)}–{booking.endTime.slice(0,5)} · {fmtPrice(booking.totalPrice)}</span>
                  </div>
                ) : (
                  <div className={`flex-1 flex items-center justify-between rounded border border-dashed border-border/40 px-2 py-1 ${isPast ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-3 h-3 text-muted-foreground/40" />
                      <span className="text-[11px] text-muted-foreground/50">{slotStart}–{slotEnd}</span>
                    </div>
                    {slotPrice > 0 && (
                      <span className="text-[10px] text-muted-foreground/50 font-medium">
                        {slotPrice % 1 === 0 ? slotPrice : slotPrice.toFixed(1)}€
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeeklyCalendar({ weeklyBookings }: { weeklyBookings: Booking[] }) {
  const weekDates = getWeekDates();
  const today = todayStr();
  const byDate = new Map<string, Booking[]>();
  for (const d of weekDates) byDate.set(d, []);
  for (const b of weeklyBookings) {
    if (byDate.has(b.date)) byDate.get(b.date)!.push(b);
  }
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Šios savaitės grafikas</h3>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((date, i) => {
          const bookings = byDate.get(date) ?? [];
          const isToday = date === today;
          const isPast = date < today;
          const confirmed = bookings.filter(b => b.status === "confirmed").length;
          const pending = bookings.filter(b => b.status === "pending").length;
          return (
            <div key={date} className={`rounded-xl p-2 text-center border transition-colors ${
              isToday ? "bg-primary/10 border-primary/30" : isPast ? "bg-muted/30 border-border/50" : "bg-muted/10 border-border"
            }`}>
              <p className={`text-[10px] font-medium uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>{DAY_NAMES[i]}</p>
              <p className={`text-xs font-bold mb-1.5 ${isToday ? "text-primary" : "text-foreground"}`}>{fmtDate(date)}</p>
              {bookings.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">–</p>
              ) : (
                <div className="space-y-0.5">
                  {confirmed > 0 && (
                    <div className="rounded bg-emerald-500/15 text-emerald-600 text-[10px] font-semibold px-1 py-0.5">
                      {confirmed} ✓
                    </div>
                  )}
                  {pending > 0 && (
                    <div className="rounded bg-amber-500/15 text-amber-600 text-[10px] font-semibold px-1 py-0.5">
                      {pending} ⏳
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const statusClass = STATUS_COLORS[booking.status] ?? "bg-muted text-muted-foreground border-border";
  const statusLabel = STATUS_LT[booking.status] ?? booking.status;
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{booking.customerName}</p>
        <p className="text-xs text-muted-foreground">
          {fmtDate(booking.date)} · {booking.startTime.slice(0,5)}–{booking.endTime.slice(0,5)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusClass}`}>{statusLabel}</span>
        <span className="text-sm font-semibold">{fmtPrice(booking.totalPrice)}</span>
      </div>
    </div>
  );
}

export default function OwnerCourtDashboard() {
  const params = useParams<{ facilityId: string; courtId: string }>();
  const facilityId = params.facilityId;
  const courtId = params.courtId;
  const [, navigate] = useLocation();
  const [bookingsTab, setBookingsTab] = useState<"today" | "week" | "all">("today");
  const [blockOpen, setBlockOpen] = useState(false);

  const { data, isLoading, error } = useQuery<CourtStats>({
    queryKey: ["owner-court-stats", courtId],
    queryFn: () => customFetch<CourtStats>(`${API_URL}/owner/courts/${courtId}/stats`),
    enabled: !!courtId,
  });

  if (isLoading) {
    return (
      <OwnerLayout facilityId={Number(facilityId) || undefined} title="Aikštelė">
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </OwnerLayout>
    );
  }

  if (error || !data) {
    return (
      <OwnerLayout facilityId={Number(facilityId) || undefined} title="Aikštelė">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Nepavyko gauti duomenų</p>
            <Button variant="outline" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Grįžti
            </Button>
          </div>
        </div>
      </OwnerLayout>
    );
  }

  const { court, facility, monthlyRevenue, monthlyBookingCount, todayBookings, weeklyBookings, recentBookings, todayPricing } = data;

  const displayedBookings =
    bookingsTab === "today" ? todayBookings :
    bookingsTab === "week" ? weeklyBookings :
    recentBookings;

  const todayCount = todayBookings.filter(b => ["confirmed","pending"].includes(b.status)).length;
  const monthlyRevenueStr = fmtPrice(monthlyRevenue);
  const facilityIdNum = court.facilityId ?? Number(facilityId);

  return (
    <OwnerLayout facilityId={facilityIdNum} facilityName={facility?.name} title={court.name}>
      <div className="flex flex-col">
        {/* Page header with court actions */}
        <header className="bg-card border-b border-border flex items-center justify-between px-4 md:px-6 py-3 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">{court.name}</h1>
            <SportPill sport={court.type} variant="subtle" className="hidden sm:inline-flex" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => window.open(`${BASE_URL}/courts/${court.id}`, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Viešas</span>
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1.5 text-xs border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setBlockOpen(true)}
            >
              <Ban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Blokuoti</span>
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Pajamos šį mėn."
              value={monthlyRevenueStr}
              sub="patvirtintų rezervacijų"
              color="text-emerald-500"
            />
            <StatCard
              label="Rezervacijos šį mėn."
              value={monthlyBookingCount}
              sub="patvirtintų + laukiančių"
              color="text-primary"
            />
            <StatCard
              label="Šiandien"
              value={todayCount}
              sub={todayCount === 1 ? "rezervacija" : "rezervacijos"}
              color="text-amber-500"
            />
            <StatCard
              label="Kaina"
              value={`${court.pricePerHour}€/val`}
              sub={court.isIndoor ? "Viduje" : "Lauke"}
              color="text-blue-500"
            />
          </div>

          {/* Today's schedule grid */}
          <TodayGrid
            todayBookings={todayBookings}
            pricePerHour={court.pricePerHour}
            todayPricing={todayPricing ?? {}}
          />

          {/* Weekly calendar */}
          <WeeklyCalendar weeklyBookings={weeklyBookings} />

          {/* Bookings section */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-0 gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Rezervacijos</h3>
              </div>
              <div className="flex gap-0.5">
                {(["today", "week", "all"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setBookingsTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      bookingsTab === tab
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {tab === "today" ? "Šiandien" : tab === "week" ? "Savaitė" : "Visos"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4 mt-3">
              {displayedBookings.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {bookingsTab === "today" ? "Šiandien rezervacijų nėra" :
                   bookingsTab === "week" ? "Šią savaitę rezervacijų nėra" :
                   "Rezervacijų nėra"}
                </div>
              ) : (
                <div>
                  {displayedBookings.map(b => <BookingRow key={b.id} booking={b} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BlockCourtModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        courtId={Number(courtId)}
      />
    </OwnerLayout>
  );
}
