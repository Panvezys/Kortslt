import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, Building2, CreditCard, Settings,
  LogOut, Menu, X, ArrowLeft, BarChart3, Euro, CalendarDays,
  Users, Clock, CheckCircle2, XCircle, ChevronRight, ExternalLink, Ban,
} from "lucide-react";
import { CourtIcon } from "@/components/sport-icon";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", padel: "Padelis", squash: "Skvošas",
  badminton: "Badmintonas", basketball: "Krepšinis", football: "Futbolas",
  volleyball: "Tinklinis", table_tennis: "Stalo tenisas", pickleball: "Pickleball",
};
const SPORT_EMOJIS: Record<string, string> = {
  tennis: "🎾", padel: "🏓", squash: "🟠", badminton: "🏸",
  basketball: "🏀", football: "⚽", volleyball: "🏐", table_tennis: "🏓",
  pickleball: "🥒",
};
const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
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

function buildNavItems(facilityId: number | string | null) {
  if (!facilityId) return [
    { icon: LayoutDashboard, label: "Suvestinė",      href: `${BASE_URL}/owner/dashboard` },
    { icon: Building2,       label: "Mano aikštelės", href: `${BASE_URL}/owner` },
    { icon: CreditCard,      label: "Mokėjimai",      href: `${BASE_URL}/owner/payments` },
    { icon: Settings,        label: "Nustatymai",     href: `${BASE_URL}/owner/settings` },
  ];
  const fid = Number(facilityId);
  return [
    { icon: LayoutDashboard, label: "Suvestinė",      href: `${BASE_URL}/owner/dashboard?facility=${fid}` },
    { icon: Building2,       label: "Mano aikštelės", href: `${BASE_URL}/owner/facility/${fid}` },
    { icon: CreditCard,      label: "Mokėjimai",      href: `${BASE_URL}/owner/payments?facility=${fid}` },
    { icon: Settings,        label: "Nustatymai",     href: `${BASE_URL}/owner/settings?facility=${fid}` },
  ];
}

function Sidebar({ open, onClose, facilityId, facilityName, activeHref }: {
  open: boolean; onClose: () => void; facilityId: number | null; facilityName?: string; activeHref: string;
}) {
  const [, navigate] = useLocation();
  const navItems = buildNavItems(facilityId);
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:flex md:z-auto
      `}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-border shrink-0">
          <Link href="/" className="font-bold text-lg tracking-tight">korts<span className="text-primary">.lt</span></Link>
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {facilityName && (
          <div className="px-4 py-2.5 border-b border-border/60 bg-muted/30">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Objektas</p>
            <p className="text-sm font-medium truncate">{facilityName}</p>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">Valdymas</p>
          {navItems.map(item => {
            const isActive = activeHref === item.href;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={e => { e.preventDefault(); onClose(); navigate(item.href.replace(BASE_URL, "") || "/"); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" />
            Grįžti į svetainę
          </button>
        </div>
      </aside>
    </>
  );
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bookingsTab, setBookingsTab] = useState<"today" | "week" | "all">("today");
  const [blockOpen, setBlockOpen] = useState(false);

  const { data, isLoading, error } = useQuery<CourtStats>({
    queryKey: ["owner-court-stats", courtId],
    queryFn: () => customFetch<CourtStats>(`${API_URL}/owner/courts/${courtId}/stats`),
    enabled: !!courtId,
  });

  const today = todayStr();

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/20 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} facilityId={Number(facilityId) || null} activeHref="" />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="h-16 border-b border-border flex items-center px-6"><Skeleton className="h-5 w-48" /></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen bg-muted/20 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} facilityId={Number(facilityId) || null} activeHref="" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Nepavyko gauti duomenų</p>
            <Button variant="outline" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Grįžti
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { court, facility, monthlyRevenue, monthlyBookingCount, todayBookings, weeklyBookings, recentBookings } = data;

  const displayedBookings =
    bookingsTab === "today" ? todayBookings :
    bookingsTab === "week" ? weeklyBookings :
    recentBookings;

  const todayCount = todayBookings.filter(b => ["confirmed","pending"].includes(b.status)).length;
  const monthlyRevenueStr = fmtPrice(monthlyRevenue);
  const facilityIdNum = court.facilityId ?? Number(facilityId);

  return (
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        facilityId={facilityIdNum}
        facilityName={facility?.name}
        activeHref=""
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate(`/owner/facility/${facilityIdNum}`)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{facility?.name ?? "Kortas"}</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{SPORT_EMOJIS[court.type] ?? "🏟️"}</span>
                <h1 className="font-bold text-base leading-tight">{court.name}</h1>
                <span className="text-xs text-muted-foreground hidden sm:inline">{SPORT_LABELS[court.type] ?? court.type}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => navigate(`/owner/facility/${facilityIdNum}?editCourt=${court.id}`)}
            >
              Valdyti
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
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
    </div>
  );
}
