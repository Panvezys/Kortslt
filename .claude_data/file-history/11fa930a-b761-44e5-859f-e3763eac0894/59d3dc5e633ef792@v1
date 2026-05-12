import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  X,
  Euro,
  TrendingUp,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OwnerLayout, useFacilityId } from "@/components/owner-layout";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

interface DashboardData {
  facility: { id: number; name: string } | null;
  courts: { id: number; name: string; type: string }[];
  recentBookings: {
    id: number;
    courtId: number;
    customerName: string;
    customerEmail: string;
    date: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    status: string;
    createdAt: string;
    courtName?: string | null;
  }[];
  monthlyRevenue: number;
  monthlyGrossRevenue?: number;
  monthlyRefundedTotal?: number;
  monthlyNetRevenue?: number;
  monthlyBookingCount: number;
}

interface BookingItem {
  id: number;
  courtId: number;
  customerName: string;
  customerEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  refundAmount?: number | null;
  status: string;
  createdAt: string;
  courtName?: string | null;
}

export default function OwnerPayments() {
  const facilityId = useFacilityId();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stripeLoading, setStripeLoading] = useState(false);

  const { data: dashData } = useQuery<DashboardData>({
    queryKey: ["owner-dashboard", facilityId ?? "all"],
    queryFn: () => customFetch<DashboardData>(facilityId ? `${API_URL}/owner/dashboard?facilityId=${facilityId}` : `${API_URL}/owner/dashboard`),
  });

  const { data: allBookings, isLoading } = useQuery<BookingItem[]>({
    queryKey: ["owner-bookings-all", facilityId ?? "all"],
    queryFn: () => customFetch<BookingItem[]>(`${API_URL}/bookings`),
    select: (data) => {
      const ownerCourtIds = new Set(dashData?.courts.map(c => c.id) ?? []);
      return (Array.isArray(data) ? data : [])
        .filter((b: BookingItem) => ownerCourtIds.has(b.courtId))
        .sort((a: BookingItem, b: BookingItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    enabled: !!dashData,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [forceCancelTarget, setForceCancelTarget] = useState<BookingItem | null>(null);

  const filtered = (allBookings ?? []).filter(b =>
    statusFilter === "all" || b.status === statusFilter
  );

  const grossRevenue = dashData?.monthlyGrossRevenue ?? dashData?.monthlyRevenue ?? 0;
  const refundedTotal = dashData?.monthlyRefundedTotal ?? 0;
  const netRevenue = dashData?.monthlyNetRevenue ?? dashData?.monthlyRevenue ?? 0;

  const openStripeDashboard = async () => {
    setStripeLoading(true);
    try {
      const r = await customFetch<{ url: string }>(`${API_URL}/stripe/connect`, { method: "POST" });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch {
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <OwnerLayout facilityId={facilityId} facilityName={dashData?.facility?.name ?? undefined} title="Mokėjimai">
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mokėjimai</h1>
            {dashData?.facility && (
              <p className="text-sm text-muted-foreground mt-0.5">{dashData.facility.name}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={stripeLoading}
            onClick={openStripeDashboard}
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Stripe suvestinė</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Bendros pajamos</p>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Euro className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">€{grossRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">Šį mėnesį (su atšauktomis)</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Grąžinta klientams</p>
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Undo2 className="h-4 w-4 text-destructive" />
              </div>
            </div>
            <p className="text-2xl font-bold text-destructive">−€{refundedTotal.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">Iš atšauktų rezervacijų</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Grynosios pajamos</p>
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-violet-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">€{netRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">{dashData?.monthlyBookingCount ?? 0} rezervac. · Bendros − Grąžinta</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Rezervacijų istorija</h2>
            <div className="flex gap-1">
              {(["all", "confirmed", "pending", "cancelled"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s === "all" ? "Visi" : s === "confirmed" ? "Patvirtinta" : s === "pending" ? "Laukiama" : "Atšaukta"}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Rezervacijų nėra</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(b => {
                const isCancelled = b.status === "cancelled";
                const refunded = Number(b.refundAmount ?? 0);
                return (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <a
                      href={`${BASE_URL}/bookings/${b.id}`}
                      className="flex items-center gap-4 flex-1 min-w-0"
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        b.status === "confirmed" ? "bg-emerald-500/10" : b.status === "pending" ? "bg-amber-500/10" : "bg-destructive/10"
                      }`}>
                        {b.status === "confirmed"
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : b.status === "pending"
                            ? <Clock className="h-4 w-4 text-amber-500" />
                            : <X className="h-4 w-4 text-destructive" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.customerName}</p>
                        <p className="text-xs text-muted-foreground">{b.courtName ?? `Kortas #${b.courtId}`} · {b.date} {b.startTime}–{b.endTime}</p>
                      </div>
                    </a>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                        €{b.totalPrice.toFixed(2)}
                      </p>
                      {isCancelled && refunded > 0 && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Grąžinta: €{refunded.toFixed(2)}
                        </p>
                      )}
                      <Badge
                        variant={b.status === "confirmed" ? "default" : b.status === "pending" ? "secondary" : "destructive"}
                        className="text-[10px] px-1.5 py-0 mt-0.5"
                      >
                        {b.status === "confirmed" ? "Patvirtinta" : b.status === "pending" ? "Laukiama" : "Atšaukta"}
                      </Badge>
                    </div>
                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => setForceCancelTarget(b)}
                        className="shrink-0 px-2 py-1.5 text-[11px] font-medium rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
                        title="Priverstinis atšaukimas (apeina 24h/48h taisyklę)"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span className="hidden sm:inline">Priverstinis</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {forceCancelTarget && (
        <ForceCancelDialog
          booking={forceCancelTarget}
          onClose={() => setForceCancelTarget(null)}
          onSuccess={(refundedEur) => {
            toast({
              title: "Rezervacija atšaukta",
              description: refundedEur > 0
                ? `Grąžinta klientui: €${refundedEur.toFixed(2)}.`
                : "Be grąžinimo.",
            });
            setForceCancelTarget(null);
            queryClient.invalidateQueries({ queryKey: ["owner-bookings-all"] });
            queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
          }}
        />
      )}
    </OwnerLayout>
  );
}

function ForceCancelDialog({
  booking,
  onClose,
  onSuccess,
}: {
  booking: BookingItem;
  onClose: () => void;
  onSuccess: (refundedEur: number) => void;
}) {
  type Preset = "full" | "half" | "none" | "custom";
  const [preset, setPreset] = useState<Preset>("full");
  const [customEur, setCustomEur] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const totalPriceCents = Math.round(booking.totalPrice * 100);

  const presetCents: number | null = (() => {
    if (preset === "full") return totalPriceCents;
    if (preset === "half") return Math.round(totalPriceCents * 0.5);
    if (preset === "none") return 0;
    return null;
  })();

  const customCents: number | null = (() => {
    if (preset !== "custom") return null;
    const raw = customEur.replace(",", ".").trim();
    if (raw === "") return null;
    const v = Number(raw);
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 100);
  })();

  const finalCents = preset === "custom" ? customCents : presetCents;

  const validationError: string | null = (() => {
    if (preset === "custom") {
      if (customEur.trim() === "") return "Įveskite sumą";
      if (customCents == null) return "Neteisinga suma";
      if (customCents < 0) return "Suma negali būti neigiama";
      if (customCents > totalPriceCents) {
        return `Suma negali viršyti €${booking.totalPrice.toFixed(2)}`;
      }
    }
    return null;
  })();

  const canSubmit = !submitting && validationError == null && finalCents != null;

  const submit = async () => {
    if (!canSubmit || finalCents == null) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const resp = await customFetch<{ id: number; status: string; refundAmount: number }>(
        `${API_URL}/owner/bookings/${booking.id}/force-cancel`,
        {
          method: "POST",
          body: JSON.stringify({ refundAmountCents: finalCents }),
        },
      );
      const serverRefund = Number(resp?.refundAmount ?? finalCents / 100);
      onSuccess(serverRefund);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nepavyko atšaukti rezervacijos";
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const PRESETS: { key: Preset; label: string; sub: string }[] = [
    { key: "full", label: "Pilnas (100%)", sub: `€${booking.totalPrice.toFixed(2)}` },
    { key: "half", label: "Dalinis (50%)", sub: `€${(booking.totalPrice / 2).toFixed(2)}` },
    { key: "none", label: "Be grąžinimo (0%)", sub: "€0.00" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors"
          aria-label="Uždaryti"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-bold">Priverstinis atšaukimas</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Apeina 24h/48h taisyklę. Grąžinimas bus išsiųstas iš karto.
        </p>

        <div className="bg-muted/40 rounded-xl px-3 py-2 mb-4 text-sm">
          <p className="font-medium">{booking.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {booking.courtName ?? `Kortas #${booking.courtId}`} · {booking.date} {booking.startTime}–{booking.endTime}
          </p>
          <p className="text-xs mt-1">Sumokėta: <span className="font-semibold">€{booking.totalPrice.toFixed(2)}</span></p>
        </div>

        <div className="space-y-2 mb-3">
          {PRESETS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setPreset(p.key); setServerError(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                preset === p.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-xs tabular-nums">{p.sub}</span>
            </button>
          ))}

          <div
            className={`w-full px-3 py-2.5 rounded-lg border transition-colors ${
              preset === "custom" ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => { setPreset("custom"); setServerError(null); }}
              className="w-full flex items-center justify-between text-left text-sm mb-1"
            >
              <span className={`font-medium ${preset === "custom" ? "" : "text-muted-foreground"}`}>Kita suma</span>
              <span className="text-xs text-muted-foreground">Iki €{booking.totalPrice.toFixed(2)}</span>
            </button>
            {preset === "custom" && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={customEur}
                  onChange={e => { setCustomEur(e.target.value); setServerError(null); }}
                  placeholder="0,00"
                  className="flex-1 bg-background border border-border rounded-md px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>
        </div>

        {(validationError || serverError) && (
          <p className="text-xs text-destructive mb-3">{validationError ?? serverError}</p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Atšaukti
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting ? "Atšaukiama…" : "Patvirtinti"}
          </Button>
        </div>
      </div>
    </div>
  );
}
