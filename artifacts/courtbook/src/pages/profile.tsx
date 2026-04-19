import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useUser, useClerk } from "@clerk/react";
import { useListBookings, useListCourts, customFetch } from "@workspace/api-client-react";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
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
import { SportIcon } from "@/components/sport-icon";
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
  GraduationCap,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Dumbbell,
  Gamepad2,
  Timer,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_COLOR: Record<string, string> = {
  tennis: "#84cc16",
  basketball: "#f97316",
  padel: "#3b82f6",
  football: "#22c55e",
  badminton: "#a855f7",
  squash: "#06b6d4",
};

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
}

interface UserSportsData {
  activityPublic: boolean;
  bio: string | null;
  sportProfiles: SportProfile[];
  stats: SportStat[];
}

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};
const ALL_SPORTS = Object.keys(SPORT_LABELS);

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

function SportsActivity({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSport, setAddSport] = useState<string>("");
  const [addLevel, setAddLevel] = useState<string>("beginner");

  const { data, isLoading } = useQuery<UserSportsData>({
    queryKey: ["my-sports-profile"],
    queryFn: () => customFetch<UserSportsData>(`${API}/user-profiles/me/full`),
    enabled: !!userId,
  });

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

  const getStats = (sport: string) => data?.stats.find(s => s.sport === sport);

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl shadow-sm p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Sport cards */}
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
          <div className="py-14 flex flex-col items-center text-muted-foreground gap-3">
            <Dumbbell className="w-10 h-10 opacity-20" />
            <p className="text-sm">Dar nepridėjote sporto šakų</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4" />
              Pridėti pirmą sportą
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {data!.sportProfiles.map(sp => {
              const stats = getStats(sp.sport);
              return (
                <div key={sp.sport} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <SportIcon sport={sp.sport} className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{SPORT_LABELS[sp.sport] ?? sp.sport}</span>
                      <Badge className={`text-xs border ${LEVEL_COLOR[sp.level] ?? ""}`}>
                        {LEVEL_LABELS[sp.level] ?? sp.level}
                      </Badge>
                    </div>
                    {stats && (
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Gamepad2 className="w-3 h-3" />
                          {stats.gamesPlayed} žaidimai
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {stats.hoursPlayed}h
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={sp.level}
                      onValueChange={(v) => upsertSport.mutate({ sport: sp.sport, level: v })}
                    >
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
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSport.mutate(sp.sport)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
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

type Tab = "bookings" | "courts" | "messages" | "sports";

export default function Profile() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const t = useT();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as Tab | null) ?? "bookings";
  const VALID_TABS: Tab[] = ["bookings", "courts", "messages", "sports"];
  const [activeTab, setActiveTab] = useState<Tab>(
    VALID_TABS.includes(initialTab) ? initialTab : "bookings"
  );

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab") as Tab | null;
    setActiveTab(tab && VALID_TABS.includes(tab) ? tab : "bookings");
  }, [search]);

  const { role, status, pendingRole, rejectionReason, isAdmin, isOwner: roleIsOwner, isCoach, isPending, isRejected } = useRole();

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
    { query: { enabled: !!email } }
  );

  const { data: ownerCourts, isLoading: courtsLoading } = useListCourts(
    { ownerEmail: email },
    { query: { enabled: !!email } }
  );

  const { favorites, loading: favoritesLoading, coachFavorites, loadingCoachFav } = useFavoritesContext();

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = (bookings ?? []).filter(
    (b) => b.status !== "cancelled" && b.date >= today
  );
  const isOwner = roleIsOwner || (ownerCourts?.length ?? 0) > 0;

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      email[0]?.toUpperCase() ||
      "U"
    : "U";

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "bookings", label: t("profile.tab.bookings"), icon: <CalendarDays className="w-4 h-4" /> },
    { key: "sports", label: "Sporto veikla", icon: <Dumbbell className="w-4 h-4" /> },
    { key: "messages", label: "Žinutės", icon: <MessageSquare className="w-4 h-4" /> },
    ...(isOwner
      ? [{ key: "courts" as Tab, label: t("profile.tab.myCourts"), icon: <LayoutDashboard className="w-4 h-4" /> }]
      : []),
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

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<CalendarDays className="w-5 h-5" />}
            label={t("profile.stat.totalBookings")}
            value={bookingsLoading ? "–" : (bookings?.length ?? 0)}
            onClick={() => setActiveTab("bookings")}
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label={t("profile.stat.upcoming")}
            value={bookingsLoading ? "–" : upcomingBookings.length}
            color="text-green-500"
            onClick={() => setActiveTab("bookings")}
          />
          <StatCard
            icon={<Heart className="w-5 h-5" />}
            label={t("profile.stat.favorites")}
            value={(favoritesLoading || loadingCoachFav) ? "–" : favorites.length + coachFavorites.length}
            color="text-rose-500"
            onClick={() => setLocation("/favorites")}
          />
          {isOwner && (
            <StatCard
              icon={<Building2 className="w-5 h-5" />}
              label={t("profile.stat.myCourts")}
              value={courtsLoading ? "–" : (ownerCourts?.length ?? 0)}
              color="text-blue-500"
              onClick={() => setActiveTab("courts")}
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
                {isPending && pendingRole && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {PENDING_ROLE_LABEL[pendingRole] ?? pendingRole} prašymas laukia
                  </span>
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

          {/* Bookings tab */}
          {activeTab === "bookings" && (
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
              {bookingsLoading ? (
                <div className="divide-y">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 flex gap-4 items-center">
                      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : !bookings || bookings.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{t("profile.noBookings")}</p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href="/courts">{t("bookings.browseCourts")}</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {bookings.map((booking) => {
                    return (
                      <div
                        key={booking.id}
                        className="px-5 py-4 flex gap-4 items-center hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          #{booking.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/courts/${booking.courtId}`}
                            className="font-medium hover:text-primary hover:underline truncate block"
                          >
                            {booking.courtName || `Aikštelė #${booking.courtId}`}
                          </Link>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <CalendarDays className="w-3 h-3 shrink-0" />
                            {format(parseISO(String(booking.date).split("T")[0]), "yyyy-MM-dd")}
                            <span className="text-muted-foreground/50">·</span>
                            {booking.startTime} – {booking.endTime}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-muted-foreground hidden sm:block">
                            {booking.totalPrice}€
                          </span>
                          <StatusBadge status={booking.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sports Activity tab */}
          {activeTab === "sports" && userId && (
            <SportsActivity userId={userId} />
          )}

          {/* Messages tab */}
          {activeTab === "messages" && userId && (
            <DMInbox userId={userId} />
          )}

          {/* My Courts tab (owner only) */}
          {activeTab === "courts" && isOwner && (
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
              {courtsLoading ? (
                <div className="divide-y">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 flex gap-4 items-center">
                      <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="divide-y">
                    {(ownerCourts ?? []).map((court) => {
                      const color = SPORT_COLOR[court.type] ?? "#84cc16";
                      return (
                        <div
                          key={court.id}
                          className="px-5 py-4 flex gap-4 items-center hover:bg-muted/30 transition-colors"
                        >
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${color}20`, border: `1.5px solid ${color}40` }}
                          >
                            <SportIcon sport={court.type} size={22} strokeWidth={1.8} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/courts/${court.id}`}
                              className="font-medium hover:text-primary hover:underline truncate block"
                            >
                              {court.name}
                            </Link>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {court.address}, {court.city}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-semibold">{court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">/val</span></p>
                              {court.rating && (
                                <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  {court.rating.toFixed(1)}
                                </p>
                              )}
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <Link href="/owner">{t("owner.editCourt")}</Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-5 py-3 border-t bg-muted/20 flex justify-end">
                    <Button size="sm" asChild>
                      <Link href="/owner">
                        <LayoutDashboard className="w-4 h-4 mr-1.5" />
                        {t("nav.ownerDashboard")}
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
