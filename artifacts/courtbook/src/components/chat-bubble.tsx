import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, Show } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { MessageCircle, Send, ArrowLeft, X, MessageSquare } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Thread {
  otherUserId: string;
  otherUserName: string;
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

function ChatThreadView({
  otherUserId, otherUserName, ctxType, ctxId, onBack,
}: {
  otherUserId: string; otherUserName: string;
  ctxType?: string; ctxId?: number;
  onBack: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<DM[]>({
    queryKey: ["dm", otherUserId],
    queryFn: () => customFetch<DM[]>(`${API}/dm/thread/${otherUserId}`),
    refetchInterval: 8000,
  });

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
      <div className="border-b border-border p-3 flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack} aria-label="Atgal">
          <ArrowLeft className="w-4 h-4"/>
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
            {initials(otherUserName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{otherUserName}</div>
          {ctxType === "game" && ctxId && (
            <Link href={`/games/${ctxId}`} className="text-[11px] text-primary hover:underline">
              Apie žaidimą #{ctxId}
            </Link>
          )}
        </div>
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
          <p className="text-xs mt-1">Parašykite žinutę iš žaidimo arba korto puslapio.</p>
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
  const [active, setActive] = useState<{ userId: string; userName: string; ctxType?: string; ctxId?: number } | null>(null);

  const { data: threads, isLoading: threadsLoading } = useQuery<Thread[]>({
    queryKey: ["dm-threads"],
    queryFn: () => customFetch<Thread[]>(`${API}/dm/threads`),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["dm-unread"],
    queryFn: () => customFetch<{ count: number }>(`${API}/dm/unread-count`),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const unreadCount = unread?.count ?? 0;

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
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, active]);

  const toggle = useCallback(() => {
    setOpen(v => {
      if (v) setActive(null);
      return !v;
    });
  }, []);

  return (
    <>
      {/* Sticky bubble button */}
      <button
        onClick={toggle}
        aria-label={open ? "Uždaryti žinutes" : "Atidaryti žinutes"}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
            {active ? (
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
              ctxType={active.ctxType}
              ctxId={active.ctxId}
              onBack={() => setActive(null)}
            />
          ) : (
            <ChatThreadsList
              threads={threads}
              isLoading={threadsLoading}
              currentUserId={user?.id}
              onPick={(t) => setActive({ userId: t.otherUserId, userName: t.otherUserName })}
            />
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
