import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, Building2, CreditCard, Settings,
  Menu, X, LogOut, Euro, TrendingUp, CalendarDays, CheckCircle2, Clock, ExternalLink,
} from "lucide-react";
import { useUser } from "@clerk/react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Suvestinė",      href: `${BASE_URL}/owner/dashboard` },
  { icon: Building2,       label: "Mano aikštelės", href: `${BASE_URL}/owner` },
  { icon: CreditCard,      label: "Mokėjimai",      href: `${BASE_URL}/owner/payments` },
  { icon: Settings,        label: "Nustatymai",     href: `${BASE_URL}/owner/settings` },
];

function Sidebar({ open, onClose, currentPath }: { open: boolean; onClose: () => void; currentPath: string }) {
  const [, navigate] = useLocation();
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
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">Valdymas</p>
          {NAV_ITEMS.map(item => {
            const active = currentPath === item.href;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={e => { e.preventDefault(); onClose(); navigate(item.href.replace(BASE_URL, "") || "/"); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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

interface DashboardData {
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
  status: string;
  createdAt: string;
  courtName?: string | null;
}

export default function OwnerPayments() {
  const { user } = useUser();
  const [location] = useLocation();
  const currentPath = `${BASE_URL}${location}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stripeLoading, setStripeLoading] = useState(false);

  const { data: dashData } = useQuery<DashboardData>({
    queryKey: ["owner-dashboard"],
    queryFn: () => customFetch<DashboardData>(`${API_URL}/owner/dashboard`),
  });

  const { data: allBookings, isLoading } = useQuery<BookingItem[]>({
    queryKey: ["owner-bookings-all"],
    queryFn: () => customFetch<BookingItem[]>(`${API_URL}/bookings`),
    select: (data) => {
      const ownerCourtIds = new Set(dashData?.courts.map(c => c.id) ?? []);
      return (Array.isArray(data) ? data : [])
        .filter((b: BookingItem) => ownerCourtIds.has(b.courtId))
        .sort((a: BookingItem, b: BookingItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    enabled: !!dashData,
  });

  const filtered = (allBookings ?? []).filter(b =>
    statusFilter === "all" || b.status === statusFilter
  );

  const totalRevenue = (allBookings ?? [])
    .filter(b => b.status === "confirmed")
    .reduce((acc, b) => acc + b.totalPrice, 0);

  const confirmedCount = (allBookings ?? []).filter(b => b.status === "confirmed").length;
  const pendingCount = (allBookings ?? []).filter(b => b.status === "pending").length;

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
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath={currentPath} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-base">Mokėjimai</h1>
          </div>
          <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              {user?.imageUrl
                ? <img src={user.imageUrl} className="w-7 h-7 rounded-full object-cover" />
                : <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user?.firstName?.[0] ?? "O"}</div>
              }
              <span className="text-sm font-medium hidden sm:block">{user?.firstName ?? "Savininkas"}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">Visos pajamos</p>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Euro className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-2xl font-bold">€{totalRevenue.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">Patvirtintos</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">Patvirtinta</p>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <p className="text-2xl font-bold">{confirmedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Rezervacijų</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">Šį mėnesį</p>
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                </div>
              </div>
              <p className="text-2xl font-bold">€{(dashData?.monthlyRevenue ?? 0).toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">{dashData?.monthlyBookingCount ?? 0} rezervac.</p>
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
                {filtered.map(b => (
                  <a key={b.id} href={`${BASE_URL}/bookings/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      b.status === "confirmed" ? "bg-emerald-500/10" : b.status === "pending" ? "bg-amber-500/10" : "bg-red-500/10"
                    }`}>
                      {b.status === "confirmed"
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : b.status === "pending"
                          ? <Clock className="h-4 w-4 text-amber-500" />
                          : <X className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.customerName}</p>
                      <p className="text-xs text-muted-foreground">{b.courtName ?? `Kortas #${b.courtId}`} · {b.date} {b.startTime}–{b.endTime}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">€{b.totalPrice.toFixed(2)}</p>
                      <Badge
                        variant={b.status === "confirmed" ? "default" : b.status === "pending" ? "secondary" : "destructive"}
                        className="text-[10px] px-1.5 py-0 mt-0.5"
                      >
                        {b.status === "confirmed" ? "Patvirtinta" : b.status === "pending" ? "Laukiama" : "Atšaukta"}
                      </Badge>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
