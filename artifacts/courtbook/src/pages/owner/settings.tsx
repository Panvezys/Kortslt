import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Building2, CreditCard, Settings, Users,
  Menu, X, LogOut, Save,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

// ── Nav ───────────────────────────────────────────────────────────────────────

function buildNavItems(facilityId?: number) {
  return [
    { icon: LayoutDashboard, label: "Suvestinė",      href: facilityId ? `${BASE_URL}/owner/dashboard?facility=${facilityId}` : `${BASE_URL}/owner/dashboard` },
    { icon: Building2,       label: "Mano aikštelės", href: facilityId ? `${BASE_URL}/owner/facility/${facilityId}` : `${BASE_URL}/owner` },
    { icon: Users,           label: "Treneriai",      href: `${BASE_URL}/owner/coaches` },
    { icon: CreditCard,      label: "Mokėjimai",      href: facilityId ? `${BASE_URL}/owner/payments?facility=${facilityId}` : `${BASE_URL}/owner/payments` },
    { icon: Settings,        label: "Nustatymai",     href: facilityId ? `${BASE_URL}/owner/settings?facility=${facilityId}` : `${BASE_URL}/owner/settings` },
  ];
}

function Sidebar({ open, onClose, currentPath, facilityId }: { open: boolean; onClose: () => void; currentPath: string; facilityId?: number }) {
  const [, navigate] = useLocation();
  const NAV_ITEMS = buildNavItems(facilityId);
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
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">Valdymas</p>
          {NAV_ITEMS.map(item => {
            const active = currentPath.startsWith(item.href.split("?")[0]) && item.label === "Nustatymai";
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={e => {
                  e.preventDefault();
                  onClose();
                  const path = item.href.replace(BASE_URL, "") || "/";
                  navigate(path);
                }}
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Facility {
  id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  cancellationWindow?: number | null;
  advanceBookingLimit?: number | null;
  businessHours?: string | null;
}

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday",    label: "Pirmadienis" },
  { key: "tuesday",   label: "Antradienis" },
  { key: "wednesday", label: "Trečiadienis" },
  { key: "thursday",  label: "Ketvirtadienis" },
  { key: "friday",    label: "Penktadienis" },
  { key: "saturday",  label: "Šeštadienis" },
  { key: "sunday",    label: "Sekmadienis" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const DEFAULT_HOURS: Record<DayKey, { open: string; close: string; closed: boolean }> = {
  monday:    { open: "08:00", close: "22:00", closed: false },
  tuesday:   { open: "08:00", close: "22:00", closed: false },
  wednesday: { open: "08:00", close: "22:00", closed: false },
  thursday:  { open: "08:00", close: "22:00", closed: false },
  friday:    { open: "08:00", close: "22:00", closed: false },
  saturday:  { open: "09:00", close: "20:00", closed: false },
  sunday:    { open: "09:00", close: "20:00", closed: false },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerSettings() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const currentPath = `${BASE_URL}${location}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "rules" | "hours">("profile");

  const facilityId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("facility");
    return v ? Number(v) : undefined;
  }, [location]);

  // ── Profile tab state
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");

  // ── Rules tab state
  const [cancellationWindow, setCancellationWindow] = useState("24");
  const [advanceBookingLimit, setAdvanceBookingLimit] = useState("30");

  // ── Hours tab state
  const [businessHours, setBusinessHours] = useState<Record<DayKey, { open: string; close: string; closed: boolean }>>(DEFAULT_HOURS);

  const { data: facilities, isLoading } = useQuery<Facility[]>({
    queryKey: ["owner-facilities"],
    queryFn: () => customFetch<Facility[]>(`${API_URL}/facilities`),
  });

  const facility = useMemo(() => {
    if (!facilities) return undefined;
    if (facilityId) return facilities.find(f => f.id === facilityId);
    return facilities[0];
  }, [facilities, facilityId]);

  useEffect(() => {
    if (!facility) return;
    setProfileName(facility.name ?? "");
    setProfileDescription(facility.description ?? "");
    setProfileAddress(facility.address ?? "");
    setProfileCity(facility.city ?? "");
    setProfilePhone(facility.phone ?? "");
    setProfileEmail(facility.email ?? "");
    setCancellationWindow(String(facility.cancellationWindow ?? 24));
    setAdvanceBookingLimit(String(facility.advanceBookingLimit ?? 30));
    if (facility.businessHours) {
      try {
        const parsed = JSON.parse(facility.businessHours);
        setBusinessHours({ ...DEFAULT_HOURS, ...parsed });
      } catch {}
    }
  }, [facility]);

  const mutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!facility) throw new Error("No facility");
      return customFetch(`${API_URL}/facilities/${facility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      toast({ title: "Išsaugota" });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  function saveProfile() {
    mutation.mutate({
      name: profileName,
      description: profileDescription || undefined,
      address: profileAddress || undefined,
      city: profileCity || undefined,
      phone: profilePhone || undefined,
      email: profileEmail || undefined,
    });
  }

  function saveRules() {
    mutation.mutate({
      cancellationWindow: Number(cancellationWindow),
      advanceBookingLimit: Number(advanceBookingLimit),
    });
  }

  function saveHours() {
    mutation.mutate({ businessHours: JSON.stringify(businessHours) });
  }

  function setDayField(day: DayKey, field: "open" | "close" | "closed", value: string | boolean) {
    setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  const TABS = [
    { key: "profile" as const, label: "Profilis" },
    { key: "rules"   as const, label: "Taisyklės" },
    { key: "hours"   as const, label: "Darbo grafikas" },
  ];

  return (
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath={currentPath} facilityId={facilityId} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-base leading-tight">
                {facility ? facility.name : "Nustatymai"}
              </h1>
              {facility && (
                <p className="text-xs text-muted-foreground">Nustatymai</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pl-2">
            {user?.imageUrl
              ? <img src={user.imageUrl} className="w-7 h-7 rounded-full object-cover" />
              : <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user?.firstName?.[0] ?? "O"}</div>
            }
            <span className="text-sm font-medium hidden sm:block">{user?.firstName ?? "Savininkas"}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="space-y-4 max-w-2xl">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : !facility ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">Objekto nerasta. <a href={`${BASE_URL}/owner`} className="text-primary underline">Sukurkite objektą</a>.</p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-5">
              <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Profile tab ── */}
              {tab === "profile" && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <div>
                    <h2 className="font-semibold mb-0.5">Objekto profilis</h2>
                    <p className="text-sm text-muted-foreground">Pagrindinė informacija apie jūsų sporto objektą.</p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Pavadinimas *</label>
                      <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Aprašymas</label>
                      <textarea value={profileDescription} onChange={e => setProfileDescription(e.target.value)} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors resize-none" placeholder="Trumpas aprašymas apie objektą…" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Adresas</label>
                        <input value={profileAddress} onChange={e => setProfileAddress(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Miestas</label>
                        <input value={profileCity} onChange={e => setProfileCity(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">Telefonas</label>
                        <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+370…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block">El. paštas</label>
                        <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={saveProfile} disabled={mutation.isPending} className="gap-2">
                      <Save className="h-4 w-4" />
                      {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Rules tab ── */}
              {tab === "rules" && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <div>
                    <h2 className="font-semibold mb-0.5">Rezervavimo taisyklės</h2>
                    <p className="text-sm text-muted-foreground">Nustatykite atšaukimo ir išankstinio rezervavimo apribojimus.</p>
                  </div>
                  <Separator />
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-semibold block mb-1">Atšaukimo langas (valandos)</label>
                      <p className="text-xs text-muted-foreground mb-2">Minimalus laikas prieš rezervaciją, per kurį galima atšaukti nemokamai.</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={168}
                          value={cancellationWindow}
                          onChange={e => setCancellationWindow(e.target.value)}
                          className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">val.</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold block mb-1">Išankstinio rezervavimo limitas (dienos)</label>
                      <p className="text-xs text-muted-foreground mb-2">Kiek dienų į priekį galima rezervuoti kortą.</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={advanceBookingLimit}
                          onChange={e => setAdvanceBookingLimit(e.target.value)}
                          className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors"
                        />
                        <span className="text-sm text-muted-foreground">d.</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={saveRules} disabled={mutation.isPending} className="gap-2">
                      <Save className="h-4 w-4" />
                      {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Hours tab ── */}
              {tab === "hours" && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <div>
                    <h2 className="font-semibold mb-0.5">Darbo grafikas</h2>
                    <p className="text-sm text-muted-foreground">Nustatykite darbo laiką kiekvienai savaitės dienai.</p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    {DAYS.map(({ key, label }) => {
                      const day = businessHours[key];
                      return (
                        <div key={key} className={`flex items-center gap-3 py-2 border-b border-border/40 last:border-b-0 ${day.closed ? "opacity-50" : ""}`}>
                          <div className="w-28 shrink-0">
                            <span className="text-sm font-medium">{label}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <select
                              value={day.open}
                              disabled={day.closed}
                              onChange={e => setDayField(key, "open", e.target.value)}
                              className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background disabled:cursor-not-allowed"
                            >
                              {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-muted-foreground text-sm">–</span>
                            <select
                              value={day.close}
                              disabled={day.closed}
                              onChange={e => setDayField(key, "close", e.target.value)}
                              className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background disabled:cursor-not-allowed"
                            >
                              {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={day.closed}
                              onChange={e => setDayField(key, "closed", e.target.checked)}
                              className="rounded"
                            />
                            Uždaryta
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={saveHours} disabled={mutation.isPending} className="gap-2">
                      <Save className="h-4 w-4" />
                      {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
