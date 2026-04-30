import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Euro, Users, Trophy, ArrowLeft, Clock, MapPin, CheckCircle2, AlertCircle, Info, Crown, Zap, ShieldCheck, Layers } from "lucide-react";
import { SportIcon, SPORT_LABELS } from "@/components/sport-icon";
import { SportScoreInput } from "@/components/sport-score-input";
import { type SportScore, getSportConfig, formatScore, deriveWinner } from "@workspace/db/sports-config";
import { validateEmail, validatePhone } from "@/lib/validators";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const STATUS_LABELS: Record<string, string> = {
  draft: "Rengiamas", open: "Registracija atidaryta", closed: "Registracija uždaryta", completed: "Baigtas",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-green-500/15 text-green-500 border-green-500/20",
  closed: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  completed: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};
const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Viengubas pašalinimas",
  double_elimination: "Dvigubas pašalinimas",
  round_robin: "Grupių etapas",
  hybrid: "Mišrus (grupės + atkrintamosios)",
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
  organizerId?: string | null;
  ownerUserId?: string | null;
  facilityName?: string | null;
  facilityVerified?: boolean;
}

interface BracketPlayer { regId: number; name: string }
interface BracketMatch {
  matchId: string;
  round: number;
  groupId?: string;
  p1: BracketPlayer | null;
  p2: BracketPlayer | null;
  winner: BracketPlayer | null;
  /** Structured sport score (preferred) or legacy string. */
  score: SportScore | string | null;
  nextMatchId: string | null;
}

interface BracketRound { round: number; matches: BracketMatch[] }
interface RoundRobinGroup { groupId: string; players: BracketPlayer[]; matches: BracketMatch[] }

interface SingleEliminationData { format: "single_elimination"; generatedAt: string; rounds: BracketRound[] }
interface RoundRobinData { format: "round_robin"; generatedAt: string; groupSize: number; groups: RoundRobinGroup[] }
interface HybridData {
  format: "hybrid";
  generatedAt: string;
  groupSize: number;
  groups: RoundRobinGroup[];
  playoffs: { rounds: BracketRound[] } | null;
  advancePerGroup: number;
}

type BracketData = SingleEliminationData | RoundRobinData | HybridData;

interface Court { id: number; name: string; city: string; address: string; phone: string | null; }

/** Render a single match's score, sport-aware, with a legacy string fallback. */
function renderScoreSides(m: BracketMatch, sport: string): { a: string; b: string } {
  const s = m.score;
  if (!s) return { a: "", b: "" };
  if (typeof s === "string") {
    const [a = "", b = ""] = s.split("-");
    return { a: a.trim(), b: b.trim() };
  }
  if (s.type === "POINT_BASED") return { a: String(s.a), b: String(s.b) };
  if (s.type === "SET_BASED") {
    return {
      a: s.sets.map((x) => x.a).join(" "),
      b: s.sets.map((x) => x.b).join(" "),
    };
  }
  // Final fallback – use formatScore (returns "a-b" style)
  const cfg = getSportConfig(sport);
  const txt = formatScore(s, cfg);
  const [a = "", b = ""] = txt.split("-");
  return { a, b };
}

function MatchCard({
  m,
  sport,
  isOrganizer,
  onEditMatch,
}: {
  m: BracketMatch;
  sport: string;
  isOrganizer: boolean;
  onEditMatch: (m: BracketMatch) => void;
}) {
  const isBye = (!m.p1 && m.p2) || (m.p1 && !m.p2);
  const isComplete = !!m.winner;
  const canEdit = isOrganizer && !!m.p1 && !!m.p2 && !isComplete;
  const sides = renderScoreSides(m, sport);
  return (
    <div
      className={`rounded-lg border-2 overflow-hidden text-xs ${
        isComplete ? "border-primary/40 bg-primary/5" : isBye ? "border-dashed border-border bg-muted/30" : "border-border bg-card"
      } ${canEdit ? "cursor-pointer hover:border-primary hover:shadow" : ""}`}
      onClick={() => canEdit && onEditMatch(m)}
    >
      <div className={`flex items-center justify-between px-2.5 py-1.5 border-b border-border/50 ${
        m.winner?.regId === m.p1?.regId ? "bg-primary/10 font-semibold" : ""
      }`}>
        <span className="truncate flex items-center gap-1 min-w-0">
          {m.winner?.regId === m.p1?.regId && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
          <span className="truncate">{m.p1?.name ?? <span className="italic text-muted-foreground">—</span>}</span>
        </span>
        {isComplete && sides.a && (
          <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{sides.a}</span>
        )}
      </div>
      <div className={`flex items-center justify-between px-2.5 py-1.5 ${
        m.winner?.regId === m.p2?.regId ? "bg-primary/10 font-semibold" : ""
      }`}>
        <span className="truncate flex items-center gap-1 min-w-0">
          {m.winner?.regId === m.p2?.regId && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
          <span className="truncate">{m.p2?.name ?? <span className="italic text-muted-foreground">—</span>}</span>
        </span>
        {isComplete && sides.b && (
          <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{sides.b}</span>
        )}
      </div>
      {canEdit && (
        <div className="px-2 py-1 bg-primary/10 text-[10px] text-primary text-center font-medium">
          Įvesti rezultatą
        </div>
      )}
      {isBye && !isComplete && (
        <div className="px-2 py-1 text-[10px] text-muted-foreground text-center italic">BYE</div>
      )}
    </div>
  );
}

interface StandingsRow {
  regId: number;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsDiff: number;
  pointsDiff: number;
  rankPoints: number;
}

/** Compute standings client-side from a group's matches. Mirrors the API logic (incl. head-to-head tiebreak). */
function computeStandings(group: RoundRobinGroup): StandingsRow[] {
  const rows: Record<number, StandingsRow> = {};
  for (const p of group.players) {
    rows[p.regId] = { regId: p.regId, name: p.name, played: 0, won: 0, lost: 0, setsDiff: 0, pointsDiff: 0, rankPoints: 0 };
  }
  const h2h: Record<number, Record<number, number>> = {};
  for (const m of group.matches) {
    if (!m.winner || !m.p1 || !m.p2) continue;
    const a = rows[m.p1.regId]; const b = rows[m.p2.regId];
    if (!a || !b) continue;
    a.played++; b.played++;
    if (m.winner.regId === m.p1.regId) {
      a.won++; b.lost++; a.rankPoints += 3;
      (h2h[m.p1.regId] ??= {})[m.p2.regId] = 1;
    } else {
      b.won++; a.lost++; b.rankPoints += 3;
      (h2h[m.p2.regId] ??= {})[m.p1.regId] = 1;
    }
    if (m.score && typeof m.score === "object") {
      if (m.score.type === "SET_BASED") {
        let aSets = 0, bSets = 0, aPts = 0, bPts = 0;
        for (const s of m.score.sets) {
          aPts += s.a; bPts += s.b;
          if (s.a > s.b) aSets++; else if (s.b > s.a) bSets++;
        }
        a.setsDiff += aSets - bSets; b.setsDiff += bSets - aSets;
        a.pointsDiff += aPts - bPts; b.pointsDiff += bPts - aPts;
      } else if (m.score.type === "POINT_BASED") {
        a.pointsDiff += m.score.a - m.score.b;
        b.pointsDiff += m.score.b - m.score.a;
      }
    }
  }
  return Object.values(rows).sort((x, y) => {
    if (y.rankPoints !== x.rankPoints) return y.rankPoints - x.rankPoints;
    const xBeatY = h2h[x.regId]?.[y.regId] === 1;
    const yBeatX = h2h[y.regId]?.[x.regId] === 1;
    if (xBeatY && !yBeatX) return -1;
    if (yBeatX && !xBeatY) return 1;
    if (y.setsDiff !== x.setsDiff) return y.setsDiff - x.setsDiff;
    if (y.pointsDiff !== x.pointsDiff) return y.pointsDiff - x.pointsDiff;
    return x.name.localeCompare(y.name);
  });
}

function StandingsTable({ group, advance }: { group: RoundRobinGroup; advance?: number }) {
  const rows = computeStandings(group);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-1.5 pr-2 font-medium">#</th>
            <th className="text-left py-1.5 px-2 font-medium">Žaidėjas</th>
            <th className="text-center py-1.5 px-1.5 font-medium">Ž</th>
            <th className="text-center py-1.5 px-1.5 font-medium">L</th>
            <th className="text-center py-1.5 px-1.5 font-medium">P</th>
            <th className="text-center py-1.5 px-1.5 font-medium" title="Setų skirtumas">±S</th>
            <th className="text-center py-1.5 px-1.5 font-medium" title="Taškų skirtumas">±T</th>
            <th className="text-center py-1.5 pl-1.5 font-semibold">Tšk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const advances = advance != null && i < advance;
            return (
              <tr key={r.regId} className={`border-b border-border/50 ${advances ? "bg-primary/5" : ""}`}>
                <td className="py-1.5 pr-2 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="py-1.5 px-2 truncate max-w-[160px]">
                  <span className={advances ? "font-semibold" : ""}>{r.name}</span>
                  {advances && <span className="ml-1.5 text-[10px] text-primary font-medium">↑</span>}
                </td>
                <td className="text-center px-1.5 tabular-nums">{r.played}</td>
                <td className="text-center px-1.5 tabular-nums text-green-600">{r.won}</td>
                <td className="text-center px-1.5 tabular-nums text-muted-foreground">{r.lost}</td>
                <td className="text-center px-1.5 tabular-nums">{r.setsDiff > 0 ? `+${r.setsDiff}` : r.setsDiff}</td>
                <td className="text-center px-1.5 tabular-nums">{r.pointsDiff > 0 ? `+${r.pointsDiff}` : r.pointsDiff}</td>
                <td className="text-center pl-1.5 tabular-nums font-bold">{r.rankPoints}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupBlock({
  group,
  sport,
  isOrganizer,
  onEditMatch,
  advance,
}: {
  group: RoundRobinGroup;
  sport: string;
  isOrganizer: boolean;
  onEditMatch: (m: BracketMatch) => void;
  advance?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-primary" />
        Grupė {group.groupId}
      </h3>
      <StandingsTable group={group} advance={advance} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {group.matches.map((m) => (
          <MatchCard key={m.matchId} m={m} sport={sport} isOrganizer={isOrganizer} onEditMatch={onEditMatch} />
        ))}
      </div>
    </div>
  );
}

function SingleEliminationView({
  rounds,
  sport,
  isOrganizer,
  onEditMatch,
  titleOverride,
}: {
  rounds: BracketRound[];
  sport: string;
  isOrganizer: boolean;
  onEditMatch: (m: BracketMatch) => void;
  titleOverride?: (rIdx: number) => string;
}) {
  if (!rounds.length) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Tinklelis tuščias</div>;
  }
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-6 min-w-max pb-2">
        {rounds.map((round, rIdx) => (
          <div key={round.round} className="flex flex-col justify-around gap-3 min-w-[220px]">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center mb-1">
              {titleOverride
                ? titleOverride(rIdx)
                : rIdx === rounds.length - 1
                  ? "Finalas"
                  : rIdx === rounds.length - 2
                    ? "Pusfinalis"
                    : `Raundas ${round.round}`}
            </div>
            <div
              className="flex flex-col gap-3 flex-1 justify-around"
              style={{ paddingTop: `${rIdx * 20}px`, paddingBottom: `${rIdx * 20}px` }}
            >
              {round.matches.map((m) => (
                <MatchCard key={m.matchId} m={m} sport={sport} isOrganizer={isOrganizer} onEditMatch={onEditMatch} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketView({
  bracket,
  sport,
  isOrganizer,
  onEditMatch,
}: {
  bracket: BracketData;
  sport: string;
  isOrganizer: boolean;
  onEditMatch: (m: BracketMatch) => void;
}) {
  if (bracket.format === "single_elimination") {
    return <SingleEliminationView rounds={bracket.rounds} sport={sport} isOrganizer={isOrganizer} onEditMatch={onEditMatch} />;
  }
  if (bracket.format === "round_robin") {
    return (
      <div className="space-y-4">
        {bracket.groups.map((g) => (
          <GroupBlock key={g.groupId} group={g} sport={sport} isOrganizer={isOrganizer} onEditMatch={onEditMatch} />
        ))}
      </div>
    );
  }
  // hybrid
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {bracket.groups.map((g) => (
          <GroupBlock
            key={g.groupId}
            group={g}
            sport={sport}
            isOrganizer={isOrganizer}
            onEditMatch={onEditMatch}
            advance={bracket.advancePerGroup}
          />
        ))}
      </div>
      {bracket.playoffs ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            Atkrintamosios
          </h3>
          <SingleEliminationView
            rounds={bracket.playoffs.rounds}
            sport={sport}
            isOrganizer={isOrganizer}
            onEditMatch={onEditMatch}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
          Atkrintamosios bus sugeneruotos baigus visus grupių mačus.
        </div>
      )}
    </div>
  );
}

export default function TournamentDetail() {
  const { id } = useParams();
  const tournamentId = parseInt(id || "0", 10);
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [registered, setRegistered] = useState(false);
  const [scoreMatch, setScoreMatch] = useState<BracketMatch | null>(null);
  const [scoreValue, setScoreValue] = useState<SportScore | null>(null);
  const [scoreValid, setScoreValid] = useState(false);

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const r = await fetch(`${API}/tournaments/${tournamentId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !isNaN(tournamentId),
  });

  const { data: court } = useQuery<Court>({
    queryKey: ["court", tournament?.courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${tournament!.courtId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!tournament?.courtId,
  });

  const isOrganizer = !!user && !!tournament && (
    user.id === tournament.organizerId || user.id === tournament.ownerUserId
  );

  const { data: bracket } = useQuery<BracketData | null>({
    queryKey: ["tournament-bracket", tournamentId],
    queryFn: async () => {
      const r = await fetch(`${API}/tournaments/${tournamentId}/bracket`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !isNaN(tournamentId),
  });

  const generateBracketMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API}/tournaments/${tournamentId}/generate-bracket`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko sugeneruoti tinklelio");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament-bracket", tournamentId] });
      toast({ title: "Tinklelis sugeneruotas" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const matchResultMutation = useMutation({
    mutationFn: async (vars: { matchId: string; score?: SportScore; winnerRegId?: number }) => {
      const token = await getToken();
      const r = await fetch(`${API}/tournaments/${tournamentId}/match-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(vars),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko išsaugoti rezultato");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament-bracket", tournamentId] });
      setScoreMatch(null);
      setScoreValue(null);
      setScoreValid(false);
      toast({ title: "Rezultatas išsaugotas" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { playerName: string; playerEmail: string; playerPhone?: string; userId?: string }) => {
      const r = await fetch(`${API}/tournaments/${tournamentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Registracija nepavyko");
      }
      return r.json();
    },
    onSuccess: () => {
      setRegistered(true);
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      toast({ title: "Sėkmingai užsiregistravote!" });
    },
    onError: (e: Error) => {
      toast({ title: e.message, variant: "destructive" });
    },
  });

  const handleRegister = () => {
    const name = isSignedIn ? (user?.fullName ?? playerName) : playerName;
    const email = isSignedIn ? (user?.primaryEmailAddress?.emailAddress ?? playerEmail) : playerEmail;

    if (!name.trim()) { toast({ title: "Įveskite vardą", variant: "destructive" }); return; }
    const emailErr = validateEmail(email);
    if (emailErr) {
      toast({ title: emailErr, variant: "destructive" }); return;
    }
    const phoneErr = validatePhone(playerPhone, { required: false });
    if (phoneErr) {
      toast({ title: phoneErr, variant: "destructive" }); return;
    }

    registerMutation.mutate({
      playerName: name.trim(),
      playerEmail: email.trim(),
      playerPhone: playerPhone.trim() || undefined,
      userId: user?.id,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!tournament) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Turnyras nerastas.</p>
          <Link href="/tournaments"><Button variant="outline" className="mt-4">Grįžti į sąrašą</Button></Link>
        </div>
      </Layout>
    );
  }

  const spotsLeft = tournament.maxParticipants - tournament.registrationCount;
  const isFull = spotsLeft <= 0;
  const isOpen = tournament.status === "open";
  const deadlinePassed = tournament.registrationDeadline ? new Date() > new Date(tournament.registrationDeadline) : false;
  const canRegister = isOpen && !isFull && !deadlinePassed && !registered;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <Link href="/tournaments">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-6 -ml-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Visi turnyrai
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main */}
          <div className="md:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <SportIcon sport={tournament.sport} className="w-5 h-5" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">{SPORT_LABELS[tournament.sport] ?? tournament.sport}</span>
                <span className={`ml-auto text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[tournament.status]}`}>
                  {STATUS_LABELS[tournament.status] ?? tournament.status}
                </span>
              </div>
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              {(tournament.facilityVerified || tournament.prizeInfo) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {tournament.facilityVerified && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 border border-green-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Patvirtintas aikštynas
                    </span>
                  )}
                  {tournament.prizeInfo && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-700 border border-yellow-500/30">
                      <Trophy className="w-3.5 h-3.5" />
                      Prizinis fondas
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{tournament.description}</p>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Data</p>
                <p className="font-semibold text-sm">{tournament.startDate}</p>
                {tournament.startDate !== tournament.endDate && (
                  <p className="text-xs text-muted-foreground">– {tournament.endDate}</p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Dalyviai</p>
                <p className="font-semibold text-sm">{tournament.registrationCount} / {tournament.maxParticipants}</p>
                {isOpen && (
                  <p className={`text-xs mt-0.5 font-medium ${isFull ? "text-destructive" : "text-green-500"}`}>
                    {isFull ? "Pilna" : `${spotsLeft} vietos liko`}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" />Formatas</p>
                <p className="font-semibold text-sm">{FORMAT_LABELS[tournament.format] ?? tournament.format}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Euro className="w-3.5 h-3.5" />Dalyvio mokestis</p>
                <p className={`font-semibold text-sm ${!tournament.entryFee || tournament.entryFee === 0 ? "text-green-500" : ""}`}>
                  {!tournament.entryFee || tournament.entryFee === 0 ? "Nemokama" : `€${tournament.entryFee}`}
                </p>
              </div>
            </div>

            {/* Prize */}
            {tournament.prizeInfo && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-1">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  Prizai
                </p>
                <p className="text-sm text-muted-foreground">{tournament.prizeInfo}</p>
              </div>
            )}

            {/* Bracket */}
            {(bracket || isOrganizer) && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Tinklelis
                  </h2>
                  {isOrganizer && (
                    <Button
                      size="sm"
                      variant={bracket ? "outline" : "default"}
                      onClick={() => {
                        if (bracket && !confirm("Pergeneruoti tinklelį? Esami rezultatai bus prarasti.")) return;
                        generateBracketMutation.mutate();
                      }}
                      disabled={generateBracketMutation.isPending}
                      className="gap-1.5"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      {bracket ? "Pergeneruoti" : "Sugeneruoti tinklelį"}
                    </Button>
                  )}
                </div>
                {bracket ? (
                  <BracketView
                    bracket={bracket}
                    sport={tournament.sport}
                    isOrganizer={isOrganizer}
                    onEditMatch={(m) => {
                      setScoreMatch(m);
                      setScoreValue(m.score && typeof m.score === "object" ? m.score : null);
                      setScoreValid(false);
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Tinklelis dar nesugeneruotas. Po registracijos uždarymo paspauskite mygtuką viršuje.
                  </p>
                )}
              </div>
            )}

            {/* Court */}
            {court && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-2">Vieta</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{court.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3" />{court.city} · {court.address}
                    </div>
                  </div>
                  <Link href={`/courts/${court.id}`}>
                    <Button variant="outline" size="sm">Peržiūrėti aikštelę</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — registration */}
          <div className="md:col-span-1 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 sticky top-20">
              <h2 className="font-semibold text-base">Registracija</h2>
              <Separator />

              {registered ? (
                <div className="py-4 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                  <p className="font-semibold text-green-500">Užsiregistravote!</p>
                  <p className="text-xs text-muted-foreground">Patvirtinimas bus išsiųstas el. paštu</p>
                </div>
              ) : !isOpen ? (
                <div className="py-4 text-center space-y-2 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm">{STATUS_LABELS[tournament.status] ?? tournament.status}</p>
                </div>
              ) : isFull ? (
                <div className="py-4 text-center space-y-2 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-destructive">Turnyras pilnas</p>
                </div>
              ) : deadlinePassed ? (
                <div className="py-4 text-center space-y-2 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm">Registracija pasibaigė</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tournament.registrationDeadline && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Registracija iki {tournament.registrationDeadline}
                    </div>
                  )}

                  {isSignedIn ? (
                    <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                      <p className="font-semibold">{user?.fullName}</p>
                      <p className="text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Vardas pavardė *</Label>
                        <Input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Jonas Jonaitis" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">El. paštas *</Label>
                        <Input type="email" value={playerEmail} onChange={e => setPlayerEmail(e.target.value)} placeholder="jonas@email.lt" className="h-9 text-sm" />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefonas (neprivaloma)</Label>
                    <Input type="tel" value={playerPhone} onChange={e => setPlayerPhone(e.target.value)} placeholder="+370 600 00000" className="h-9 text-sm" />
                  </div>

                  {tournament.entryFee != null && tournament.entryFee > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm">
                      <span className="text-muted-foreground">Mokestis</span>
                      <span className="font-bold">€{tournament.entryFee}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleRegister}
                    className="w-full h-11 font-semibold gap-2"
                    disabled={registerMutation.isPending}
                  >
                    <Trophy className="w-4 h-4" />
                    {registerMutation.isPending ? "Registruojama..." : "Registruotis"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {spotsLeft} {spotsLeft === 1 ? "vieta" : "vietos"} iš {tournament.maxParticipants}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Score entry dialog (organizer-only) — uses sport-aware input */}
      <Dialog open={!!scoreMatch} onOpenChange={(open) => { if (!open) { setScoreMatch(null); setScoreValue(null); setScoreValid(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Įvesti rezultatą</DialogTitle>
          </DialogHeader>
          {scoreMatch && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                <span className="truncate">{scoreMatch.p1?.name ?? "—"}</span>
                <span className="text-muted-foreground text-xs px-2">vs</span>
                <span className="truncate">{scoreMatch.p2?.name ?? "—"}</span>
              </div>
              <SportScoreInput
                sport={tournament.sport}
                labelA={scoreMatch.p1?.name ?? "A"}
                labelB={scoreMatch.p2?.name ?? "B"}
                value={scoreValue}
                onChange={(s, valid) => { setScoreValue(s); setScoreValid(valid); }}
                showErrors
                disabled={matchResultMutation.isPending}
              />
              {scoreValue && scoreValid && (() => {
                const cfg = getSportConfig(tournament.sport);
                const side = deriveWinner(scoreValue, cfg);
                if (!side) return (
                  <p className="text-xs text-destructive">Lygiosios negalimos – nustatykite nugalėtoją.</p>
                );
                const winner = side === "a" ? scoreMatch.p1 : scoreMatch.p2;
                return (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-yellow-500" />
                    Nugalėtojas: <span className="font-semibold text-foreground">{winner?.name ?? "—"}</span>
                  </p>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setScoreMatch(null); setScoreValue(null); setScoreValid(false); }}>Atšaukti</Button>
            <Button
              disabled={!scoreValue || !scoreValid || matchResultMutation.isPending || (() => {
                if (!scoreValue) return true;
                const cfg = getSportConfig(tournament.sport);
                return deriveWinner(scoreValue, cfg) == null;
              })()}
              onClick={() => {
                if (!scoreMatch || !scoreValue) return;
                matchResultMutation.mutate({
                  matchId: scoreMatch.matchId,
                  score: scoreValue,
                });
              }}
            >
              {matchResultMutation.isPending ? "Saugoma..." : "Išsaugoti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
