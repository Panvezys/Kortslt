import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Euro, Users, Trophy, Search, MapPin, Clock, X } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rengiamas", open: "Registracija", closed: "Uždaryta", completed: "Baigtas",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-green-500/15 text-green-500 border-green-500/20",
  closed: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  completed: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Pašalinimas",
  double_elimination: "Dv. pašalinimas",
  round_robin: "Round Robin",
  league: "Lyga",
};

interface Tournament {
  id: number;
  courtId: number;
  name: string;
  description: string | null;
  sport: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  maxParticipants: number;
  entryFee: number | null;
  prizeInfo: string | null;
  status: string;
  format: string;
  registrationCount: number;
}

function TournamentCard({ t }: { t: Tournament }) {
  const spotsLeft = t.maxParticipants - t.registrationCount;
  return (
    <Link href={`/tournaments/${t.id}`}>
      <div className="group rounded-2xl border border-border bg-card hover:border-primary/60 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer">
        {/* Header gradient */}
        <div className="h-2 bg-gradient-to-r from-primary/60 to-primary/30" />

        <div className="p-5 space-y-4">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <SportIcon sport={t.sport} className="w-4 h-4" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{SPORT_LABELS[t.sport] ?? t.sport}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[t.status]}`}>
              {STATUS_LABELS[t.status] ?? t.status}
            </span>
          </div>

          {/* Title */}
          <div>
            <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">{t.name}</h3>
            {t.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
            )}
          </div>

          {/* Meta */}
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>{t.startDate} — {t.endDate}</span>
            </div>
            {t.registrationDeadline && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Registracija iki {t.registrationDeadline}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{t.registrationCount}/{t.maxParticipants} dalyvių
                {t.status === "open" && spotsLeft > 0 && (
                  <span className="ml-1 text-green-500 font-medium">({spotsLeft} vietos)</span>
                )}
                {t.status === "open" && spotsLeft <= 0 && (
                  <span className="ml-1 text-destructive font-medium">(pilna)</span>
                )}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">{FORMAT_LABELS[t.format] ?? t.format}</span>
            {t.entryFee != null && t.entryFee > 0 ? (
              <span className="flex items-center gap-1 text-sm font-semibold">
                <Euro className="w-3 h-3 text-primary" />€{t.entryFee}
              </span>
            ) : (
              <span className="text-xs font-semibold text-green-500">Nemokama</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TournamentsPage() {
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const r = await fetch(`${API}/tournaments`);
      if (!r.ok) throw new Error("Failed to load tournaments");
      return r.json();
    },
  });

  const filtered = tournaments.filter(t => {
    const matchSport = sport === "all" || t.sport === sport;
    const matchStatus = status === "all" || t.status === status;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    return matchSport && matchStatus && matchSearch;
  });

  const openCount = tournaments.filter(t => t.status === "open").length;

  const activeFilters = (sport !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0) + (search ? 1 : 0);
  const resetFilters = () => { setSearch(""); setSport("all"); setStatus("all"); };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Photo Hero */}
        <div className="relative h-52 sm:h-64 md:h-72 overflow-hidden">
          <img
            src="/courts/court_17_zalgiris.png"
            alt="Turnyrai"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />
          <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 pb-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/20 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Trophy className="w-4.5 h-4.5 text-yellow-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">Turnyrai</h1>
            </div>
            <p className="text-white/80 text-sm sm:text-base max-w-xl drop-shadow-sm">
              Dalyvaukite sporte – vietiniai ir regioniniai turnyrai visoms sporto šakoms.
            </p>
            {openCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-green-300 text-xs font-medium px-3 py-1.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {openCount} turnyr{openCount === 1 ? "as" : "ai"} priima registracijas
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          {/* Sticky filter bar */}
          <div className="sticky top-[6.5rem] z-30 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Ieškoti turnyrų..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="sm:w-44 h-9 text-sm">
                  <SelectValue placeholder="Sporto šaka" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos sporto šakos</SelectItem>
                  {Object.entries(SPORT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-44 h-9 text-sm">
                  <SelectValue placeholder="Būsena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos būsenos</SelectItem>
                  <SelectItem value="open">Registracija atidaryta</SelectItem>
                  <SelectItem value="draft">Rengiamas</SelectItem>
                  <SelectItem value="closed">Registracija uždaryta</SelectItem>
                  <SelectItem value="completed">Baigtas</SelectItem>
                </SelectContent>
              </Select>
              {activeFilters > 0 && (
                <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                  Valyti
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground pt-1">
            {isLoading ? "Kraunama..." : `Rasta ${filtered.length} turnyrų`}
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Turnyrų nerasta</p>
              <p className="text-sm mt-1">Pabandykite pakeisti filtrus</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(t => <TournamentCard key={t.id} t={t} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
