import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, Building2, CreditCard, Settings,
  Euro, Percent, CalendarDays, BanknoteIcon, Bell, ChevronRight,
  Plus, Phone, X, Menu, LogOut, CheckCircle2, Clock, BarChart3,
  ArrowUpRight,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

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

interface OwnerCourt { id: number; name: string; type: string; facilityId?: number }

interface OwnerBooking {
  id: number;
  courtId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  courtName?: string | null;
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
  monthlyBookingCount: number;
}

// ── Slot logic ────────────────────────────────────────────────────────────────

function getSlotKind(
  courtId: number,
  hour: number,
  todayBookings: OwnerBooking[],
  blockedSlots: BlockedSlot[],
): { kind: "confirmed" | "pending" | "awaiting" | "blocked" | "free"; booking?: OwnerBooking; blocked?: BlockedSlot } {
  const slotStart = hour * 60;
  const slotEnd = (hour + 1) * 60;

  for (const b of todayBookings) {
    if (b.courtId !== courtId) continue;
    const bStart = toMin(b.startTime);
    const bEnd = toMin(b.endTime);
    if (slotStart < bEnd && slotEnd > bStart) {
      const kind =
        b.status === "confirmed" ? "confirmed" :
        b.status === "awaiting_approval" ? "awaiting" :
        "pending";
      return { kind, booking: b };
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
  if (kind === "awaiting") {
    return (
      <div
        onClick={() => booking && onBookingClick(booking)}
        className="h-10 rounded bg-orange-500/20 border border-orange-500/50 hover:bg-orange-500/30 transition-colors flex items-center gap-1 px-1.5 overflow-hidden cursor-pointer"
        title="Laukia patvirtinimo"
      >
        <Clock className="h-3 w-3 text-orange-600 dark:text-orange-300 shrink-0" />
        <span className="text-[10px] text-orange-700 dark:text-orange-300 truncate font-medium">{booking?.customerName}</span>
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

// ── Sidebar ───────────────────────────────────────────────────────────────────

function buildNavItems(facilityId?: number) {
  return [
    { icon: LayoutDashboard, label: "Suvestinė",      href: facilityId ? `${BASE_URL}/owner/dashboard?facility=${facilityId}` : `${BASE_URL}/owner/dashboard` },
    { icon: Building2,       label: "Mano aikštelės", href: facilityId ? `${BASE_URL}/owner/facility/${facilityId}` : `${BASE_URL}/owner` },
    { icon: CreditCard,      label: "Mokėjimai",      href: facilityId ? `${BASE_URL}/owner/payments?facility=${facilityId}` : `${BASE_URL}/owner/payments` },
    { icon: Settings,        label: "Nustatymai",     href: facilityId ? `${BASE_URL}/owner/settings?facility=${facilityId}` : `${BASE_URL}/owner/settings` },
  ];
}

function Sidebar({ open, onClose, currentPath, facilityId }: { open: boolean; onClose: () => void; currentPath: string; facilityId?: number }) {
  const [, navigate] = useLocation();
  const NAV_ITEMS = buildNavItems(facilityId);
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:flex md:z-auto
      `}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-border shrink-0">
          <Link href="/" className="font-bold text-lg tracking-tight">korts<span className="text-primary">.lt</span></Link>
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">Valdymas</p>
          {NAV_ITEMS.map(item => {
            const active = currentPath === item.href || currentPath.startsWith(item.href + "?");
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={e => { e.preventDefault(); onClose(); navigate(item.href.replace(BASE_URL, "") || "/"); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Grįžti į svetainę
          </button>
        </div>
      </aside>
    </>
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
  open, onClose, courts,
}: {
  open: boolean;
  onClose: () => void;
  courts: OwnerCourt[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = todayStr();

  const [courtId, setCourtId] = useState<string>(String(courts[0]?.id ?? ""));
  const [date, setDate] = useState(today);
  const [startHour, setStartHour] = useState(hhmm(8));
  const [endHour, setEndHour] = useState(hhmm(9));
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      customFetch(`${API_URL}/courts/${courtId}/blocked-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime: startHour, endTime: endHour, reason: reason || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "Kortas užblokuotas" });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      onClose();
      setReason("");
    },
    onError: (e: any) => toast({
      title: "Klaida blokuojant",
      description: e?.data?.error || e?.message || "Nepavyko užblokuoti korto",
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
        <h2 className="text-lg font-bold mb-1">Blokuoti kortą</h2>
        <p className="text-sm text-muted-foreground mb-5">Pasirinkite kortą ir laiką, kurį norite užblokuoti.</p>
        <div className="space-y-3">
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priežastis</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="pvz. Priežiūra, privatus renginys…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Atšaukti</Button>
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
  const queryClient = useQueryClient();
  const isAwaiting = booking.status === "awaiting_approval";

  const approveMutation = useMutation({
    mutationFn: () =>
      customFetch(`${API_URL}/owner/bookings/${booking.id}/approve`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      onClose();
    },
    onError: (err: any) => alert(err?.message || "Nepavyko patvirtinti rezervacijos"),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason?: string) =>
      customFetch(`${API_URL}/owner/bookings/${booking.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      onClose();
    },
    onError: (err: any) => alert(err?.message || "Nepavyko atmesti rezervacijos"),
  });

  const handleApprove = () => {
    if (confirm("Patvirtinti šią rezervaciją? Klientas gaus pranešimą.")) {
      approveMutation.mutate();
    }
  };
  const handleReject = () => {
    const reason = prompt("Atmesti rezervaciją?\n\nNurodykite priežastį (neprivaloma) — klientas tai pamatys:", "");
    if (reason === null) return;
    rejectMutation.mutate(reason || undefined);
  };

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const statusLabel =
    booking.status === "confirmed" ? "Patvirtinta" :
    booking.status === "pending" ? "Laukiama" :
    booking.status === "awaiting_approval" ? "Laukia patvirtinimo" :
    "Atšaukta";

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
        {isAwaiting && (
          <div className="mb-4 rounded-lg bg-orange-500/10 border border-orange-500/30 p-3 text-xs text-orange-700 dark:text-orange-300 flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Klientas sumokėjo. Patvirtinkite arba atmeskite rezervaciją — atmetus pinigai bus grąžinami.</span>
          </div>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Klientas</span><span className="font-medium">{booking.customerName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">El. paštas</span><span className="font-medium">{booking.customerEmail}</span></div>
          {booking.customerPhone && <div className="flex justify-between"><span className="text-muted-foreground">Telefonas</span><span className="font-medium">{booking.customerPhone}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{booking.date}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Laikas</span><span className="font-medium">{booking.startTime} – {booking.endTime}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Kaina</span><span className="font-medium">€{booking.totalPrice.toFixed(2)}</span></div>
          <div className="flex justify-between items-center"><span className="text-muted-foreground">Statusas</span>
            <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "destructive" : "secondary"}>
              {statusLabel}
            </Badge>
          </div>
        </div>
        {isAwaiting ? (
          <div className="flex gap-2 mt-5">
            <Button
              variant="outline"
              className="flex-1 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              disabled={isBusy}
              onClick={handleReject}
            >
              <X className="w-4 h-4 mr-1" /> Atmesti
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={isBusy}
              onClick={handleApprove}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Patvirtinti
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 mt-5">
            <Button variant="outline" className="flex-1" onClick={onClose}>Uždaryti</Button>
            <Button className="flex-1" onClick={() => { onClose(); navigate(`/bookings/${booking.id}`); }}>
              Pilna peržiūra
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { user } = useUser();
  const [location] = useLocation();
  const currentPath = `${BASE_URL}${location}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const facilityId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("facility");
    return v ? Number(v) : undefined;
  }, [location]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPreCourtId, setManualPreCourtId] = useState<number | undefined>();
  const [manualPreHour, setManualPreHour] = useState<number | undefined>();
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("lt-LT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const apiUrl = facilityId
    ? `${API_URL}/owner/dashboard?facilityId=${facilityId}`
    : `${API_URL}/owner/dashboard`;

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["owner-dashboard", facilityId ?? "all"],
    queryFn: () => customFetch<DashboardData>(apiUrl),
    refetchInterval: 60_000,
  });

  const courts = data?.courts ?? [];
  const todayBookings = data?.todayBookings ?? [];
  const todayBlockedSlots = data?.todayBlockedSlots ?? [];
  const recentBookings = data?.recentBookings ?? [];
  const monthlyRevenue = data?.monthlyRevenue ?? 0;
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
      value: `€${monthlyRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      sub: "Patvirtintos rezervacijos",
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
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath={currentPath} facilityId={facilityId} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-base leading-tight">
                {data?.facility ? data.facility.name : "Suvestinė"}
              </h1>
              <p className="text-xs text-muted-foreground capitalize hidden sm:block">
                {data?.facility ? "Suvestinė · " : ""}{todayLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-border ml-1">
              {user?.imageUrl ? (
                <img src={user.imageUrl} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {user?.firstName?.[0] ?? "O"}
                </div>
              )}
              <span className="text-sm font-medium hidden sm:block">{user?.firstName ?? "Savininkas"}</span>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-5">

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
                        €{monthlyRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Šį mėnesį · {monthlyBookingCount} rezervac.</p>
                      <Separator className="my-3" />
                      <a href={`${BASE_URL}/owner/payments`} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                        Visos pajamos <ChevronRight className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>

                {/* Recent bookings */}
                <div className="bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <h3 className="text-sm font-semibold">Naujausi užsakymai</h3>
                    <a href={`${BASE_URL}/owner/payments`} className="text-xs text-primary hover:underline flex items-center gap-0.5">
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
                            <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                              item.status === "cancelled" ? "bg-red-500/10" :
                              item.status === "awaiting_approval" ? "bg-orange-500/15" :
                              item.status === "pending" ? "bg-amber-500/10" :
                              "bg-emerald-500/10"
                            }`}>
                              {item.status === "cancelled"
                                ? <X className="h-3 w-3 text-red-500" />
                                : item.status === "awaiting_approval"
                                  ? <Clock className="h-3 w-3 text-orange-500" />
                                  : item.status === "pending"
                                    ? <Clock className="h-3 w-3 text-amber-500" />
                                    : <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.customerName}</p>
                              <p className="text-[11px] text-muted-foreground">{item.courtName} · {item.startTime}–{item.endTime}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <Badge
                                variant={item.status === "cancelled" ? "destructive" : item.status === "confirmed" ? "default" : "secondary"}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {item.status === "cancelled" ? "Atšaukta" :
                                 item.status === "awaiting_approval" ? "Laukia patv." :
                                 item.status === "pending" ? "Laukiama" :
                                 "Patvirtinta"}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground mt-1">{item.date}</p>
                            </div>
                          </button>
                        ))
                    }
                  </div>
                </div>

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
    </div>
  );
}
