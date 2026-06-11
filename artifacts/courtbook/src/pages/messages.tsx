import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useUser } from "@clerk/react";
import { getSocket } from "@/lib/socket";
import { SafeShow as Show } from "@/lib/safeAuth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { courtGroupHref } from "@/lib/court-links";
import { customFetch } from "@workspace/api-client-react";
import { UserProfileCard } from "@/components/user-profile-card";
import { Send, MessageSquare, ArrowLeft, Users as UsersIcon, MapPin, Building2, Trophy, CalendarDays, GraduationCap } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Thread {
  otherUserId: string;
  otherUserName: string;
  otherUserImageUrl: string | null;
  lastMessage: { body: string; createdAt: string; senderUserId: string; contextType?: string | null };
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

const CTX_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  game: UsersIcon, court: MapPin, facility: Building2, tournament: Trophy, booking: CalendarDays, coach: GraduationCap,
};

// Role badge shown next to the name in the thread list. Derived from the last
// message's contextType so coaches and court owners are immediately identifiable.
const ROLE_LABEL: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  coach:    { label: "Treneris", Icon: GraduationCap },
  booking:  { label: "Rezervacija", Icon: CalendarDays },
  court:    { label: "Aikštelė", Icon: MapPin },
  facility: { label: "Centras", Icon: Building2 },
  tournament: { label: "Turnyras", Icon: Trophy },
};

function useCtxLabel(ctxType?: string, ctxId?: number) {
  const enabled = !!ctxType && !!ctxId && ctxType !== "coach";
  const { data } = useQuery<any>({
    queryKey: ["msg-ctx", ctxType, ctxId],
    queryFn: () => {
      if (ctxType === "game") return customFetch<any>(`${API}/games/${ctxId}`);
      if (ctxType === "court") return customFetch<any>(`${API}/courts/${ctxId}`);
      if (ctxType === "facility") return customFetch<any>(`${API}/facilities/${ctxId}`);
      if (ctxType === "tournament") return customFetch<any>(`${API}/tournaments/${ctxId}`);
      if (ctxType === "booking") return customFetch<any>(`${API}/bookings/${ctxId}`).catch(() => null);
      return null;
    },
    enabled,
    staleTime: 300_000,
  });
  if (!ctxType) return null;
  const Icon = CTX_ICONS[ctxType] ?? UsersIcon;
  let label = "";
  let href = "";
  if (ctxType === "game") { label = data?.city ? `Žaidimas · ${data.city}` : `Žaidimas #${ctxId}`; href = `/matches/${ctxId}`; }
  else if (ctxType === "court") { label = data?.name ? `Aikštelė · ${data.name}` : `Aikštelė #${ctxId}`; href = courtGroupHref({ id: ctxId!, facilityId: data?.facilityId, type: data?.type }); }
  else if (ctxType === "facility") { label = data?.name ? `Centras · ${data.name}` : `Centras #${ctxId}`; href = `/facilities/${ctxId}`; }
  else if (ctxType === "tournament") { label = data?.name ? `Turnyras · ${data.name}` : `Turnyras #${ctxId}`; href = `/tournaments/${ctxId}`; }
  else if (ctxType === "booking") {
    href = `/bookings/${ctxId}`;
    if (data) {
      const rawDate = String(data.date ?? "").slice(0, 10);
      const dateStr = rawDate ? new Date(rawDate + "T00:00:00").toLocaleDateString("lt-LT", { month: "short", day: "numeric" }) : "";
      const time = data.startTime && data.endTime ? `${data.startTime}–${data.endTime}` : "";
      label = [`Rez. #${ctxId}`, data.courtName, dateStr, time].filter(Boolean).join(" · ");
    } else {
      label = `Rezervacija #${ctxId}`;
    }
  }
  return label ? { label, href, Icon } : null;
}

function MessagesPanel({ otherUserId, otherUserName, otherUserImageUrl, ctxType, ctxId }: {
  otherUserId: string; otherUserName: string; otherUserImageUrl?: string | null;
  ctxType?: string; ctxId?: number;
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
    staleTime: 60_000,
  });

  // Join the DM socket room; leave and remove listener on unmount.
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join_rooms", { dmUserId: otherUserId });

    const onNewMessage = (data: { type: string; message: any }) => {
      if (data.type !== "dm") return;
      const msg = data.message as DM;
      const otherId = msg.senderUserId === user?.id ? msg.recipientUserId : msg.senderUserId;
      if (otherId !== otherUserId) return;
      qc.setQueryData<DM[]>(["dm", otherUserId], (old) => {
        if (!old) return old;
        if (old.some((m) => m.id === msg.id)) return old;
        return [...old, msg];
      });
    };

    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
      socket.emit("leave_rooms", { dmUserId: otherUserId });
    };
  }, [otherUserId, user?.id, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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

  const initials = otherUserName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const latestCtx = messages?.slice().reverse().find(m => m.contextType && m.contextId);
  const effectiveCtxType = latestCtx?.contextType ?? ctxType;
  const effectiveCtxId = latestCtx?.contextId ?? ctxId;
  const ctx = useCtxLabel(effectiveCtxType ?? undefined, effectiveCtxId ?? undefined);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="md:hidden -ml-2" asChild>
          <Link href="/messages"><ArrowLeft className="w-4 h-4"/></Link>
        </Button>
        <button onClick={() => setProfileOpen(true)} className="shrink-0">
          <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer">
            {otherUserImageUrl && <AvatarImage src={otherUserImageUrl} alt={otherUserName} />}
            <AvatarFallback className="bg-primary/15 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => setProfileOpen(true)} className="font-semibold hover:text-primary transition-colors text-left">
              {otherUserName}
            </button>
            {effectiveCtxType && ROLE_LABEL[effectiveCtxType] && (() => {
              const r = ROLE_LABEL[effectiveCtxType!];
              return (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                  <r.Icon className="w-2.5 h-2.5" />{r.label}
                </span>
              );
            })()}
          </div>
          {ctx && (
            <Link href={ctx.href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
              <ctx.Icon className="w-3 h-3"/>{ctx.label}
            </Link>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {ctx && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">{otherUserName} rašo dėl:</p>
            <Link href={ctx.href} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <ctx.Icon className="w-3.5 h-3.5 shrink-0"/>{ctx.label}
            </Link>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3"/><Skeleton className="h-12 w-1/2 ml-auto"/>
          </div>
        ) : (messages ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50"/>
            <p className="text-sm">Parašykite pirmą žinutę.</p>
          </div>
        ) : (
          (messages ?? []).map((m) => {
            const isMine = m.senderUserId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <div className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {timeAgo(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="border-t border-border p-3 flex items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (text.trim() && !send.isPending) send.mutate(); }}
      >
        <Input
          placeholder="Parašykite žinutę..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1"
          autoFocus
        />
        <Button type="submit" size="icon" disabled={!text.trim() || send.isPending}>
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

export default function MessagesPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const activeUserId = params.get("u") ?? "";
  const activeName = params.get("n") ?? "";
  const ctxType = params.get("ctx") ?? undefined;
  const ctxIdRaw = params.get("cid");
  const ctxId = ctxIdRaw ? parseInt(ctxIdRaw, 10) : undefined;

  const { data: threads, isLoading } = useQuery<Thread[]>({
    queryKey: ["dm-threads"],
    queryFn: () => customFetch<Thread[]>(`${API}/dm/threads`),
    enabled: !!user,
    staleTime: 60_000,
  });

  const activeThread = threads?.find(t => t.otherUserId === activeUserId);
  const chosen = activeUserId
    ? {
        id: activeUserId,
        name: activeName || activeThread?.otherUserName || "Vartotojas",
        imageUrl: activeThread?.otherUserImageUrl ?? null,
      }
    : null;

  return (
    <Layout>
      <Show when="signed-out">
        <div className="container mx-auto px-4 py-16 max-w-md text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3"/>
          <h1 className="text-xl font-bold mb-2">Žinutės</h1>
          <p className="text-muted-foreground mb-6">Prisijunkite, kad matytumėte savo pokalbius.</p>
          <Button asChild><Link href="/sign-in">Prisijungti</Link></Button>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-6 max-w-5xl">
          <div className="border border-border rounded-none sm:rounded-2xl overflow-hidden bg-card grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100dvh-64px)] sm:h-[calc(100dvh-120px)]">
            {/* Threads list */}
            <aside className={`border-r border-border flex flex-col min-h-0 ${chosen ? "hidden md:flex" : "flex"}`}>
              <div className="p-4 border-b border-border">
                <h1 className="text-lg font-bold">Žinutės</h1>
              </div>
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16"/>)}
                  </div>
                ) : (threads ?? []).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                    <p className="text-sm">Kol kas nėra pokalbių.</p>
                    <p className="text-xs mt-1">Parašykite žinutę iš žaidimo arba aikštelės puslapio.</p>
                  </div>
                ) : (
                  <div>
                    {(threads ?? []).map((t) => {
                      const ctxKey = t.lastMessage?.contextType ?? undefined;
                      const role = ctxKey ? ROLE_LABEL[ctxKey] : null;
                      return (
                        <button
                          key={t.otherUserId}
                          onClick={() => setLocation(`/messages?u=${t.otherUserId}&n=${encodeURIComponent(t.otherUserName)}`)}
                          className={`w-full text-left p-4 flex gap-3 border-b border-border/60 hover:bg-muted/40 transition-colors ${
                            activeUserId === t.otherUserId ? "bg-muted/50" : ""
                          }`}
                        >
                          <Avatar className="h-11 w-11 shrink-0">
                            {t.otherUserImageUrl && <AvatarImage src={t.otherUserImageUrl} alt={t.otherUserName} />}
                            <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                              {t.otherUserName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="font-semibold truncate">{t.otherUserName}</div>
                                {role && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                                    <role.Icon className="w-2.5 h-2.5" />{role.label}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground shrink-0">{timeAgo(t.lastMessage.createdAt)}</div>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <div className={`text-sm truncate ${t.unread > 0 ? "font-semibold" : "text-muted-foreground"}`}>
                                {t.lastMessage.senderUserId === user?.id ? "Jūs: " : ""}{t.lastMessage.body}
                              </div>
                              {t.unread > 0 && <Badge className="h-5 min-w-5 px-1.5 shrink-0">{t.unread}</Badge>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            {/* Chat panel */}
            <section className={`min-h-0 ${chosen ? "flex" : "hidden md:flex"} flex-col`}>
              {chosen ? (
                <MessagesPanel
                  otherUserId={chosen.id}
                  otherUserName={chosen.name}
                  otherUserImageUrl={chosen.imageUrl}
                  ctxType={ctxType}
                  ctxId={ctxId}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8 text-muted-foreground">
                  <div>
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50"/>
                    <p className="font-medium">Pasirinkite pokalbį kairėje</p>
                    <p className="text-sm mt-1">Arba pradėkite naują iš žaidimo ar aikštelės puslapio.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </Show>
    </Layout>
  );
}
