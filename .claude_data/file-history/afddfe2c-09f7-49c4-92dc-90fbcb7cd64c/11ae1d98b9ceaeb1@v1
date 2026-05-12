import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { SafeShow as Show } from "@/lib/safeAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileCard } from "@/components/user-profile-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { SportIcon, sportColor, SPORT_LABELS } from "@/components/sport-icon";
import { MessageCircle, Send, ArrowLeft, X, MessageSquare, Trophy, MapPin, Users as UsersIcon, Building2, ExternalLink, CalendarDays } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

// --- Sound + browser push helpers ---------------------------------------
let audioCtx: AudioContext | null = null;
function playChime() {
  try {
    if (typeof window === "undefined") return;
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(ctx.destination);
    const notes = [880, 1175];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      osc.connect(gain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  } catch { /* ignore */ }
}

function requestNotificationPermission() {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
  } catch { /* ignore */ }
}

function showBrowserNotification(title: string, body: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;
    const n = new Notification(title, {
      body,
      icon: "/icons/tennis-ball.png",
      tag: "korts-dm",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch { /* ignore */ }
}

interface Thread {
  otherUserId: string;
  otherUserName: string;
  otherUserImageUrl: string | null;
  lastMessage: { body: string; createdAt: string; senderUserId: string };
  unread: number;
}
interface DM {
  id: number;
  senderUserId: string;
  senderName: string;
  recipientUserId: string;
  body: string;
  contextType: string | null;
  contextId: number | null;
  readAt: string | null;
  createdAt: string;
}
interface MyGame {
  id: number;
  sport: string;
  city: string;
  placeName: string | null;
  datetime: string;
  status: string;
  matchType: string;
  playersNeeded: number;
  participants: { userId: string; userName: string }[];
}
interface GameChatMsg {
  id: number;
  gameId: number;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

const sportLabel = (s: string) => SPORT_LABELS[s] ?? s;

function formatGameWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("lt-LT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface OpenChatDetail {
  userId: string;
  userName: string;
  ctxType?: string;
  ctxId?: number;
}

export function openChat(detail: OpenChatDetail) {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>("korts:open-chat", { detail }));
}

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

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

interface CtxInfo { label: string; href?: string; Icon: any; }

function useContextInfo(ctxType?: string, ctxId?: number): CtxInfo | null {
  const enabled = !!ctxType && !!ctxId;
  const { data } = useQuery<any>({
    queryKey: ["chat-ctx", ctxType, ctxId],
    queryFn: async () => {
      if (ctxType === "game") return customFetch<any>(`${API}/games/${ctxId}`);
      if (ctxType === "court") return customFetch<any>(`${API}/courts/${ctxId}`);
      if (ctxType === "facility") return customFetch<any>(`${API}/facilities/${ctxId}`);
      if (ctxType === "tournament") return customFetch<any>(`${API}/tournaments/${ctxId}`);
      return null;
    },
    enabled,
    staleTime: 60_000,
  });
  if (!enabled) return null;
  if (ctxType === "game") {
    const name = data?.sport ? `Žaidimas · ${data.city ?? ""}` : `Žaidimas #${ctxId}`;
    return { label: name, href: `/matches/${ctxId}`, Icon: UsersIcon };
  }
  if (ctxType === "court") {
    return { label: data?.name ? `Aikštelė · ${data.name}` : `Aikštelė #${ctxId}`, href: `/courts/${ctxId}`, Icon: MapPin };
  }
  if (ctxType === "facility") {
    return { label: data?.name ? `Centras · ${data.name}` : `Centras #${ctxId}`, href: `/courts?facility=${ctxId}`, Icon: Building2 };
  }
  if (ctxType === "tournament") {
    return { label: data?.name ? `Turnyras · ${data.name}` : `Turnyras #${ctxId}`, href: `/tournaments/${ctxId}`, Icon: Trophy };
  }
  return null;
}

function ChatThreadView({
  otherUserId, otherUserName, otherUserImageUrl, ctxType, ctxId, onBack,
}: {
  otherUserId: string; otherUserName: string; otherUserImageUrl?: string | null;
  ctxType?: string; ctxId?: number;
  onBack: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: messages, isLoading } = useQuery<DM[]>({
    queryKey: ["dm", otherUserId],
    queryFn: () => customFetch<DM[]>(`${API}/dm/thread/${otherUserId}`),
    refetchInterval: 8000,
  });

  // Prefer the latest message's context; fall back to opener's context
  const latestCtx = messages?.slice().reverse().find(m => m.contextType && m.contextId);
  const effectiveCtxType = latestCtx?.contextType ?? ctxType;
  const effectiveCtxId = latestCtx?.contextId ?? ctxId;
  const ctx = useContextInfo(effectiveCtxType ?? undefined, effectiveCtxId ?? undefined);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    // Opening a thread marks it read on the server (endpoint does this on fetch);
    // refresh unread badge.
    qc.invalidateQueries({ queryKey: ["dm-unread"] });
    qc.invalidateQueries({ queryKey: ["dm-threads"] });
  }, [otherUserId, messages?.length, qc]);

  const send = useMutation({
    mutationFn: () => customFetch(`${API}/dm/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: user?.fullName || user?.firstName || "Vartotojas",
        recipientUserId: otherUserId,
        body: text.trim(),
        contextType: ctxType ?? null,
        contextId: ctxId ?? null,
      }),
    }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["dm", otherUserId] });
      qc.invalidateQueries({ queryKey: ["dm-threads"] });
      qc.invalidateQueries({ queryKey: ["dm-unread"] });
    },
    onError: (e: any) => toast({ title: "Nepavyko siųsti", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border shrink-0">
        <div className="p-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack} aria-label="Atgal">
            <ArrowLeft className="w-4 h-4"/>
          </Button>
          <button onClick={() => setProfileOpen(true)} className="shrink-0">
            <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer">
              {otherUserImageUrl && <AvatarImage src={otherUserImageUrl} alt={otherUserName} />}
              <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
                {initials(otherUserName)}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={() => setProfileOpen(true)} className="font-semibold text-sm truncate block hover:text-primary transition-colors text-left">
              {otherUserName}
            </button>
            <div className="text-[11px] text-muted-foreground">Sporto partneris</div>
          </div>
        </div>
        {ctx && (
          <Link
            href={ctx.href ?? "#"}
            className="block px-3 pb-2 -mt-1"
          >
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/15 transition-colors max-w-full">
              <ctx.Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{ctx.label}</span>
            </div>
          </Link>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3"/>
            <Skeleton className="h-10 w-1/2 ml-auto"/>
          </div>
        ) : (messages ?? []).length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>
            <p className="text-xs">Parašykite pirmą žinutę.</p>
          </div>
        ) : (
          (messages ?? []).map((m) => {
            const isMine = m.senderUserId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <div className={`text-[10px] mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {timeAgo(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="border-t border-border p-2 flex items-center gap-2 shrink-0"
        onSubmit={(e) => { e.preventDefault(); if (text.trim() && !send.isPending) send.mutate(); }}
      >
        <Input
          placeholder="Parašykite žinutę..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 h-9"
          autoFocus
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!text.trim() || send.isPending}>
          <Send className="w-4 h-4"/>
        </Button>
      </form>

      <UserProfileCard
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={otherUserId}
        userName={otherUserName}
        userImageUrl={otherUserImageUrl}
      />
    </div>
  );
}

function GameChatView({
  game, onBack,
}: {
  game: MyGame;
  onBack: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<GameChatMsg[]>({
    queryKey: ["game-chat", game.id],
    queryFn: () => customFetch<GameChatMsg[]>(`${API}/games/${game.id}/chat`),
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = useMutation({
    mutationFn: () => customFetch(`${API}/games/${game.id}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: user?.fullName || user?.firstName || "Vartotojas",
        body: text.trim(),
      }),
    }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["game-chat", game.id] });
    },
    onError: (e: any) => toast({ title: "Nepavyko siųsti", description: e?.message, variant: "destructive" }),
  });

  const sportBg = sportColor[game.sport] ?? "#6b7280";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border shrink-0">
        <div className="p-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack} aria-label="Atgal">
            <ArrowLeft className="w-4 h-4"/>
          </Button>
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white"
            style={{ backgroundColor: sportBg }}
          >
            <SportIcon sport={game.sport} className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">
              {sportLabel(game.sport)} · {game.placeName ?? game.city}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <UsersIcon className="w-3 h-3" />
              {game.participants.length}/{game.playersNeeded} dalyvių
            </div>
          </div>
        </div>
        <Link
          href={`/matches/${game.id}`}
          className="block px-3 pb-2 -mt-1"
        >
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/15 transition-colors max-w-full">
            <CalendarDays className="w-3 h-3 shrink-0" />
            <span className="truncate">{formatGameWhen(game.datetime)}</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
          </div>
        </Link>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3"/>
            <Skeleton className="h-10 w-1/2 ml-auto"/>
          </div>
        ) : (messages ?? []).length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>
            <p className="text-xs">Dar nėra žinučių. Pradėkite pokalbį!</p>
          </div>
        ) : (
          (messages ?? []).map((m) => {
            const isMine = m.senderUserId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  {!isMine && (
                    <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                      {m.senderName}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <div className={`text-[10px] mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {timeAgo(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="border-t border-border p-2 flex items-center gap-2 shrink-0"
        onSubmit={(e) => { e.preventDefault(); if (text.trim() && !send.isPending) send.mutate(); }}
      >
        <Input
          placeholder="Parašykite žinutę grupei..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 h-9"
          autoFocus
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!text.trim() || send.isPending}>
          <Send className="w-4 h-4"/>
        </Button>
      </form>
    </div>
  );
}

function GameThreadsList({
  games, isLoading, onPick,
}: {
  games: MyGame[] | undefined;
  isLoading: boolean;
  onPick: (g: MyGame) => void;
}) {
  const upcoming = [...(games ?? [])]
    .filter(g => g.status !== "cancelled" && g.status !== "completed")
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  return (
    <div className="flex-1 overflow-y-auto">
      {isLoading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14"/>)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-50"/>
          <p className="text-sm font-medium">Nėra aktyvių žaidimų</p>
          <p className="text-xs mt-1">Prisijunkite prie žaidimo, kad galėtumėte rašyti grupei.</p>
        </div>
      ) : (
        <div>
          {upcoming.map((g) => {
            const sportBg = sportColor[g.sport] ?? "#6b7280";
            return (
              <button
                key={g.id}
                onClick={() => onPick(g)}
                className="w-full text-left p-3 flex gap-3 border-b border-border/60 hover:bg-muted/40 transition-colors"
              >
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: sportBg }}
                >
                  <SportIcon sport={g.sport} className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">
                      {sportLabel(g.sport)} · {g.placeName ?? g.city}
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {g.participants.length}/{g.playersNeeded}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground truncate">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    <span className="truncate">{formatGameWhen(g.datetime)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatThreadsList({
  threads, isLoading, currentUserId, onPick,
}: {
  threads: Thread[] | undefined;
  isLoading: boolean;
  currentUserId?: string;
  onPick: (t: Thread) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {isLoading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14"/>)}
        </div>
      ) : !threads || threads.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50"/>
          <p className="text-sm font-medium">Kol kas nėra pokalbių</p>
          <p className="text-xs mt-1">Parašykite žinutę iš žaidimo arba aikštelės puslapio.</p>
        </div>
      ) : (
        <div>
          {threads.map((t) => (
            <button
              key={t.otherUserId}
              onClick={() => onPick(t)}
              className="w-full text-left p-3 flex gap-3 border-b border-border/60 hover:bg-muted/40 transition-colors"
            >
              <Avatar className="h-10 w-10 shrink-0">
                {t.otherUserImageUrl && <AvatarImage src={t.otherUserImageUrl} alt={t.otherUserName} />}
                <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
                  {initials(t.otherUserName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm truncate">{t.otherUserName}</div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{timeAgo(t.lastMessage.createdAt)}</div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className={`text-xs truncate ${t.unread > 0 ? "font-semibold" : "text-muted-foreground"}`}>
                    {t.lastMessage.senderUserId === currentUserId ? "Jūs: " : ""}{t.lastMessage.body}
                  </div>
                  {t.unread > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 shrink-0 bg-red-500 hover:bg-red-500 text-white">
                      {t.unread}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatBubbleInner() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"people" | "games">("people");
  const [active, setActive] = useState<{ userId: string; userName: string; imageUrl?: string | null; ctxType?: string; ctxId?: number } | null>(null);
  const [activeGame, setActiveGame] = useState<MyGame | null>(null);

  const { data: threads, isLoading: threadsLoading } = useQuery<Thread[]>({
    queryKey: ["dm-threads"],
    queryFn: () => customFetch<Thread[]>(`${API}/dm/threads`),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: myGames, isLoading: gamesLoading } = useQuery<MyGame[]>({
    queryKey: ["my-games-chat"],
    queryFn: () => customFetch<MyGame[]>(`${API}/games/my`),
    enabled: !!user && open,
    refetchInterval: 30000,
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["dm-unread"],
    queryFn: () => customFetch<{ count: number }>(`${API}/dm/unread-count`),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const unreadCount = unread?.count ?? 0;

  // Detect increases in unread count → play chime + browser notification
  const prevUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev !== null && unreadCount > prev) {
      playChime();
      // Pick latest unread thread for preview text
      const latest = threads?.find(t => t.unread > 0);
      if (latest) {
        showBrowserNotification(
          `${latest.otherUserName} · Nauja žinutė`,
          latest.lastMessage.body.slice(0, 140),
        );
      } else {
        showBrowserNotification("Nauja žinutė", "Atidarykite korts.lt, kad atsakytumėte.");
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, threads]);

  // Ask for notification permission the first time the user opens the bubble
  const askedPermRef = useRef(false);
  useEffect(() => {
    if (open && !askedPermRef.current) {
      askedPermRef.current = true;
      requestNotificationPermission();
    }
  }, [open]);

  // Listen for global "open chat" events dispatched from other pages
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<OpenChatDetail>;
      if (!ev.detail?.userId) return;
      setActive({
        userId: ev.detail.userId,
        userName: ev.detail.userName,
        ctxType: ev.detail.ctxType,
        ctxId: ev.detail.ctxId,
      });
      setOpen(true);
    };
    window.addEventListener("korts:open-chat", handler);
    return () => window.removeEventListener("korts:open-chat", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (active) setActive(null);
        else if (activeGame) setActiveGame(null);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, active, activeGame]);

  const toggle = useCallback(() => {
    setOpen(v => {
      if (v) {
        setActive(null);
        setActiveGame(null);
      }
      return !v;
    });
  }, []);

  return (
    <>
      {/* Sticky bubble button */}
      <button
        onClick={toggle}
        aria-label={open ? "Uždaryti žinutes" : "Atidaryti žinutes"}
        className="fixed bottom-[5.5rem] right-4 sm:bottom-6 sm:right-6 z-[60] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {open ? <X className="w-6 h-6"/> : <MessageCircle className="w-6 h-6"/>}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-[59] bg-card border border-border shadow-2xl overflow-hidden flex flex-col
            bottom-0 right-0 left-0 top-0 rounded-none
            sm:bottom-24 sm:right-6 sm:left-auto sm:top-auto sm:rounded-2xl sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100dvh-8rem)]"
          role="dialog"
          aria-label="Žinutės"
        >
          <div className="border-b border-border p-3 flex items-center justify-between shrink-0 bg-primary/5">
            {active || activeGame ? (
              <div className="flex items-center gap-2 min-w-0">
                <MessageCircle className="w-4 h-4 text-primary shrink-0"/>
                <span className="font-semibold text-sm truncate">Pokalbis</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary"/>
                <span className="font-semibold text-sm">Žinutės</span>
                {unreadCount > 0 && (
                  <Badge className="h-5 min-w-5 px-1.5 bg-red-500 hover:bg-red-500 text-white">{unreadCount}</Badge>
                )}
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Uždaryti">
              <X className="w-4 h-4"/>
            </Button>
          </div>

          {active ? (
            <ChatThreadView
              otherUserId={active.userId}
              otherUserName={active.userName}
              otherUserImageUrl={active.imageUrl}
              ctxType={active.ctxType}
              ctxId={active.ctxId}
              onBack={() => setActive(null)}
            />
          ) : activeGame ? (
            <GameChatView
              game={activeGame}
              onBack={() => setActiveGame(null)}
            />
          ) : (
            <>
              <div className="border-b border-border flex shrink-0 bg-card">
                <button
                  onClick={() => setTab("people")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    tab === "people"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5"/> Žmonės
                  {unreadCount > 0 && (
                    <Badge className="h-4 min-w-4 px-1 ml-0.5 bg-red-500 hover:bg-red-500 text-white text-[10px]">{unreadCount}</Badge>
                  )}
                </button>
                <button
                  onClick={() => setTab("games")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    tab === "games"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                  }`}
                >
                  <UsersIcon className="w-3.5 h-3.5"/> Žaidimai
                </button>
              </div>
              {tab === "people" ? (
                <ChatThreadsList
                  threads={threads}
                  isLoading={threadsLoading}
                  currentUserId={user?.id}
                  onPick={(t) => setActive({ userId: t.otherUserId, userName: t.otherUserName, imageUrl: t.otherUserImageUrl })}
                />
              ) : (
                <GameThreadsList
                  games={myGames}
                  isLoading={gamesLoading}
                  onPick={(g) => setActiveGame(g)}
                />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

export function ChatBubble() {
  return (
    <Show when="signed-in">
      <ChatBubbleInner />
    </Show>
  );
}
