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
                {HOURS.map(h => <option key={h} value={hhmm(h + 1)}>{hhmm(h + 1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Pastaba</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Papildoma informacija" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors h-20 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Atšaukti</Button>
          <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending || !customerName.trim()}>Sukurti</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const facilityId = useFacilityId();
  const [, navigate] = useLocation();
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
      label: "Rezervacijos šiandien",
      value: String(todayBookings.length),
      sub: `${monthlyBookingCount} šį mėnesį`,
      up: null as boolean | null,
      icon: CalendarDays,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Tiesioginės pajamos",
      value: `€${netRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      sub: "Po grąžinimų",
      up: null as boolean | null,
      icon: BanknoteIcon,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  if (isLoading || !data) {
    return (
      <OwnerLayout facilityId={facilityId} title="Skydelis">
        <div className="p-4 md:p-6 space-y-6">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout facilityId={facilityId} facilityName={data.facility?.name} title="Skydelis">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{data.facility?.name ?? "Skydelis"}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate(`/owner/facility/${facilityId}/court/new`)} className="gap-2">
            <Plus className="w-4 h-4" /> Pridėti aikštelę
          </Button>
        </div>
      </div>
    </OwnerLayout>
  );
}
