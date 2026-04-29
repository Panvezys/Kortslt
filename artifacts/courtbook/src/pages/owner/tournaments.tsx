import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Building2, CreditCard, Settings, Users, Trophy,
  CalendarDays, MapPin, CheckCircle2, XCircle, Clock, AlertCircle,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

interface PendingTournament {
  id: number;
  facilityId: number | null;
  facilityName: string | null;
  facilityCity: string | null;
  organizerId: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  entryFee: number | null;
  prizeInfo: string | null;
  description: string | null;
  approvalStatus: string;
  courtIds: number[];
  createdAt: string;
}

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

function buildNavItems() {
  return [
    { icon: LayoutDashboard, label: "Suvestinė", href: `${BASE_URL}/owner/dashboard` },
    { icon: Building2,       label: "Aikštynai", href: `${BASE_URL}/owner` },
    { icon: Users,           label: "Treneriai", href: `${BASE_URL}/owner/coaches` },
    { icon: Trophy,          label: "Turnyrai",  href: `${BASE_URL}/owner/tournaments` },
    { icon: CreditCard,      label: "Mokėjimai", href: `${BASE_URL}/owner/payments` },
    { icon: Settings,        label: "Nustatymai", href: `${BASE_URL}/owner/settings` },
  ];
}

export default function OwnerTournamentsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [responseMap, setResponseMap] = useState<Record<number, string>>({});
  const navItems = buildNavItems();
  const currentPath = `${BASE_URL}/owner/tournaments`;

  const { data: pending = [], isLoading } = useQuery<PendingTournament[]>({
    queryKey: ["owner-tournament-requests"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/owner/tournament-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Nepavyko gauti užklausų");
      return r.json();
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (vars: { tournamentId: number; decision: "approve" | "reject"; message?: string }) => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/owner/respond-to-tournament`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(vars),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko atsakyti");
      }
      return r.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["owner-tournament-requests"] });
      toast({
        title: vars.decision === "approve" ? "Turnyras patvirtintas" : "Turnyras atmestas",
        description: vars.decision === "approve" ? "Aikštelės tomis dienomis užblokuotos automatiškai." : undefined,
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-60 border-r border-border bg-card hidden md:block">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Aikštynų valdymas</h2>
            <nav className="space-y-1">
              {navItems.map(item => {
                const active = item.href === currentPath;
                return (
                  <button
                    key={item.href}
                    onClick={() => setLocation(item.href.replace(BASE_URL, ""))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-8 max-w-5xl">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h1 className="text-2xl font-bold">Turnyrų užklausos</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Patvirtinkite arba atmeskite organizatorių prašymus rengti turnyrus jūsų aikštynuose.
              Patvirtinus, aikštelės tomis dienomis bus automatiškai užblokuotos kasdieniniam rezervavimui.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
              <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium">Nėra laukiančių užklausų</p>
              <p className="text-sm text-muted-foreground mt-1">Naujos užklausos pasirodys čia.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map(t => (
                <div key={t.id} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-700 font-medium">
                          {SPORT_LABELS[t.sport] ?? t.sport}
                        </span>
                        <span>·</span>
                        <span>{t.facilityName} {t.facilityCity && `(${t.facilityCity})`}</span>
                      </div>
                      <h3 className="font-bold text-lg">{t.name}</h3>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-500/15 text-orange-600 font-medium border border-orange-500/30">
                      <AlertCircle className="w-3 h-3" />
                      Laukia atsakymo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t.startDate}{t.startDate !== t.endDate && ` – ${t.endDate}`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t.maxParticipants} dalyvių</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t.courtIds?.length || 1} aikštel{t.courtIds?.length === 1 ? "ė" : "ės"}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Mokestis: {t.entryFee && t.entryFee > 0 ? `€${t.entryFee}` : "Nemokama"}
                    </div>
                  </div>

                  {(t.organizerName || t.organizerEmail) && (
                    <div className="text-xs text-muted-foreground mb-3">
                      Organizatorius: <span className="font-medium text-foreground">{t.organizerName ?? t.organizerEmail}</span>
                    </div>
                  )}

                  {t.description && (
                    <div className="rounded-lg bg-background border border-border p-3 mb-3 text-sm text-muted-foreground whitespace-pre-wrap">
                      {t.description}
                    </div>
                  )}

                  <Separator className="my-3" />

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Žinutė organizatoriui (neprivaloma)"
                      value={responseMap[t.id] ?? ""}
                      onChange={e => setResponseMap(m => ({ ...m, [t.id]: e.target.value }))}
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => respondMutation.mutate({ tournamentId: t.id, decision: "reject", message: responseMap[t.id] })}
                        disabled={respondMutation.isPending}
                        className="gap-1.5"
                      >
                        <XCircle className="w-4 h-4" /> Atmesti
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => respondMutation.mutate({ tournamentId: t.id, decision: "approve", message: responseMap[t.id] })}
                        disabled={respondMutation.isPending}
                        className="gap-1.5 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Patvirtinti
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-xs text-muted-foreground">
            <Link href="/tournaments" className="underline hover:text-foreground">Žiūrėti viešą turnyrų sąrašą →</Link>
          </div>
        </main>
      </div>
    </Layout>
  );
}
