import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Building2, CalendarDays, CreditCard, Settings,
  TrendingUp, Users, Euro, Percent, BanknoteIcon, Bell, ChevronRight,
  Plus, Phone, X, Menu, LogOut, CheckCircle2, Clock, CircleDot,
  ArrowUpRight, ArrowDownRight, BarChart3,
} from "lucide-react";
import { useUser } from "@clerk/react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Mock data ────────────────────────────────────────────────────────────────

const COURTS = [
  { id: 1, name: "Kortas 1", type: "tennis" },
  { id: 2, name: "Kortas 2", type: "tennis" },
  { id: 3, name: "Padel 1",  type: "padel" },
  { id: 4, name: "Krepšinis", type: "basketball" },
];

type SlotKind = "booked" | "maintenance" | "free";
interface Slot { courtId: number; hour: number; kind: SlotKind; label?: string }

const SLOTS: Slot[] = [
  // Court 1
  { courtId: 1, hour: 8,  kind: "booked",      label: "Tomas K." },
  { courtId: 1, hour: 9,  kind: "booked",      label: "Tomas K." },
  { courtId: 1, hour: 11, kind: "booked",      label: "Laura M." },
  { courtId: 1, hour: 14, kind: "maintenance", label: "Priežiūra" },
  { courtId: 1, hour: 17, kind: "booked",      label: "Viktorija S." },
  { courtId: 1, hour: 18, kind: "booked",      label: "Viktorija S." },
  // Court 2
  { courtId: 2, hour: 9,  kind: "booked",      label: "Andrius P." },
  { courtId: 2, hour: 10, kind: "booked",      label: "Andrius P." },
  { courtId: 2, hour: 13, kind: "booked",      label: "Mindaugas J." },
  { courtId: 2, hour: 19, kind: "booked",      label: "Rasa L." },
  { courtId: 2, hour: 20, kind: "booked",      label: "Rasa L." },
  // Court 3
  { courtId: 3, hour: 8,  kind: "booked",      label: "Erikas V." },
  { courtId: 3, hour: 10, kind: "maintenance", label: "Priežiūra" },
  { courtId: 3, hour: 11, kind: "maintenance", label: "Priežiūra" },
  { courtId: 3, hour: 15, kind: "booked",      label: "Gintarė B." },
  { courtId: 3, hour: 16, kind: "booked",      label: "Gintarė B." },
  { courtId: 3, hour: 17, kind: "booked",      label: "Gintarė B." },
  // Court 4
  { courtId: 4, hour: 12, kind: "booked",      label: "Mantas R." },
  { courtId: 4, hour: 13, kind: "booked",      label: "Mantas R." },
  { courtId: 4, hour: 18, kind: "booked",      label: "Žilvinas A." },
  { courtId: 4, hour: 19, kind: "booked",      label: "Žilvinas A." },
  { courtId: 4, hour: 20, kind: "booked",      label: "Žilvinas A." },
];

const RECENT_ACTIVITY = [
  { id: 1, player: "Viktorija S.",  court: "Kortas 1", time: "17:00–19:00", status: "confirmed", ago: "5 min" },
  { id: 2, player: "Rasa L.",       court: "Kortas 2", time: "19:00–21:00", status: "confirmed", ago: "42 min" },
  { id: 3, player: "Gintarė B.",    court: "Padel 1",  time: "15:00–18:00", status: "confirmed", ago: "1 val" },
  { id: 4, player: "Žilvinas A.",   court: "Krepšinis", time: "18:00–21:00", status: "confirmed", ago: "2 val" },
  { id: 5, player: "Mindaugas J.",  court: "Kortas 2", time: "13:00–14:00", status: "cancelled", ago: "3 val" },
];

const STATS = [
  {
    label: "Pajamos šį mėnesį",
    value: "€1 842",
    sub: "+23% vs. praėjęs mėn.",
    up: true,
    icon: Euro,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    label: "Užimtumas",
    value: "74%",
    sub: "+6% vs. praėjęs mėn.",
    up: true,
    icon: Percent,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    label: "Rezervacijos",
    value: "47",
    sub: "Šį mėnesį",
    up: null,
    icon: CalendarDays,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    label: "Išmokos likutis",
    value: "€648",
    sub: "Planuojama: pirmadienį",
    up: null,
    icon: BanknoteIcon,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08–22

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Suvestinė",        href: `${BASE_URL}/owner/dashboard` },
  { icon: Building2,       label: "Mano aikštelės",   href: `${BASE_URL}/owner` },
  { icon: CalendarDays,    label: "Rezervacijų grafikas", href: `${BASE_URL}/owner/dashboard` },
  { icon: CreditCard,      label: "Mokėjimai",         href: `${BASE_URL}/owner/dashboard` },
  { icon: Settings,        label: "Nustatymai",        href: `${BASE_URL}/owner/dashboard` },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function slotFor(courtId: number, hour: number): Slot | undefined {
  return SLOTS.find(s => s.courtId === courtId && s.hour === hour);
}

function SlotCell({ courtId, hour }: { courtId: number; hour: number }) {
  const slot = slotFor(courtId, hour);
  if (!slot || slot.kind === "free") {
    return (
      <div className="h-10 rounded border border-dashed border-border/40 hover:bg-muted/40 cursor-pointer transition-colors group flex items-center justify-center">
        <Plus className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
    );
  }
  if (slot.kind === "maintenance") {
    return (
      <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-700/60 border border-zinc-300/50 dark:border-zinc-600/40 flex items-center px-1.5 overflow-hidden">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-medium">{slot.label}</span>
      </div>
    );
  }
  return (
    <div className="h-10 rounded bg-blue-500/15 border border-blue-400/30 hover:bg-blue-500/20 transition-colors flex items-center px-1.5 overflow-hidden cursor-pointer">
      <span className="text-[10px] text-blue-700 dark:text-blue-300 truncate font-medium">{slot.label}</span>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:flex md:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-border shrink-0">
          <Link href="/" className="font-bold text-lg tracking-tight">korts<span className="text-primary">.lt</span></Link>
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">Pagrindinis</p>
          {NAV_ITEMS.slice(0, 3).map(item => (
            <NavItem key={item.label} item={item} active={item.href.includes("dashboard") && item.label === "Suvestinė"} />
          ))}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2 pt-4">Finansai ir kita</p>
          {NAV_ITEMS.slice(3).map(item => (
            <NavItem key={item.label} item={item} active={false} />
          ))}
        </nav>

        {/* Bottom */}
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

function NavItem({ item, active }: { item: typeof NAV_ITEMS[0]; active: boolean }) {
  return (
    <a
      href={item.href}
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
}

// ── Modal stub ────────────────────────────────────────────────────────────────

function BlockCourtModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold mb-1">Blokuoti kortą</h2>
        <p className="text-sm text-muted-foreground mb-5">Pasirinkite kortą ir laiką, kurį norite užblokuoti priežiūrai ar kitai veiklai.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Kortas</label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              {COURTS.map(c => <option key={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Nuo</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.map(h => <option key={h}>{String(h).padStart(2,"0")}:00</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Iki</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.map(h => <option key={h}>{String(h).padStart(2,"0")}:00</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priežastis</label>
            <input placeholder="pvz. Priežiūra, privatus renginys…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Atšaukti</Button>
          <Button className="flex-1" onClick={onClose}>Blokuoti</Button>
        </div>
      </div>
    </div>
  );
}

function ManualEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold mb-1">Rankinė rezervacija</h2>
        <p className="text-sm text-muted-foreground mb-5">Įveskite telefonu ar asmeniškai gautas rezervacijos duomenis.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Kliento vardas</label>
            <input placeholder="pvz. Jonas Jonaitis" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Telefono numeris</label>
            <input placeholder="+370 600 00000" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Kortas</label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
              {COURTS.map(c => <option key={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Nuo</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.map(h => <option key={h}>{String(h).padStart(2,"0")}:00</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Iki</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                {HOURS.map(h => <option key={h}>{String(h).padStart(2,"0")}:00</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Atšaukti</Button>
          <Button className="flex-1" onClick={onClose}>Išsaugoti</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("lt-LT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const bookedCount = SLOTS.filter(s => s.kind === "booked").length;
  const totalSlots = HOURS.length * COURTS.length;
  const occupancyPct = Math.round((bookedCount / totalSlots) * 100);

  return (
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-base leading-tight">Suvestinė</h1>
              <p className="text-xs text-muted-foreground capitalize hidden sm:block">{todayLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-5">

            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {STATS.map(stat => (
                <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs text-muted-foreground font-medium leading-tight">{stat.label}</p>
                    <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight mb-1">{stat.value}</p>
                  <p className={`text-xs flex items-center gap-1 ${stat.up === true ? "text-emerald-500" : stat.up === false ? "text-red-500" : "text-muted-foreground"}`}>
                    {stat.up === true && <ArrowUpRight className="h-3 w-3" />}
                    {stat.up === false && <ArrowDownRight className="h-3 w-3" />}
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Main grid: calendar + activity ───────────────────── */}
            <div className="flex flex-col xl:flex-row gap-5">

              {/* Calendar */}
              <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl overflow-hidden">
                {/* Calendar header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h2 className="font-semibold text-sm">Grafiko peržiūra</h2>
                    <p className="text-xs text-muted-foreground capitalize">{today.toLocaleDateString("lt-LT", { weekday: "long", day: "numeric", month: "long" })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Quick actions */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => setBlockOpen(true)}
                    >
                      <X className="h-3 w-3" />
                      <span className="hidden sm:inline">Blokuoti kortą</span>
                      <span className="sm:hidden">Blokuoti</span>
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => setManualOpen(true)}
                    >
                      <Phone className="h-3 w-3" />
                      <span className="hidden sm:inline">Rankinė rezervacija</span>
                      <span className="sm:hidden">Rankinė</span>
                    </Button>
                  </div>
                </div>

                {/* Grid scroll container */}
                <div className="overflow-x-auto">
                  <div className="min-w-[540px]">
                    {/* Court header row */}
                    <div className="grid border-b border-border bg-muted/30" style={{ gridTemplateColumns: `64px repeat(${COURTS.length}, 1fr)` }}>
                      <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest" />
                      {COURTS.map(c => (
                        <div key={c.id} className="px-2 py-2 text-center">
                          <p className="text-xs font-semibold">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{c.type}</p>
                        </div>
                      ))}
                    </div>

                    {/* Time + slot rows */}
                    <div className="max-h-[400px] overflow-y-auto">
                      {HOURS.map(hour => {
                        const isNowHour = hour === today.getHours();
                        return (
                          <div
                            key={hour}
                            className={`grid border-b border-border/50 last:border-b-0 ${isNowHour ? "bg-primary/5" : ""}`}
                            style={{ gridTemplateColumns: `64px repeat(${COURTS.length}, 1fr)` }}
                          >
                            {/* Time label */}
                            <div className={`px-2 py-1 flex items-center justify-end text-xs tabular-nums font-mono shrink-0 ${isNowHour ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {String(hour).padStart(2, "0")}:00
                            </div>
                            {/* Court slots */}
                            {COURTS.map(c => (
                              <div key={c.id} className="px-1 py-1">
                                <SlotCell courtId={c.id} hour={hour} />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Legenda:</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-400/40" />
                        <span className="text-[10px] text-muted-foreground">Rezervuota</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700/60 border border-zinc-300/50" />
                        <span className="text-[10px] text-muted-foreground">Priežiūra</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm border border-dashed border-border/60" />
                        <span className="text-[10px] text-muted-foreground">Laisva</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="xl:w-72 flex flex-col gap-4">

                {/* Occupancy mini-widget */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Šiandien užimta</h3>
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {[55, 70, 80, 60, 90, 74, 65].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all"
                        style={{
                          height: `${h}%`,
                          background: i === 5 ? "var(--primary)" : "rgba(132,204,22,0.18)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    {["P","A","T","K","Pn","Š","S"].map((d, i) => (
                      <span key={i} className={`flex-1 text-center text-[9px] ${i === 5 ? "text-primary font-bold" : "text-muted-foreground"}`}>{d}</span>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Šiandien</span>
                    <span className="text-sm font-bold">{occupancyPct}%</span>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <h3 className="text-sm font-semibold">Naujausi užsakymai</h3>
                    <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
                      Visi <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-border/50">
                    {RECENT_ACTIVITY.map(item => (
                      <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                        <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${item.status === "cancelled" ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                          {item.status === "cancelled"
                            ? <X className="h-3 w-3 text-red-500" />
                            : <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.player}</p>
                          <p className="text-[11px] text-muted-foreground">{item.court} · {item.time}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge
                            variant={item.status === "cancelled" ? "destructive" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {item.status === "cancelled" ? "Atšaukta" : "Patvirtinta"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">{item.ago} atgal</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modals */}
      <BlockCourtModal open={blockOpen} onClose={() => setBlockOpen(false)} />
      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
