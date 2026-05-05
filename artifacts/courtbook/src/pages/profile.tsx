import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useUser, useClerk } from "@clerk/react";
import { useListBookings, useListCourts, customFetch, getListBookingsQueryKey, getListCourtsQueryKey } from "@workspace/api-client-react";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useSearch, useLocation } from "wouter";
import { useT } from "@/lib/i18n";
import { SportIcon, SportPill, SPORT_LABELS, getSportColor } from "@/components/sport-icon";
import { SkillCard } from "@/components/skill-card";
import { useRole } from "@/lib/useRole";
import {
  CalendarDays,
  Star,
  Heart,
  LayoutDashboard,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Pencil,
  Building2,
  MessageSquare,
  Trophy,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Dumbbell,
  Gamepad2,
  Timer,
  ChevronRight,
  Swords,
  Flame,
  TrendingUp,
  Info,
  RefreshCw,
} from "lucide-react";
import { getTier } from "@/lib/rank-tier";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface DMThread {
  otherUserId: string;
  otherUserName: string;
  otherUserImageUrl: string | null;
  lastMessage: { body: string; createdAt: string; senderUserId: string };
  unread: number;
}

interface SportProfile {
  sport: string;
  level: string;
}

interface SportStat {
  sport: string;
  gamesPlayed: number;
  hoursPlayed: number;
  gameHours?: number;
  bookingHours?: number;
}

interface SportRating {
  sport: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

interface UserSportsData {
  activityPublic: boolean;
  bio: string | null;
  sportProfiles: SportProfile[];
  stats: SportStat[];
  ratings?: SportRating[];
}

const ALL_SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Pradedantysis",
  intermediate: "Vidutinis",
  advanced: "Pažengęs",
  pro: "Profesionalas",
};
const LEVELS = Object.keys(LEVEL_LABELS);

const LEVEL_COLOR: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600 border-green-200",
  intermediate: "bg-blue-500/15 text-blue-600 border-blue-200",
  advanced: "bg-orange-500/15 text-orange-600 border-orange-200",
  pro: "bg-purple-500/15 text-purple-600 border-purple-200",
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "dabar";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString("lt-LT", { month: "short", day: "numeric" });
}

function DMInbox({ userId }: { userId: string }) {
  const [, navigate] = useLocation();

  const { data: threads, isLoading } = useQuery<DMThread[]>({
    queryKey: ["dm-threads"],
    queryFn: () => customFetch<DMThread[]>(`${API}/dm/threads`),
    enabled: !!userId,
    refetchInterval: 15000,
  });

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Pokalbiai</span>
          {threads && threads.some(t => t.unread > 0) && (
            <Badge className="h-5 px-1.5 text-xs">
              {threads.reduce((sum, t) => sum + t.unread, 0)}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
          <Link href="/messages">
            Visos žinutės
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>

      {/* Thread list */}
      <div className="divide-y max-h-[420px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4 items-center">
              <Skeleton className="w-11 h-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))
        ) : !threads?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p>Dar nėra pokalbių</p>
            <p className="text-xs text-center px-6">Pokalbiai prasideda iš aikštelės, žaidimo ar trenerio puslapio</p>
          </div>
        ) : (
          threads.map(t => (
            <button
              key={t.otherUserId}
              onClick={() => navigate(`/messages?u=${t.otherUserId}&n=${encodeURIComponent(t.otherUserName)}`)}
              className="w-full text-left flex gap-3 px-5 py-4 hover:bg-muted/40 transition-colors"
            >
              <Avatar className="w-11 h-11 shrink-0">
                {t.otherUserImageUrl && <AvatarImage src={t.otherUserImageUrl} alt={t.otherUserName} />}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {t.otherUserName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold truncate ${t.unread > 0 ? "text-foreground" : ""}`}>
                    {t.otherUserName}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(t.lastMessage.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-xs truncate flex-1 ${t.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {t.lastMessage.senderUserId === userId ? "Jūs: " : ""}
                    {t.lastMessage.body}
                  </p>
                  {t.unread > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px] shrink-0">{t.unread}</Badge>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}


function StatusBadge({ status }: { status: string }) {
  const t = useT();
  if (status === "confirmed")
    return (
      <Badge className="bg-green-500/15 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {t("bookings.status.confirmed")}
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 gap-1">
        <Clock className="w-3 h-3" />
        {t("bookings.status.pending")}
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="w-3 h-3" />
      {t("bookings.status.cancelled")}
    </Badge>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = "text-primary",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-card border rounded-xl p-5 flex flex-col gap-2 shadow-sm transition-all ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5" : ""}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-muted ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

interface EloPoint { id: number; recordedAt: string; elo: number; delta: number; gameId: number | null; sportSlug: string; }

const PIE_COLORS = ["#22c55e", "#ef4444", "#94a3b8"];

function SportEloSection({ userId, sport, currentElo }: { userId: string; sport: string; currentElo: number }) {
  const [, navigate] = useLocation();

  const { data: history, isLoading } = useQuery<EloPoint[]>({
    queryKey: ["elo-history", userId, sport],
    queryFn: () => customFetch<EloPoint[]>(`${API}/users/${userId}/elo-history?sport=${sport}`),
    enabled: !!sport,
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  const points = history ?? [];

  const last5Set = new Set<number>();
  let cnt = 0;
  for (let i = points.length - 1; i >= 0 && cnt < 5; i--) {
    if (points[i].gameId != null) { last5Set.add(i); cnt++; }
  }

  const renderDot = (props: any) => {
    const { cx, cy, index, payload } = props;
    if (!payload.gameId || !last5Set.has(index)) return <g key={`dot-${index}`} />;
    const color = payload.delta > 0 ? "#22c55e" : payload.delta < 0 ? "#ef4444" : "#94a3b8";
    return (
      <g key={`dot-${index}`} style={{ cursor: "pointer" }} onClick={() => navigate(`/games/${payload.gameId}`)}>
        <circle cx={cx} cy={cy} r={7} fill={color} stroke="hsl(var(--background))" strokeWidth={2} />
        {payload.delta !== 0 && (
          <text x={cx} y={cy - 13} textAnchor="middle" fontSize={9} fill={color} fontWeight="700">
            {payload.delta > 0 ? `+${payload.delta}` : payload.delta}
          </text>
        )}
      </g>
    );
  };

  if (points.length < 2) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        Dar nėra ELO istorijos — žaisk daugiau rungtynių!
      </div>
    );
  }

  const chartData = [...points, { recordedAt: "dabar", elo: currentElo, delta: 0, gameId: null }];

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">ELO raida · spustelėk tašką, kad eitum į žaidimą</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 18, right: 10, left: 10, bottom: 4 }}>
          <XAxis dataKey="recordedAt" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            formatter={(v: number, _: string, props: any) => {
              const d = props.payload?.delta;
              const sign = d > 0 ? "+" : "";
              return [`${v} ELO${d !== 0 ? ` (${sign}${d})` : ""}`, "ELO"];
            }}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <Line type="monotone" dataKey="elo" stroke="#C5E041" strokeWidth={2.5} dot={renderDot} activeDot={{ r: 5, fill: "#C5E041" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function computeOnFireStreak(games: MyGame[]): number {
  const now = new Date();
  const ratedPast = [...games]
    .filter(g => new Date(g.datetime) < now && g.matchType === "rated" && g.myResult !== null)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  let streak = 0;
  for (const g of ratedPast) {
    if (g.myResult === "win") streak++;
    else break;
  }
  return streak;
}

function SportsActivity({ userId, email }: { userId: string; email?: string }) {
  const qc = useQueryClient();
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSport, setAddSport] = useState<string>("");
  const [addLevel, setAddLevel] = useState<string>("beginner");

  const { data, isLoading } = useQuery<UserSportsData>({
    queryKey: ["my-sports-profile", email],
    queryFn: () => customFetch<UserSportsData>(
      `${API}/user-profiles/me/full${email ? `?email=${encodeURIComponent(email)}` : ""}`
    ),
    enabled: !!userId,
  });

  useEffect(() => {
    if (data?.sportProfiles.length && !selectedSport) {
      setSelectedSport(data.sportProfiles[0].sport);
    }
  }, [data, selectedSport]);

  const updateSettings = useMutation({
    mutationFn: (payload: { activityPublic: boolean }) =>
      customFetch(`${API}/user-profiles/me/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-sports-profile"] }),
  });

  const upsertSport = useMutation({
    mutationFn: (payload: { sport: string; level: string }) =>
      customFetch(`${API}/user-profiles/me/sports`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-sports-profile"] });
      setShowAddDialog(false);
      setAddSport("");
      setAddLevel("beginner");
    },
  });

  const removeSport = useMutation({
    mutationFn: (sport: string) =>
      customFetch(`${API}/user-profiles/me/sports/${sport}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-sports-profile"] }),
  });

  const existingSports = data?.sportProfiles.map(sp => sp.sport) ?? [];
  const availableSports = ALL_SPORTS.filter(s => !existingSports.includes(s));
  const currentSportProfile = data?.sportProfiles.find(sp => sp.sport === selectedSport);
  const rating = selectedSport ? data?.ratings?.find(r => r.sport === selectedSport) : null;
  const elo = rating?.elo ?? 1200;
  const tier = getTier(elo);
  const total = rating ? (rating.wins + rating.losses + rating.draws) : 0;
  const pieData = rating && total > 0
    ? [
        { name: "Laimėta", value: rating.wins },
        { name: "Pralaimėta", value: rating.losses },
        ...(rating.draws > 0 ? [{ name: "Lygios", value: rating.draws }] : []),
      ].filter(d => d.value > 0)
    : [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ELO Skill Card */}
      <SkillCard userId={userId} />

      {/* Sport selector — only shown if multiple sports */}
      {existingSports.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {existingSports.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSport(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                selectedSport === s
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <SportIcon sport={s} size={14} strokeWidth={2} />
              {SPORT_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      )}

      {/* ELO + chart panel */}
      {selectedSport ? (
        <div className="bg-card border rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <SportIcon sport={selectedSport} size={26} strokeWidth={1.75} style={{ color: getSportColor(selectedSport) }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{SPORT_LABELS[selectedSport] ?? selectedSport}</span>
                {currentSportProfile && (
                  <Badge className={`text-xs border ${LEVEL_COLOR[currentSportProfile.level] ?? ""}`}>
                    {LEVEL_LABELS[currentSportProfile.level] ?? currentSportProfile.level}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-xs border ${tier.bgCls} ${tier.cls}`}>
                  {tier.emoji} {tier.name}
                </Badge>
                {rating && rating.wins >= 3 && total > 0 && (rating.wins / total) >= 0.6 && (
                  <span className="text-xs text-orange-500 font-semibold flex items-center gap-1 animate-pulse">
                    <Flame className="w-3 h-3" /> On Fire
                  </span>
                )}
              </div>
              <div className="flex items-end gap-3 mt-1">
                <span className="text-3xl font-bold tracking-tight text-primary leading-none">{elo}</span>
                <span className="text-sm text-muted-foreground mb-0.5">ELO</span>
                {rating && total > 0 && (
                  <div className="ml-auto flex items-center gap-1.5 text-xs shrink-0">
                    <span className="font-semibold text-green-600">{rating.wins}W</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-semibold text-red-500">{rating.losses}L</span>
                    {rating.draws > 0 && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-semibold text-slate-500">{rating.draws}D</span>
                      </>
                    )}
                    <span className="text-muted-foreground ml-1">{total}r</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <SportEloSection userId={userId} sport={selectedSport} currentElo={elo} />
        </div>
      ) : existingSports.length === 0 ? (
        <div className="bg-card border rounded-xl shadow-sm p-10 flex flex-col items-center gap-3 text-muted-foreground">
          <Dumbbell className="w-10 h-10 opacity-20" />
          <p className="text-sm">Dar nepridėjote sporto šakų</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4" />
            Pridėti pirmą sportą
          </Button>
        </div>
      ) : null}

      {/* Win / Loss pie chart */}
      {selectedSport && pieData.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Rezultatai</span>
            <span className="text-xs text-muted-foreground">({SPORT_LABELS[selectedSport] ?? selectedSport})</span>
          </div>
          <div className="flex items-center gap-6">
            <PieChart width={120} height={120}>
              <Pie data={pieData} cx={55} cy={55} innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={3}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-semibold">{d.value}</span>
                  <span className="text-muted-foreground">({Math.round((d.value / total) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hours played per sport */}
      {data && data.stats.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Valandos pagal sportą</span>
          </div>
          <div className="space-y-3">
            {data.stats.map(s => {
              const maxH = Math.max(...data.stats.map(x => x.hoursPlayed), 1);
              const pct = Math.round((s.hoursPlayed / maxH) * 100);
              const hasBooking = (s.bookingHours ?? 0) > 0;
              return (
                <div key={s.sport} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <SportPill sport={s.sport} size="sm" />
                      {s.gamesPlayed > 0 && (
                        <span className="text-muted-foreground font-normal">{s.gamesPlayed} žaid.</span>
                      )}
                    </span>
                    <span className="font-semibold flex items-center gap-1">
                      <Timer className="w-3 h-3 text-muted-foreground" />
                      {s.hoursPlayed}h
                      {hasBooking && (
                        <span className="text-muted-foreground font-normal text-[10px]">
                          ({s.gameHours}ž+{s.bookingHours}rez)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visibility toggle */}
      <div className="bg-card border rounded-xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {data?.activityPublic
            ? <Eye className="w-5 h-5 text-primary" />
            : <EyeOff className="w-5 h-5 text-muted-foreground" />}
          <div>
            <p className="font-semibold text-sm">Sporto profilis viešas</p>
            <p className="text-xs text-muted-foreground">
              {data?.activityPublic
                ? "Kiti vartotojai mato jūsų sporto istoriją"
                : "Jūsų sporto istorija slepiama nuo kitų"}
            </p>
          </div>
        </div>
        <Switch
          checked={data?.activityPublic ?? true}
          onCheckedChange={(v) => updateSettings.mutate({ activityPublic: v })}
        />
      </div>

      {/* Sport profiles management */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Mano sportai</span>
            {existingSports.length > 0 && (
              <Badge variant="secondary" className="text-xs">{existingSports.length}</Badge>
            )}
          </div>
          {availableSports.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-3.5 h-3.5" />
              Pridėti sportą
            </Button>
          )}
        </div>
        {existingSports.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-muted-foreground gap-2">
            <Dumbbell className="w-8 h-8 opacity-20" />
            <p className="text-sm">Dar nepridėjote sporto šakų</p>
          </div>
        ) : (
          <div className="divide-y">
            {data!.sportProfiles.map(sp => (
              <div key={sp.sport} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <SportPill sport={sp.sport} size="sm" />
                </div>
                <Select value={sp.level} onValueChange={(v) => upsertSport.mutate({ sport: sp.sport, level: v })}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => (
                      <SelectItem key={l} value={l} className="text-xs">{LEVEL_LABELS[l]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeSport.mutate(sp.sport)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add sport dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pridėti sporto šaką</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Sportas</Label>
              <Select value={addSport} onValueChange={setAddSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkite sportą" />
                </SelectTrigger>
                <SelectContent>
                  {availableSports.map(s => (
                    <SelectItem key={s} value={s}>{SPORT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lygis</Label>
              <Select value={addLevel} onValueChange={setAddLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => (
                    <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Atšaukti</Button>
            <Button
              disabled={!addSport || upsertSport.isPending}
              onClick={() => upsertSport.mutate({ sport: addSport, level: addLevel })}
            >
              Pridėti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MyGame {
  id: number;
  sport: string;
  city: string;
  placeName: string | null;
  datetime: string;
  status: string;
  matchType: string;
  myTeam: string | null;
  myResult: "win" | "loss" | "draw" | null;
  result: { scoreTeamA: number; scoreTeamB: number; status: string } | null;
  participants: { userId: string; userName: string; team: string | null; elo: number }[];
}

function eloTier(elo: number) {
  if (elo >= 1600) return { label: "Diamond", cls: "bg-cyan-500/15 text-cyan-400 border-cyan-400/30" };
  if (elo >= 1400) return { label: "Gold", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-400/30" };
  if (elo >= 1200) return { label: "Silver", cls: "bg-slate-400/15 text-slate-400 border-slate-300/30" };
  return { label: "Bronze", cls: "bg-orange-700/15 text-orange-600 border-orange-500/30" };
}

function GamesHistory({ userId }: { userId: string }) {
  const { data: games, isLoading } = useQuery<MyGame[]>({
    queryKey: ["my-games"],
    queryFn: () => customFetch<MyGame[]>(`${API}/games/my`),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl shadow-sm divide-y">
        {[1, 2, 3].map(i => (
          <div key={i} className="px-5 py-4 flex gap-3 items-center">
            <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className="bg-card border rounded-xl shadow-sm py-16 flex flex-col items-center text-muted-foreground gap-3">
        <Gamepad2 className="w-10 h-10 opacity-20" />
        <p className="text-sm">Dar nėra žaidimų</p>
        <Button size="sm" variant="outline" asChild>
          <Link href="/games">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Rasti žaidimą
          </Link>
        </Button>
      </div>
    );
  }

  const now = new Date();
  const past = games.filter(g => new Date(g.datetime) < now);
  const upcoming = games.filter(g => new Date(g.datetime) >= now);

  const renderGame = (g: MyGame) => {
    const isPast = new Date(g.datetime) < now;
    const isRated = g.matchType === "rated";
    const opponents = g.participants.filter(p => p.userId !== userId && p.team !== g.myTeam);

    const resultBadge = () => {
      if (!isPast) return null;
      if (!g.result) return <Badge variant="secondary" className="text-xs">Rezultatas nepraneštas</Badge>;
      if (g.result.status === "disputed") return <Badge className="text-xs bg-red-500/15 text-red-500 border-red-400/30">Ginčijamas</Badge>;
      if (g.result.status === "pending_verification") return <Badge className="text-xs bg-yellow-500/15 text-yellow-500 border-yellow-400/30">Laukiama patvirtinimo</Badge>;
      if (g.myResult === "win") return <Badge className="text-xs bg-green-500/15 text-green-600 border-green-400/30">✓ Laimėta</Badge>;
      if (g.myResult === "loss") return <Badge className="text-xs bg-red-500/15 text-red-500 border-red-400/30">Pralaimėta</Badge>;
      if (g.myResult === "draw") return <Badge className="text-xs bg-slate-400/15 text-slate-400 border-slate-300/30">Lygios</Badge>;
      return <Badge variant="secondary" className="text-xs">{g.result.scoreTeamA}:{g.result.scoreTeamB}</Badge>;
    };

    return (
      <Link href={`/games/${g.id}`} key={g.id}>
        <div className="px-5 py-4 flex gap-3 items-start hover:bg-muted/30 transition-colors cursor-pointer">
          {/* Sport icon */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)" }}>
            <SportIcon sport={g.sport} className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{SPORT_LABELS[g.sport] ?? g.sport}</span>
              {isRated && (
                <Badge className="text-xs bg-purple-500/15 text-purple-500 border-purple-400/30 gap-1">
                  <Swords className="w-2.5 h-2.5" />
                  Reitinginis
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(g.datetime).toLocaleDateString("lt-LT", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}{new Date(g.datetime).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              {g.placeName ?? g.city}
            </div>
            {/* Opponents */}
            {opponents.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-xs text-muted-foreground">vs.</span>
                {opponents.slice(0, 3).map(p => {
                  const tier = eloTier(p.elo);
                  return (
                    <span key={p.userId} className="flex items-center gap-1">
                      <span className="text-xs font-medium">{p.userName.split(" ")[0]}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${tier.cls}`}>{p.elo}</Badge>
                    </span>
                  );
                })}
                {opponents.length > 3 && <span className="text-xs text-muted-foreground">+{opponents.length - 3}</span>}
              </div>
            )}
            {/* Score */}
            {g.result && g.result.status === "confirmed" && (
              <div className="text-xs font-semibold text-foreground">
                {g.result.scoreTeamA}:{g.result.scoreTeamB}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {resultBadge()}
            {!isPast && (
              <Badge className="text-xs bg-green-500/15 text-green-600 border-green-400/30">Artėjantis</Badge>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/30">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-sm">Artėjantys žaidimai</span>
            <Badge variant="secondary" className="text-xs">{upcoming.length}</Badge>
          </div>
          <div className="divide-y">{upcoming.map(renderGame)}</div>
        </div>
      )}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/30">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Žaidimų istorija</span>
          <Badge variant="secondary" className="text-xs">{past.length}</Badge>
        </div>
        {past.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-muted-foreground gap-2">
            <Gamepad2 className="w-8 h-8 opacity-20" />
            <p className="text-sm">Dar nėra praeities žaidimų</p>
          </div>
        ) : (
          <div className="divide-y">{past.map(renderGame)}</div>
        )}
      </div>
    </div>
  );
}

type Tab = "sports" | "games";

export default function Profile() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const t = useT();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as Tab | null) ?? "sports";
  const VALID_TABS: Tab[] = ["sports", "games"];
  const [cancellingOwnerRequest, setCancellingOwnerRequest] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(
    VALID_TABS.includes(initialTab) ? initialTab : "sports"
  );

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab") as Tab | null;
    setActiveTab(tab && VALID_TABS.includes(tab) ? tab : "sports");
  }, [search]);

  const { role, status, pendingRole, rejectionReason, isAdmin, isOwner: roleIsOwner, isCoach, isPending, isRejected, refresh: refreshRole, isFetching: roleFetching } = useRole();

  const email = user?.emailAddresses[0]?.emailAddress ?? "";
  const userId = user?.id ?? "";

  // Sync Clerk profile picture to DB so DMs and game cards can show it
  useEffect(() => {
    if (!userId || !user?.imageUrl) return;
    customFetch(`${API}/user-profiles/me/image`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: user.imageUrl }),
    }).catch(() => {});
  }, [userId, user?.imageUrl]);
  const displayName = user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Vartotojas";

  const { data: bookings, isLoading: bookingsLoading } = useListBookings(
    { customerEmail: email },
    { query: { queryKey: getListBookingsQueryKey({ customerEmail: email }), enabled: !!email } }
  );

  const { data: ownerCourts, isLoading: courtsLoading } = useListCourts(
    { ownerEmail: email },
    { query: { queryKey: getListCourtsQueryKey({ ownerEmail: email }), enabled: !!email } }
  );

  const { favorites, loading: favoritesLoading, coachFavorites, loadingCoachFav } = useFavoritesContext();

  const today = new Date().toISOString().split("T")[0];
  const localCancelledIds: number[] = (() => {
    try { return JSON.parse(sessionStorage.getItem("cancelledBookingIds") ?? "[]"); } catch { return []; }
  })();
  const upcomingBookings = (bookings ?? []).filter(
    (b) => b.status !== "cancelled" && b.date >= today && !localCancelledIds.includes(b.id)
  );
  const isOwner = roleIsOwner || (ownerCourts?.length ?? 0) > 0;

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      email[0]?.toUpperCase() ||
      "U"
    : "U";

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "sports", label: "Sporto veikla", icon: <Dumbbell className="w-4 h-4" /> },
    { key: "games", label: "Žaidimai", icon: <Gamepad2 className="w-4 h-4" /> },
  ];

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
          {t("profile.notSignedIn")}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8">

        {/* ── Profile hero ── */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <div className="px-6 pb-6 -mt-14 flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar className="w-24 h-24 border-4 border-card ring-2 ring-primary/20 shadow-lg shrink-0">
              <AvatarImage src={user.imageUrl} alt={user.fullName ?? "User"} />
              <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 sm:mb-1">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {user.fullName || t("nav.account")}
              </h1>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              {user.createdAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("profile.memberSince")} {format(new Date(user.createdAt), "MMMM yyyy")}
                </p>
              )}
            </div>
            <div className="flex gap-2 sm:mb-1">
              {isOwner && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/owner">
                    <LayoutDashboard className="w-4 h-4 mr-1.5" />
                    {t("nav.ownerDashboard")}
                  </Link>
                </Button>
              )}
              <Button size="sm" onClick={() => openUserProfile()}>
                <Pencil className="w-4 h-4 mr-1.5" />
                {t("profile.editProfile")}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Owner application progress card ── */}
        {(isPending || isRejected) && pendingRole === "owner" && (
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isRejected ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
            <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${isRejected ? "border-red-500/20 bg-red-500/10" : "border-yellow-500/20 bg-yellow-500/10"}`}>
              <Building2 className={`w-5 h-5 ${isRejected ? "text-red-400" : "text-yellow-400"}`} />
              <h2 className="font-semibold text-sm">Savininko prašymo būsena</h2>
              {isRejected
                ? <Badge className="ml-auto bg-red-500/20 text-red-400 border-red-500/30">Atmesta</Badge>
                : <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Peržiūrima</Badge>
              }
            </div>
            <div className="px-5 py-4 space-y-4">
              {!isRejected && (
                <div className="flex items-start gap-4">
                  {[
                    { label: "Prašymas pateiktas", done: true },
                    { label: "Administratoriaus peržiūra", done: false, active: true },
                    { label: "Patvirtinimas ir prieiga", done: false },
                  ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-colors ${
                        step.done ? "bg-green-500/20 border-green-500 text-green-400"
                        : step.active ? "bg-yellow-500/20 border-yellow-500 text-yellow-400 animate-pulse"
                        : "bg-muted border-muted-foreground/30 text-muted-foreground"
                      }`}>
                        {step.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-xs text-center font-medium ${step.done ? "text-green-400" : step.active ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {isRejected ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Jūsų savininko prašymas buvo atmestas.</p>
                  {rejectionReason && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-sm">
                      <p className="font-medium text-foreground mb-0.5">Atmetimo priežastis:</p>
                      <p className="text-muted-foreground">{rejectionReason}</p>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="mt-1 border-red-500/30 text-red-400 hover:bg-red-500/5" asChild>
                    <Link href="/become-owner">Pateikti naują prašymą</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Administratorius peržiūri jūsų prašymą. Gavę patvirtinimą, galėsite prisijungti prie savininko skydelio ir pridėti aikšteles.
                  </p>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-300"
                      disabled={cancellingOwnerRequest}
                      onClick={async () => {
                        if (!confirm("Ar tikrai norite atšaukti savininko prašymą?")) return;
                        setCancellingOwnerRequest(true);
                        try {
                          await customFetch(`${API}/me/role-request`, { method: "DELETE" });
                          await refreshRole();
                        } catch (e) {
                          alert((e as Error).message || "Nepavyko atšaukti prašymo");
                        } finally {
                          setCancellingOwnerRequest(false);
                        }
                      }}
                    >
                      {cancellingOwnerRequest ? "Atšaukiama…" : "Atšaukti prašymą"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<CalendarDays className="w-5 h-5" />}
            label={t("profile.stat.totalBookings")}
            value={bookingsLoading ? "–" : (bookings?.length ?? 0)}
            onClick={() => setLocation("/bookings")}
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label={t("profile.stat.upcoming")}
            value={bookingsLoading ? "–" : upcomingBookings.length}
            color="text-green-500"
            onClick={() => setLocation("/bookings")}
          />
          <StatCard
            icon={<Heart className="w-5 h-5" />}
            label={t("profile.stat.favorites")}
            value={(favoritesLoading || loadingCoachFav) ? "–" : favorites.length + coachFavorites.length}
            color="text-rose-500"
            onClick={() => setLocation("/favorites")}
          />
          {isOwner ? (
            <StatCard
              icon={<Building2 className="w-5 h-5" />}
              label={t("profile.stat.myCourts")}
              value={courtsLoading ? "–" : (ownerCourts?.length ?? 0)}
              color="text-blue-500"
              onClick={() => setLocation("/owner")}
            />
          ) : (
            <StatCard
              icon={<Gamepad2 className="w-5 h-5" />}
              label="Žaidimai"
              value="–"
              color="text-purple-500"
              onClick={() => setActiveTab("games")}
            />
          )}
        </div>

        {/* ── Role & upgrade section ── */}
        {(() => {
          const ROLE_LABEL: Record<string, string> = {
            admin: "Administratorius",
            owner: "Savininkas",
            coach: "Treneris",
            player: "Žaidėjas",
          };
          const PENDING_ROLE_LABEL: Record<string, string> = {
            coach: "Trenerio",
            owner: "Savininko",
          };
          const currentLabel = ROLE_LABEL[role ?? "player"] ?? role;

          return (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    {isAdmin ? <ShieldCheck className="w-5 h-5 text-primary" /> :
                     isOwner ? <Building2 className="w-5 h-5 text-primary" /> :
                     isCoach ? <Trophy className="w-5 h-5 text-blue-400" /> :
                     <Star className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vaidmuo</p>
                    <p className="font-bold text-foreground">{currentLabel}</p>
                  </div>
                </div>
                {isAdmin && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20">Administratorius</Badge>
                )}
                <button
                  type="button"
                  onClick={() => refreshRole()}
                  disabled={roleFetching}
                  title="Atnaujinti vaidmenį"
                  className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${roleFetching ? "animate-spin" : ""}`} />
                </button>
                {isPending && pendingRole && (
                  isAdmin ? (
                    <Link href="/admin/approvals">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium cursor-pointer hover:bg-yellow-500/20 transition-colors">
                        <Clock className="w-3.5 h-3.5" />
                        {PENDING_ROLE_LABEL[pendingRole] ?? pendingRole} prašymas laukia
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {PENDING_ROLE_LABEL[pendingRole] ?? pendingRole} prašymas laukia
                    </span>
                  )
                )}
                {isRejected && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Prašymas atmestas
                  </span>
                )}
              </div>

              {isRejected && rejectionReason && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Atmetimo priežastis:</p>
                  <p>{rejectionReason}</p>
                </div>
              )}

              {/* Upgrade options for players */}
              {(role === "player" || isRejected) && !isPending && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/5"
                    asChild
                  >
                    <Link href="/become-coach">
                      <Trophy className="w-4 h-4" />
                      Tapti treneriu
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    asChild
                  >
                    <Link href="/become-owner">
                      <Building2 className="w-4 h-4" />
                      Tapti savininku
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              )}

              {/* Coach quick link */}
              {isCoach && (
                <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                  <Link href="/coach/me">
                    <Trophy className="w-4 h-4" />
                    Trenerio skydelis
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          );
        })()}

        {/* ── Tabs ── */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sports Activity tab */}
          {activeTab === "sports" && userId && (
            <SportsActivity userId={userId} email={email} />
          )}

          {/* Games tab */}
          {activeTab === "games" && userId && (
            <GamesHistory userId={userId} />
          )}
        </div>
      </div>
    </Layout>
  );
}
