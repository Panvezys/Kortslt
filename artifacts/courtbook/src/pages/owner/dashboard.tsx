import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Euro, Percent, CalendarDays, BanknoteIcon, ChevronRight,
  Plus, Phone, X, CheckCircle2, Clock, BarChart3,
  ArrowUpRight, CreditCard, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OwnerLayout, useFacilityId } from "@/components/owner-layout";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08–22

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StripeConnectStatus {
  status: "not_connected" | "pending" | "active";
  accountId: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

interface OwnerCourt { id: number; name: string; type: string; facilityId?: number }

interface OwnerBooking {
  id: number;
  courtId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  bookerUserId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  refundAmount?: number | null;
  status: string;
  createdAt: string;
  courtName?: string | null;
  notes?: string | null;
}

interface BlockedSlot {
  id: number;
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

interface DashboardData {
  facility: { id: number; name: string } | null;
  courts: OwnerCourt[];
  todayBookings: OwnerBooking[];
  todayBlockedSlots: BlockedSlot[];
  recentBookings: OwnerBooking[];
  monthlyRevenue: number;
  monthlyGrossRevenue?: number;
  monthlyRefundedTotal?: number;
  monthlyNetRevenue?: number;
  monthlyBookingCount: number;
}

// ── Slot logic ────────────────────────────────────────────────────────────────

function getSlotKind(
  courtId: number,
  hour: number,
  todayBookings: OwnerBooking[],
  blockedSlots: BlockedSlot[],
): { kind: "confirmed" | "pending" | "blocked" | "free"; booking?: OwnerBooking; blocked?: BlockedSlot } {
  const slotStart = hour * 60;
  const slotEnd = (hour + 1) * 60;

  for (const b of todayBookings) {
    if (b.courtId !== courtId) continue;
    const bStart = toMin(b.startTime);
    const bEnd = toMin(b.endTime);
    if (slotStart < bEnd && slotEnd > bStart) {
      if (b.status === "blocked") return { kind: "blocked", blocked: { id: b.id, courtId: b.courtId, date: b.date, startTime: b.startTime, endTime: b.endTime, reason: b.notes } };
      return { kind: b.status === "confirmed" ? "confirmed" : "pending", booking: b };
    }
  }
  for (const bl of blockedSlots) {
    if (bl.courtId !== courtId) continue;
    const bStart = toMin(bl.startTime);
    const bEnd = toMin(bl.endTime);
    if (slotStart < bEnd && slotEnd > bStart) {
      return { kind: "blocked", blocked: bl };
    }
  }
  return { kind: "free" };
}

// ── Slot Cell ─────────────────────────────────────────────────────────────────

function SlotCell({
  courtId, hour, todayBookings, blockedSlots, onFreeClick, onBookingClick,
}: {
  courtId: number;
  hour: number;
  todayBookings: OwnerBooking[];
  blockedSlots: BlockedSlot[];
  onFreeClick: (courtId: number, hour: number) => void;
  onBookingClick: (booking: OwnerBooking) => void;
}) {
  const { kind, booking, blocked } = getSlotKind(courtId, hour, todayBookings, blockedSlots);

  if (kind === "confirmed") {
    return (
      <div
        onClick={() => booking && onBookingClick(booking)}
        className="h-10 rounded bg-blue-500/15 border border-blue-400/30 hover:bg-blue-500/25 transition-colors flex items-center px-1.5 overflow-hidden cursor-pointer"
      >
        <span className="text-[10px] text-blue-700 dark:text-blue-300 truncate font-medium">{booking?.customerName}</span>
      </div>
    );
  }
  if (kind === "pending") {
    return (
      <div
        onClick={() => booking && onBookingClick(booking)}
        className="h-10 rounded bg-amber-400/20 border border-amber-400/40 hover:bg-amber-400/30 transition-colors flex items-center px-1.5 overflow-hidden cursor-pointer"
      >
        <span className="text-[10px] text-amber-700 dark:text-amber-300 truncate font-medium">{booking?.customerName}</span>
      </div>
    );
  }
  if (kind === "blocked") {
    return (
      <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-700/60 border border-zinc-300/50 dark:border-zinc-600/40 flex items-center px-1.5 overflow-hidden">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-medium">{blocked?.reason || "Užblokuota"}</span>
      </div>
    );
  }
  return (
    <div
      onClick={() => onFreeClick(courtId, hour)}
      className="h-10 rounded border border-dashed border-border/40 hover:bg-muted/40 cursor-pointer transition-colors group flex items-center justify-center"
    >
      <Plus className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
    </div>
  );
}

// ── Manual Booking Modal ──────────────────────────────────────────────────────

function ManualBookingModal({
  open, onClose, courts, preCourtId, preHour,
}: {
  open: boolean;
  onClose: () => void;
  courts: OwnerCourt[];
  preCourtId?: number;
  preHour?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();

  const [courtId, setCourtId] = useState<string>(() => String(preCourtId ?? courts[0]?.id ?? ""));
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [date, setDate] = useState(today);
  const [startHour, setStartHour] = useState<string>(() => preHour != null ? hhmm(preHour) : hhmm(8));
  const [endHour, setEndHour] = useState<string>(() => preHour != null ? hhmm(preHour + 1) : hhmm(9));
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      customFetch(`${API_URL}/owner/bookings/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: Number(courtId),
          customerName,
          customerEmail: customerEmail || `manual-${Date.now()}@korts.lt`,
          customerPhone: customerPhone || undefined,
          date,
          startTime: startHour,
          endTime: endHour,
          note: note || undefined,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Rezervacija sukurta" });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      onClose();
      setCustomerName(""); setCustomerEmail(""); setCustomerPhone(""); setNote("");
    },
    onError: (e: any) => toast({
      title: "Klaida",
      description: e?.data?.error || e?.message || "Nepavyko sukurti rezervacijos",
      variant: "destructive",
    }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold mb-1">Rankinė rezervacija</h2>
        <p className="text-sm text-muted-foreground mb-5">Įveskite rezervacijos duomenis (apeidami Stripe).</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Kliento vardas *</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jonas Jonaitis" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">El. paštas</label>
            <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jonas@pvz.lt" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Telefonas</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+370 600 00000" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Kortas</label>
            <select value={courtId} onChange={e => setCourtId(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Nuo</label>
              <select value={startHour} onChange={e => setStartHour(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.map(h => <option key={h} value={hhmm(h)}>{hhmm(h)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Iki</label>
              <select value={endHour} onChange={e => setEndHour(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.filter(h => h > Number(startHour.split(":")[0])).map(h => <option key={h} value={hhmm(h)}>{hhmm(h)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Pastaba</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Pvz. telefonu gautas…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Atšaukti</Button>
          <Button
            className="flex-1"
            disabled={!customerName || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Block Court Modal ─────────────────────────────────────────────────────────

function BlockCourtModal({
  open, onClose, courts, preCourtId, preDate, preHour,
}: {
  open: boolean;
  onClose: () => void;
  courts: OwnerCourt[];
  preCourtId?: number;
  preDate?: string;
  preHour?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();

  const [courtId, setCourtId] = useState<string>(() => String(preCourtId ?? courts[0]?.id ?? ""));
  const [date, setDate] = useState(preDate ?? today);
  const [startHour, setStartHour] = useState(() => preHour != null ? hhmm(preHour) : hhmm(8));
  const [endHour, setEndHour] = useState(() => preHour != null ? hhmm(preHour + 1) : hhmm(9));
  const [notes, setNotes] = useState("");
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  function reset() {
    setNotes("");
    setConflictMsg(null);
  }

  const mutation = useMutation({
    mutationFn: () =>
      customFetch(`${API_URL}/owner/bookings/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtId: Number(courtId), date, startTime: startHour, endTime: endHour, notes: notes || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "Kortas užblokuotas" });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      onClose();
      reset();
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
        <p className="text-sm text-muted-foreground mb-5">Pasirinkite kortą ir laiką, kurį norite uždaryti.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Kortas</label>
            <select value={courtId} onChange={e => { setCourtId(e.target.value); setConflictMsg(null); }} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
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

// ── Booking Detail Mini-Modal ─────────────────────────────────────────────────

function BookingInfoModal({ booking, onClose }: { booking: OwnerBooking; onClose: () => void }) {
  const [, navigate] = useLocation();
  if (!booking) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold mb-1">Rezervacija #{booking.id}</h2>
        <p className="text-sm text-muted-foreground mb-4">{booking.courtName}</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Klientas</span><span className="font-medium">{booking.customerName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">El. paštas</span><span className="font-medium">{booking.customerEmail}</span></div>
          {booking.customerPhone && <div className="flex justify-between"><span className="text-muted-foreground">Telefonas</span><span className="font-medium">{booking.customerPhone}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{booking.date}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Laikas</span><span className="font-medium">{booking.startTime} – {booking.endTime}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Kaina</span><span className="font-medium">€{booking.totalPrice.toFixed(2)}</span></div>
          <div className="flex justify-between items-center"><span className="text-muted-foreground">Statusas</span>
            <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "destructive" : "secondary"}>
              {booking.status === "confirmed" ? "Patvirtinta" : booking.status === "pending" ? "Laukiama" : "Atšaukta"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Uždaryti</Button>
          <Button className="flex-1" onClick={() => { onClose(); navigate(`/bookings/${booking.id}`); }}>
            Pilna peržiūra
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const facilityId = useFacilityId();
  const [blockOpen, setBlockOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPreCourtId, setManualPreCourtId] = useState<number | undefined>();
  const [manualPreHour, setManualPreHour] = useState<number | undefined>();
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("lt-LT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const apiUrl = facilityId
    ? `${API_URL}/owner/dashboard?facilityId=${facilityId}`
    : `${API_URL}/owner/dashboard`;

  const { toast } = useToast();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["owner-dashboard", facilityId ?? "all"],
    queryFn: () => customFetch<DashboardData>(apiUrl),
    refetchInterval: 60_000,
  });

  const { data: stripeStatus } = useQuery<StripeConnectStatus>({
    queryKey: ["stripe-connect-status"],
    queryFn: () => customFetch<StripeConnectStatus>(`${API_URL}/stripe/connect/status`),
    staleTime: 60_000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_connect") === "success") {
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe_connect");
      window.history.replaceState({}, "", url.toString());
      toast({
        title: "Paskyra sėkmingai prijungta!",
        description: "Dabar galite priimti mokėjimus.",
      });
    }
  }, []);

  const openStripeDashboard = async () => {
    setStripeLoading(true);
    try {
      const r = await customFetch<{ url: string }>(`${API_URL}/stripe/connect`, { method: "POST" });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Klaida atidarant Stripe", variant: "destructive" });
    } finally {
      setStripeLoading(false);
    }
  };

  const courts = data?.courts ?? [];
  const todayBookings = data?.todayBookings ?? [];
  const todayBlockedSlots = data?.todayBlockedSlots ?? [];
  const recentBookings = data?.recentBookings ?? [];
  // Gross = totalPrice for confirmed + cancelled (every euro that passed checkout).
  // Net   = Gross − refunds issued from cancelled rows.
  const grossRevenue = data?.monthlyGrossRevenue ?? data?.monthlyRevenue ?? 0;
  const refundedTotal = data?.monthlyRefundedTotal ?? 0;
  const netRevenue = data?.monthlyNetRevenue ?? data?.monthlyRevenue ?? 0;
  const monthlyBookingCount = data?.monthlyBookingCount ?? 0;

  // ── Occupancy calculation ──
  const occupancyPerCourt = useMemo(() => {
    const totalHours = HOURS.length;
    return courts.map(court => {
      const bookedHours = todayBookings
        .filter(b => b.courtId === court.id)
        .reduce((acc, b) => {
          const dur = (toMin(b.endTime) - toMin(b.startTime)) / 60;
          return acc + dur;
        }, 0);
      return { court, pct: Math.min(100, Math.round((bookedHours / totalHours) * 100)) };
    });
  }, [courts, todayBookings]);

  const overallOccupancy = courts.length > 0
    ? Math.round(occupancyPerCourt.reduce((acc, o) => acc + o.pct, 0) / courts.length)
    : 0;

  function handleFreeClick(courtId: number, hour: number) {
    setManualPreCourtId(courtId);
    setManualPreHour(hour);
    setManualOpen(true);
  }

  const STATS = [
    {
      label: "Pajamos šį mėnesį",
      value: `€${grossRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      sub: refundedTotal > 0
        ? `Bendros · −€${refundedTotal.toLocaleString("lt-LT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} grąžinta`
        : "Bendros (su atšauktomis)",
      up: true as boolean | null,
      icon: Euro,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Užimtumas šiandien",
      value: `${overallOccupancy}%`,
      sub: "Vidutinis visų kortų",
      up: null as boolean | null,
      icon: Percent,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Rezervacijos (mėn.)",
      value: String(monthlyBookingCount),
      sub: "Šį mėnesį",
      up: null as boolean | null,
      icon: CalendarDays,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Kortų skaičius",
      value: String(courts.length),
      sub: "Viso paskyroje",
      up: null as boolean | null,
      icon: BanknoteIcon,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <OwnerLayout facilityId={facilityId} facilityName={data?.facility?.name} title="Suvestinė">
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suvestinė</h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">
            {data?.facility ? `${data.facility.name} · ` : ""}{todayLabel}
          </p>
        </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                : STATS.map(stat => (
                  <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs text-muted-foreground font-medium leading-tight">{stat.label}</p>
                      <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight mb-1">{stat.value}</p>
                    <p className={`text-xs flex items-center gap-1 ${stat.up === true ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {stat.up === true && <ArrowUpRight className="h-3 w-3" />}
                      {stat.sub}
                    </p>
                  </div>
                ))
              }
            </div>

            {/* Main grid */}
            <div className="flex flex-col xl:flex-row gap-5">

              {/* Schedule grid */}
              <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h2 className="font-semibold text-sm">Grafiko peržiūra</h2>
                    <p className="text-xs text-muted-foreground capitalize">{today.toLocaleDateString("lt-LT", { weekday: "long", day: "numeric", month: "long" })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setBlockOpen(true)}>
                      <X className="h-3 w-3" />
                      <span className="hidden sm:inline">Blokuoti kortą</span>
                      <span className="sm:hidden">Blokuoti</span>
                    </Button>
                    <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setManualPreCourtId(undefined); setManualPreHour(undefined); setManualOpen(true); }}>
                      <Phone className="h-3 w-3" />
                      <span className="hidden sm:inline">Rankinė rezervacija</span>
                      <span className="sm:hidden">Rankinė</span>
                    </Button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                  </div>
                ) : courts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Kortų nerasta. <a href={`${BASE_URL}/owner`} className="text-primary underline">Pridėkite kortą</a>.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[540px]">
                      {/* Court header */}
                      <div
                        className="grid border-b border-border bg-muted/30"
                        style={{ gridTemplateColumns: `64px repeat(${courts.length}, 1fr)` }}
                      >
                        <div className="px-2 py-2" />
                        {courts.map(c => (
                          <div key={c.id} className="px-2 py-2 text-center">
                            <p className="text-xs font-semibold">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{c.type}</p>
                          </div>
                        ))}
                      </div>

                      {/* Time rows */}
                      <div className="max-h-[400px] overflow-y-auto">
                        {HOURS.map(hour => {
                          const isNowHour = hour === today.getHours();
                          return (
                            <div
                              key={hour}
                              className={`grid border-b border-border/50 last:border-b-0 ${isNowHour ? "bg-primary/5" : ""}`}
                              style={{ gridTemplateColumns: `64px repeat(${courts.length}, 1fr)` }}
                            >
                              <div className={`px-2 py-1 flex items-center justify-end text-xs tabular-nums font-mono shrink-0 ${isNowHour ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                {hhmm(hour)}
                              </div>
                              {courts.map(c => (
                                <div key={c.id} className="px-1 py-1">
                                  <SlotCell
                                    courtId={c.id}
                                    hour={hour}
                                    todayBookings={todayBookings}
                                    blockedSlots={todayBlockedSlots}
                                    onFreeClick={handleFreeClick}
                                    onBookingClick={setSelectedBooking}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-muted/20 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Legenda:</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-400/40" />
                          <span className="text-[10px] text-muted-foreground">Patvirtinta</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-amber-400/20 border border-amber-400/40" />
                          <span className="text-[10px] text-muted-foreground">Laukiama</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700/60 border border-zinc-300/50" />
                          <span className="text-[10px] text-muted-foreground">Užblokuota</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm border border-dashed border-border/60" />
                          <span className="text-[10px] text-muted-foreground">Laisva (spustelėkite)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="xl:w-72 flex flex-col gap-4">

                {/* Occupancy chart */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Šiandien užimta</h3>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-20 rounded-lg" />
                  ) : courts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nėra kortų</p>
                  ) : (
                    <>
                      <div className="flex items-end gap-1.5 h-16">
                        {occupancyPerCourt.map(({ court, pct }) => (
                          <div key={court.id} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full rounded-sm transition-all"
                              style={{
                                height: `${Math.max(4, pct)}%`,
                                background: pct > 50 ? "var(--primary)" : "rgba(132,204,22,0.25)",
                              }}
                              title={`${court.name}: ${pct}%`}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center mt-1 gap-1.5">
                        {occupancyPerCourt.map(({ court }) => (
                          <span key={court.id} className="flex-1 text-center text-[9px] text-muted-foreground truncate">{court.name.split(" ")[0]}</span>
                        ))}
                      </div>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Vidurkis šiandien</span>
                        <span className="text-sm font-bold">{overallOccupancy}%</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Financial summary */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Euro className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold">Grynosios pajamos</h3>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-12 rounded-lg" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        €{netRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Šį mėnesį · {monthlyBookingCount} rezervac.
                      </p>
                      {refundedTotal > 0 && (
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Bendros</span>
                          <span className="tabular-nums">€{grossRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {refundedTotal > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Grąžinta</span>
                          <span className="text-destructive tabular-nums">−€{refundedTotal.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <Separator className="my-3" />
                      <a href={`${BASE_URL}/owner/payments${facilityId ? `?facility=${facilityId}` : ""}`} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                        Visos pajamos <ChevronRight className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>

                {/* Stripe status card */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-violet-500" />
                    <h3 className="text-sm font-semibold">Stripe Būsena</h3>
                  </div>
                  {stripeStatus ? (
                    <div className="space-y-3">
                      <div>
                        {stripeStatus.status === "active" ? (
                          <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 gap-1.5 text-xs">
                            🟢 Aktyvus
                          </Badge>
                        ) : stripeStatus.status === "pending" ? (
                          <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 text-xs">
                            🟡 Laukiama patvirtinimo
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground border-border gap-1.5 text-xs">
                            ⚪ Neprijungta
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {stripeStatus.status === "active" && "Mokėjimai ir išmokos įjungtos"}
                          {stripeStatus.status === "pending" && "Baigkite Stripe registraciją"}
                          {stripeStatus.status === "not_connected" && "Prijunkite Stripe priimti mokėjimams"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        disabled={stripeLoading}
                        onClick={openStripeDashboard}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Stripe suvestinė
                        <ExternalLink className="h-3 w-3 ml-auto" />
                      </Button>
                    </div>
                  ) : (
                    <Skeleton className="h-16 rounded-lg" />
                  )}
                </div>

                {/* Recent bookings */}
                <div className="bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <h3 className="text-sm font-semibold">Naujausi užsakymai</h3>
                    <a href={`${BASE_URL}/owner/payments${facilityId ? `?facility=${facilityId}` : ""}`} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                      Visi <ChevronRight className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-border/50">
                    {isLoading
                      ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-10 rounded-lg" /></div>)
                      : recentBookings.length === 0
                        ? <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">Rezervacijų nėra</div>
                        : recentBookings.map(item => (
                          <button
                            key={item.id}
                            onClick={() => setSelectedBooking(item)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                          >
                            <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${item.status === "cancelled" ? "bg-red-500/10" : item.status === "pending" ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                              {item.status === "cancelled"
                                ? <X className="h-3 w-3 text-red-500" />
                                : item.status === "pending"
                                  ? <Clock className="h-3 w-3 text-amber-500" />
                                  : <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                {item.customerName}
                                {item.bookerUserId === null && (
                                  <span className="inline-flex items-center px-1.5 py-0 text-[9px] font-semibold rounded bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
                                    Svečias
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{item.courtName} · {item.startTime}–{item.endTime}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <Badge
                                variant={item.status === "cancelled" ? "destructive" : item.status === "pending" ? "secondary" : "default"}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {item.status === "cancelled" ? "Atšaukta" : item.status === "pending" ? "Laukiama" : "Patvirtinta"}
                              </Badge>
                              {item.status === "cancelled" && Number(item.refundAmount ?? 0) > 0 ? (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                                  Grąžinta €{Number(item.refundAmount).toFixed(2)}
                                </p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground mt-1">{item.date}</p>
                              )}
                            </div>
                          </button>
                        ))
                    }
                  </div>
                </div>

              </div>
            </div>
          </div>

      {/* Modals */}
      <ManualBookingModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        courts={courts}
        preCourtId={manualPreCourtId}
        preHour={manualPreHour}
      />
      <BlockCourtModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        courts={courts}
      />
      {selectedBooking && (
        <BookingInfoModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </OwnerLayout>
  );
}
