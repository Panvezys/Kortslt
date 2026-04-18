import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useUser, useClerk } from "@clerk/react";
import { useListBookings, useListCourts } from "@workspace/api-client-react";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Link, useSearch } from "wouter";
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
  Send,
  ArrowLeft,
  ChevronRight,
  Trophy,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Dumbbell,
} from "lucide-react";

interface CoachFav {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  sports: string[];
  pricePerHour: number | null;
  bio: string | null;
}

const SPORT_COLOR_COACH: Record<string, string> = {
  tennis: "#84cc16", basketball: "#f97316", padel: "#3b82f6",
  football: "#22c55e", badminton: "#a855f7", squash: "#06b6d4",
};

function useCoachFavorites(userId: string | null) {
  const [favorites, setFavorites] = useState<CoachFav[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const API = `${BASE}/api`;

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/favorites/coaches?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: CoachFav[] = await res.json();
      setFavorites(data);
      setFavoriteIds(new Set(data.map(c => c.id)));
    } finally {
      setLoading(false);
    }
  }, [userId, API]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const toggleFavorite = useCallback(async (coachId: number) => {
    if (!userId) return;
    if (favoriteIds.has(coachId)) {
      setFavoriteIds(prev => { const n = new Set(prev); n.delete(coachId); return n; });
      setFavorites(prev => prev.filter(c => c.id !== coachId));
      await fetch(`${API}/favorites/coaches/${coachId}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    } else {
      await fetch(`${API}/favorites/coaches/${coachId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      await fetchFavorites();
    }
  }, [userId, favoriteIds, fetchFavorites, API]);

  return { favorites, favoriteIds, loading, toggleFavorite, isFavorite: (id: number) => favoriteIds.has(id) };
}

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

interface Thread {
  courtId: number;
  courtName: string;
  lastMessage: {
    body: string;
    senderUserId: string;
    senderName: string;
    createdAt: string;
  };
}

interface Msg {
  id: number;
  courtId: number;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

function ChatPane({
  thread,
  userId,
  userName,
  userEmail,
  onBack,
}: {
  thread: Thread;
  userId: string;
  userName: string;
  userEmail: string;
  onBack: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/courts/${thread.courtId}/messages?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(data => { setMsgs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [thread.courtId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/courts/${thread.courtId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderUserId: userId, senderName: userName, senderEmail: userEmail, body: text }),
      });
      const msg = await r.json();
      setMsgs(prev => [...prev, msg]);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">{thread.courtName}</p>
          <p className="text-xs text-muted-foreground">Aikštelės žinutės</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-10 w-48 rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p>Dar nėra žinučių. Parašykite pirmą!</p>
          </div>
        ) : (
          msgs.map(msg => {
            const isMine = msg.senderUserId === userId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isMine && (
                    <span className="text-xs text-muted-foreground px-1">{msg.senderName}</span>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.body}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {format(parseISO(msg.createdAt), "HH:mm · dd MMM")}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-card px-4 py-3 flex gap-2 items-end shrink-0">
        <Textarea
          placeholder="Rašykite žinutę..."
          className="resize-none min-h-[40px] max-h-[120px] text-sm"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
        />
        <Button size="icon" onClick={send} disabled={sending || !text.trim()} className="shrink-0 h-10 w-10">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function MessagesInbox({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  useEffect(() => {
    fetch(`${API}/messages/inbox?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(data => { setThreads(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden" style={{ height: 520 }}>
      <div className="grid h-full" style={{ gridTemplateColumns: selectedThread ? "0 1fr" : "1fr", transition: "grid-template-columns 0.2s" }}>
        {/* Thread list — hidden on mobile when chat open */}
        <div className={`border-r flex flex-col min-w-0 ${selectedThread ? "hidden md:flex md:col-span-1" : "flex"}`} style={{ gridColumn: selectedThread ? "1" : "1" }}>
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-sm">Pokalbiai</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 items-center">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground text-sm gap-2">
                <MessageSquare className="w-10 h-10 opacity-20" />
                <p>Dar nėra pokalbių.</p>
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link href="/courts">Naršyti aikšteles</Link>
                </Button>
              </div>
            ) : (
              threads.map(t => (
                <button
                  key={t.courtId}
                  onClick={() => setSelectedThread(t)}
                  className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-muted/40 transition-colors ${selectedThread?.courtId === t.courtId ? "bg-muted/60" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{t.courtName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.lastMessage.senderUserId === userId ? "Jūs: " : ""}{t.lastMessage.body}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(parseISO(t.lastMessage.createdAt), "dd MMM")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat pane */}
        {selectedThread ? (
          <div className="flex flex-col min-w-0 h-full">
            <ChatPane
              thread={selectedThread}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
              onBack={() => setSelectedThread(null)}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-12 h-12 opacity-15" />
            <p>Pasirinkite pokalbį</p>
          </div>
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

type Tab = "bookings" | "favorites" | "courts" | "messages";
type FavSubTab = "courts" | "coaches";

export default function Profile() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const t = useT();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as Tab | null) ?? "favorites";
  const [activeTab, setActiveTab] = useState<Tab>(
    ["bookings", "favorites", "courts", "messages"].includes(initialTab) ? initialTab : "favorites"
  );
  const [favSubTab, setFavSubTab] = useState<FavSubTab>("courts");
  const { isOwner: roleIsOwner } = useRole();

  const email = user?.emailAddresses[0]?.emailAddress ?? "";
  const userId = user?.id ?? "";
  const displayName = user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Vartotojas";

  const { data: bookings, isLoading: bookingsLoading } = useListBookings(
    { customerEmail: email },
    { query: { enabled: !!email } }
  );

  const { data: ownerCourts, isLoading: courtsLoading } = useListCourts(
    { ownerEmail: email },
    { query: { enabled: !!email } }
  );

  const { favorites, loading: favoritesLoading } = useFavoritesContext();
  const { favorites: coachFavorites, loading: coachFavLoading } = useCoachFavorites(userId || null);

  const isOwner = roleIsOwner || (ownerCourts?.length ?? 0) > 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "favorites", label: t("profile.tab.favorites"), icon: <Heart className="w-4 h-4" /> },
    { key: "bookings", label: t("profile.tab.bookings"), icon: <CalendarDays className="w-4 h-4" /> },
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
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">

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

          {/* Favorites tab */}
          {activeTab === "favorites" && (
            <div className="space-y-5">
              {/* Sub-tabs */}
              <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
                <button
                  onClick={() => setFavSubTab("courts")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    favSubTab === "courts"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Aikštelės
                  <span className="text-xs opacity-60">({favorites.length})</span>
                </button>
                <button
                  onClick={() => setFavSubTab("coaches")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    favSubTab === "coaches"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Dumbbell className="w-4 h-4" />
                  Treneriai
                  <span className="text-xs opacity-60">({coachFavorites.length})</span>
                </button>
              </div>

              {/* Courts sub-tab */}
              {favSubTab === "courts" && (
                <>
                  {favoritesLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
                    </div>
                  ) : favorites.length === 0 ? (
                    <div className="bg-card border rounded-xl py-16 text-center text-muted-foreground text-sm shadow-sm">
                      <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>{t("profile.noFavorites")}</p>
                      <Button variant="outline" size="sm" className="mt-4" asChild>
                        <Link href="/courts">{t("bookings.browseCourts")}</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {favorites.map((court) => {
                        const color = SPORT_COLOR[court.type] ?? "#84cc16";
                        return (
                          <Link key={court.id} href={`/courts/${court.id}`}>
                            <div className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                              <div
                                className="h-28 bg-muted relative overflow-hidden"
                                style={court.imageUrl ? { backgroundImage: `url(${court.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
                              >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                <div className="absolute top-2.5 left-2.5">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: color }}>
                                    <SportIcon sport={court.type} size={14} strokeWidth={2} className="text-white" />
                                  </div>
                                </div>
                                {court.rating && (
                                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    {court.rating.toFixed(1)}
                                  </div>
                                )}
                              </div>
                              <div className="p-3.5">
                                <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{court.name}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 shrink-0" />{court.city}
                                </p>
                                <div className="flex items-center justify-between mt-2.5">
                                  <span className="text-sm font-bold" style={{ color }}>
                                    {court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">/val</span>
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {court.isIndoor ? t("card.indoor") : t("card.outdoor")}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Coaches sub-tab */}
              {favSubTab === "coaches" && (
                <>
                  {coachFavLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
                    </div>
                  ) : coachFavorites.length === 0 ? (
                    <div className="bg-card border rounded-xl py-16 text-center text-muted-foreground text-sm shadow-sm">
                      <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>Nėra mėgstamų trenerių</p>
                      <Button variant="outline" size="sm" className="mt-4" asChild>
                        <Link href="/coaches">Naršyti trenerius</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {coachFavorites.map((coach) => {
                        const primarySport = coach.sports[0];
                        const color = primarySport ? (SPORT_COLOR_COACH[primarySport] ?? "#84cc16") : "#84cc16";
                        return (
                          <Link key={coach.id} href={`/coaches/${coach.id}`}>
                            <div className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                              <div
                                className="h-28 bg-muted relative overflow-hidden"
                                style={coach.photoUrl ? { backgroundImage: `url(${coach.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center top" } : {}}
                              >
                                {!coach.photoUrl && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Dumbbell className="w-10 h-10 text-muted-foreground/30" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                              </div>
                              <div className="p-3.5">
                                <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{coach.name}</p>
                                {coach.sports.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {coach.sports.slice(0, 2).map(s => (
                                      <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>
                                    ))}
                                  </div>
                                )}
                                {coach.pricePerHour != null && (
                                  <p className="text-sm font-bold mt-2" style={{ color }}>
                                    {coach.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">/val</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Messages tab */}
          {activeTab === "messages" && userId && (
            <MessagesInbox userId={userId} userName={displayName} userEmail={email} />
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
