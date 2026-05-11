import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SportPill, SPORT_LABELS } from "@/components/sport-icon";
import { customFetch } from "@workspace/api-client-react";
import {
  Calendar, Clock, MapPin, Users, Trophy, Swords,
  Crown, ChevronRight, History, Zap, CheckCircle2, XCircle, Minus,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table-tennis", "volleyball", "hockey", "futsal", "floorball", "beach-volleyball", "golf", "bowling", "pickleball"];

interface MyGame {
  id: number;
  sport: string;
  city: string | null;
  placeName: string | null;
  description: string | null;
  isPrivate: boolean;
  datetime: string;
  status: string;
  matchType: string;
  playersNeeded: number;
  isCreator: boolean;
  myTeam: string | null;
  myResult: "win" | "loss" | "draw" | null;
  bookingId: number | null;
  courtName: string | null;
  facilityName: string | null;
  facilityCity: string | null;
  courtImageUrl: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  pricePerSlot: number | null;
  totalSlots: number | null;
  result: { scoreTeamA: number; scoreTeamB: number; status: string } | null;
  participants: { userId: string; userName: string; team: string | null; elo: number }[];
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("lt-LT", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("lt-LT", { weekday: "short", month: "short", day: "numeric" });
}

function ResultIcon({ result }: { result: "win" | "loss" | "draw" | null }) {
  if (!result) return null;
  if (result === "win") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (result === "loss") return <XCircle className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function ResultBadge({ result }: { result: "win" | "loss" | "draw" | null }) {
  if (!result) return null;
  const map = {
    win: { label: "Laimėta", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30" },
    loss: { label: "Pralaimėta", cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-400/30" },
    draw: { label: "Lygiosios", cls: "bg-muted text-muted-foreground border-border" },
  };
  const { label, cls } = map[result];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cls}`}>
      <ResultIcon result={result} />{label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Atviras", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30" },
    awaiting_players: { label: "Laukia žaidėjų", cls: "bg-blue-500/15 text-blue-500 border-blue-400/30" },
    full: { label: "Pilnas", cls: "bg-orange-500/15 text-orange-500 border-orange-400/30" },
    pending_verification: { label: "Laukia patvirtinimo", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30" },
    completed: { label: "Baigtas", cls: "bg-muted text-muted-foreground border-border" },
    pending_payment: { label: "Laukia mokėjimo", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-400/30" },
    cancelled: { label: "Atšauktas", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function GameCard({ g }: { g: MyGame }) {
  const isBooked = g.bookingId != null;
  const isPast = new Date(g.datetime) < new Date();
  const participantCount = g.participants.length;

  return (
    <Link href={`/matches/${g.id}`}>
      <div className="group rounded-2xl border border-border hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden cursor-pointer bg-card/80">
        <div className={`h-1 ${g.matchType === "rated" ? "bg-gradient-to-r from-purple-500 to-purple-400" : isBooked ? "bg-gradient-to-r from-primary to-primary/60" : "bg-gradient-to-r from-emerald-500 to-emerald-400"}`} />

        {isBooked && g.courtImageUrl && (
          <div className="h-24 overflow-hidden">
            <img src={g.courtImageUrl} alt={g.courtName ?? ""} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <SportPill sport={g.sport} variant="subtle" size="sm" />
                {g.matchType === "rated" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-400/20">
                    <Swords className="w-3 h-3" />Reitinginis
                  </span>
                )}
                {g.isCreator && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30">
                    <Crown className="w-3 h-3" />Kūrėjas
                  </span>
                )}
                {isBooked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Zap className="w-3 h-3" />Su kortu
                  </span>
                )}
              </div>

              {isBooked ? (
                <p className="font-semibold text-sm truncate">{g.courtName}</p>
              ) : (
                <p className="font-semibold text-sm truncate">
                  {g.city}{g.placeName ? ` · ${g.placeName}` : ""}
                </p>
              )}
              {isBooked && (g.facilityName || g.facilityCity) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {g.facilityName}{g.facilityCity ? `, ${g.facilityCity}` : ""}
                </p>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              <StatusBadge status={g.status} />
              {isPast && g.myResult && <ResultBadge result={g.myResult} />}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {isBooked && g.date ? formatDate(g.date) : formatDateTime(g.datetime)}
            </span>
            {isBooked && g.startTime && g.endTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{g.startTime}–{g.endTime}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{participantCount}/{g.playersNeeded}
            </span>
            {isBooked && g.pricePerSlot != null && (
              <span className="font-semibold text-primary">{g.pricePerSlot.toFixed(2)} € / žaid.</span>
            )}
          </div>

          {g.result && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
              <Trophy className="w-3 h-3" />
              Rezultatas: <span className="font-semibold text-foreground">{g.result.scoreTeamA} – {g.result.scoreTeamB}</span>
            </div>
          )}

          <div className="flex items-center justify-end pt-0.5">
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}

type TimeFilter = "upcoming" | "past" | "all";

export default function MyMatchesPage() {
  const { user, isLoaded } = useUser();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const [sportFilter, setSportFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");

  const { data: games = [], isLoading } = useQuery<MyGame[]>({
    queryKey: ["my-games"],
    queryFn: () => customFetch<MyGame[]>(`${API}/games/my`),
    enabled: !!user,
  });

  const now = new Date();

  const filtered = useMemo(() => {
    let items = games;
    if (sportFilter !== "all") items = items.filter(g => g.sport === sportFilter);
    if (timeFilter === "upcoming") items = items.filter(g => new Date(g.datetime) >= now);
    else if (timeFilter === "past") items = items.filter(g => new Date(g.datetime) < now);
    if (resultFilter === "win") items = items.filter(g => g.myResult === "win");
    else if (resultFilter === "loss") items = items.filter(g => g.myResult === "loss");
    else if (resultFilter === "draw") items = items.filter(g => g.myResult === "draw");
    else if (resultFilter === "unfinished") items = items.filter(g => g.myResult === null);
    return timeFilter === "past"
      ? items // already desc from API
      : items.slice().sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [games, sportFilter, timeFilter, resultFilter, now]);

  const upcomingCount = games.filter(g => new Date(g.datetime) >= now).length;
  const pastCount = games.filter(g => new Date(g.datetime) < now).length;

  const TAB_CLS = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
    }`;

  if (isLoaded && !user) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <History className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-lg font-semibold">Reikia prisijungti</p>
            <Button asChild><Link href="/sign-in">Prisijungti</Link></Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <History className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">Mano mačai</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-12">
              Visi jūsų mačai — sukurti ir su dalyvavimu
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
          {/* Time filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button className={TAB_CLS(timeFilter === "upcoming")} onClick={() => setTimeFilter("upcoming")}>
              Būsimi {upcomingCount > 0 && <span className="ml-1 opacity-60 text-xs">({upcomingCount})</span>}
            </button>
            <button className={TAB_CLS(timeFilter === "past")} onClick={() => setTimeFilter("past")}>
              Praeiti {pastCount > 0 && <span className="ml-1 opacity-60 text-xs">({pastCount})</span>}
            </button>
            <button className={TAB_CLS(timeFilter === "all")} onClick={() => setTimeFilter("all")}>
              Visi {games.length > 0 && <span className="ml-1 opacity-60 text-xs">({games.length})</span>}
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Select value={sportFilter} onValueChange={setSportFilter}>
              <SelectTrigger className="h-9 text-sm w-48">
                <SelectValue placeholder="Visos sporto šakos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visos sporto šakos</SelectItem>
                {SPORTS.map(s => <SelectItem key={s} value={s}>{(SPORT_LABELS as any)[s] ?? s}</SelectItem>)}
              </SelectContent>
            </Select>

            {timeFilter !== "upcoming" && (
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue placeholder="Rezultatas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi rezultatai</SelectItem>
                  <SelectItem value="win">Laimėta</SelectItem>
                  <SelectItem value="loss">Pralaimėta</SelectItem>
                  <SelectItem value="draw">Lygiosios</SelectItem>
                  <SelectItem value="unfinished">Be rezultato</SelectItem>
                </SelectContent>
              </Select>
            )}

            {(sportFilter !== "all" || resultFilter !== "all") && (
              <button
                onClick={() => { setSportFilter("all"); setResultFilter("all"); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2">
                Išvalyti filtrus
              </button>
            )}
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <History className="w-12 h-12 text-muted-foreground/30" />
              <div>
                <p className="text-lg font-semibold text-muted-foreground">
                  {timeFilter === "upcoming" ? "Nėra būsimų mačų" : timeFilter === "past" ? "Nėra praeusių mačų" : "Nėra mačų"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {timeFilter === "upcoming" ? "Prisijunkite prie mačo arba sukurkite savo." : "Čia pasirodys jūsų žaisti mačai."}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/matches">Rasti mačų</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Rodoma: <span className="font-semibold text-foreground">{filtered.length}</span> mačų
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {filtered.map(g => <GameCard key={g.id} g={g} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
