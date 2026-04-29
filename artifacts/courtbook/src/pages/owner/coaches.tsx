import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, Building2, CreditCard, Settings, Users,
  Menu, X, LogOut, Check, Trash2, Euro, MapPin, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SportIcon, sportColor } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

function buildNavItems() {
  return [
    { icon: LayoutDashboard, label: "Suvestinė",      href: `${BASE_URL}/owner/dashboard` },
    { icon: Building2,       label: "Mano aikštelės", href: `${BASE_URL}/owner` },
    { icon: Users,           label: "Treneriai",      href: `${BASE_URL}/owner/coaches` },
    { icon: CreditCard,      label: "Mokėjimai",      href: `${BASE_URL}/owner/payments` },
    { icon: Settings,        label: "Nustatymai",     href: `${BASE_URL}/owner/settings` },
  ];
}

function Sidebar({ open, onClose, currentPath }: { open: boolean; onClose: () => void; currentPath: string }) {
  const [, navigate] = useLocation();
  const NAV_ITEMS = buildNavItems();
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
            const active = currentPath === item.href || currentPath.startsWith(item.href + "?");
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

interface PendingRequest {
  invitationId: number;
  courtId: number;
  courtName: string;
  facilityId: number | null;
  facilityName: string | null;
  message: string | null;
  createdAt: string;
  coach: {
    id: number | null;
    userId: string | null;
    name: string;
    email?: string | null;
    bio?: string;
    photoUrl?: string;
    pricePerHour?: number;
    sports?: string[];
  };
}

interface RosterEntry {
  courtId: number;
  courtName: string;
  facilityId: number | null;
  facilityName: string | null;
  coach: {
    id: number;
    userId: string;
    name: string;
    photoUrl?: string;
    bio?: string;
    pricePerHour?: number;
    sports: string[];
  };
}

export default function OwnerCoachesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPath = `${BASE_URL}/owner/coaches`;

  const requestsQ = useQuery<PendingRequest[]>({
    queryKey: ["owner", "coach-requests"],
    queryFn: () => customFetch<PendingRequest[]>(`${API_URL}/owner/coach-requests`),
  });

  const rosterQ = useQuery<RosterEntry[]>({
    queryKey: ["owner", "coach-roster"],
    queryFn: () => customFetch<RosterEntry[]>(`${API_URL}/owner/coach-roster`),
  });

  const respondMut = useMutation({
    mutationFn: (vars: { invitationId: number; decision: "approve" | "reject" }) =>
      customFetch(`${API_URL}/owner/respond-to-coach`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["owner", "coach-requests"] });
      qc.invalidateQueries({ queryKey: ["owner", "coach-roster"] });
      toast({ title: vars.decision === "approve" ? "Trenerio paraiška patvirtinta" : "Paraiška atmesta" });
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  const removeMut = useMutation({
    mutationFn: (vars: { courtId: number; coachId: number }) =>
      customFetch(`${API_URL}/courts/${vars.courtId}/coaches/${vars.coachId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "coach-roster"] });
      toast({ title: "Treneris pašalintas iš aikštelės" });
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  // Group roster by facility/court
  const rosterByCourt = (rosterQ.data ?? []).reduce<Record<string, RosterEntry[]>>((acc, r) => {
    const key = `${r.courtId}:${r.courtName}`;
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath={currentPath} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2"><Menu className="h-5 w-5" /></button>
          <span className="font-semibold">Treneriai</span>
          <span className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 max-w-5xl w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Treneriai</h1>
            <p className="text-sm text-muted-foreground mt-1">Tvarkykite trenerių paraiškas ir aktyvius narius jūsų aikštelėse.</p>
          </div>

          {/* ── Pending requests ──────────────────────────────────────────── */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Laukiančios paraiškos</h2>
              {requestsQ.data && requestsQ.data.length > 0 && (
                <Badge variant="secondary">{requestsQ.data.length}</Badge>
              )}
            </div>

            {requestsQ.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
              </div>
            ) : !requestsQ.data?.length ? (
              <div className="bg-card border border-dashed rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Šiuo metu naujų paraiškų nėra.
              </div>
            ) : (
              <div className="space-y-3">
                {requestsQ.data.map(req => {
                  const initials = req.coach.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <div key={req.invitationId} className="bg-card border rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        {req.coach.photoUrl ? (
                          <img src={req.coach.photoUrl} alt={req.coach.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20 shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/20 shrink-0">
                            <span className="text-lg font-bold text-primary">{initials}</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <h3 className="font-semibold text-base">
                                {req.coach.id ? (
                                  <Link href={`/coach/${req.coach.id}`} className="hover:underline">{req.coach.name}</Link>
                                ) : req.coach.name}
                              </h3>
                              {req.coach.email && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3" />{req.coach.email}
                                </p>
                              )}
                            </div>
                            {req.coach.pricePerHour != null && (
                              <Badge variant="outline" className="font-semibold">
                                <Euro className="w-3 h-3 mr-1" />{req.coach.pricePerHour}€/val
                              </Badge>
                            )}
                          </div>

                          {req.coach.sports && req.coach.sports.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {req.coach.sports.map(s => {
                                const color = sportColor[s] ?? "#84cc16";
                                return (
                                  <span key={s} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: color + "22", color }}>
                                    <SportIcon sport={s} size={10} strokeWidth={2} />
                                    {SPORT_LABELS[s] ?? s}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {req.coach.bio && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{req.coach.bio}</p>
                          )}

                          <div className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" />
                            Nori dirbti: <span className="font-medium text-foreground">{req.facilityName ?? req.courtName}</span>
                            {req.facilityName && <span>· {req.courtName}</span>}
                          </div>

                          {req.message && (
                            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm italic">"{req.message}"</div>
                          )}

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              onClick={() => respondMut.mutate({ invitationId: req.invitationId, decision: "approve" })}
                              disabled={respondMut.isPending}
                            >
                              <Check className="w-4 h-4 mr-1.5" />Patvirtinti
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => respondMut.mutate({ invitationId: req.invitationId, decision: "reject" })}
                              disabled={respondMut.isPending}
                            >
                              <X className="w-4 h-4 mr-1.5" />Atmesti
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Active roster ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Aktyvūs treneriai</h2>
              {rosterQ.data && rosterQ.data.length > 0 && (
                <Badge variant="secondary">{rosterQ.data.length}</Badge>
              )}
            </div>

            {rosterQ.isLoading ? (
              <Skeleton className="h-32 w-full rounded-2xl" />
            ) : !rosterQ.data?.length ? (
              <div className="bg-card border border-dashed rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Dar nėra patvirtintų trenerių.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(rosterByCourt).map(([key, entries]) => {
                  const first = entries[0];
                  return (
                    <div key={key}>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {first.facilityName ? `${first.facilityName} · ${first.courtName}` : first.courtName}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {entries.map(r => {
                          const initials = r.coach.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                          return (
                            <div key={`${r.courtId}-${r.coach.id}`} className="bg-card border rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                              {r.coach.photoUrl ? (
                                <img src={r.coach.photoUrl} alt={r.coach.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                  <span className="text-sm font-bold text-primary">{initials}</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <Link href={`/coach/${r.coach.id}`} className="font-medium hover:underline truncate block">
                                  {r.coach.name}
                                </Link>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {r.coach.sports.slice(0, 3).map(s => (
                                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      {SPORT_LABELS[s] ?? s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Pašalinti ${r.coach.name} iš ${r.courtName}?`)) {
                                    removeMut.mutate({ courtId: r.courtId, coachId: r.coach.id });
                                  }
                                }}
                                disabled={removeMut.isPending}
                                title="Pašalinti"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
