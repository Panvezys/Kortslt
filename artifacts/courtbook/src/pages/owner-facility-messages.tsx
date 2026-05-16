import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "wouter";
import { useUser } from "@clerk/react";
import { format, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

interface FacilityData {
  id: number;
  name: string;
  ownerUserId?: string;
}

interface CourtSummary {
  id: number;
  facilityId?: number | null;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

interface LatestBooking {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface OwnerThread {
  courtId: number;
  courtName: string;
  threadUserId: string;
  threadUserName: string;
  threadUserImageUrl: string | null;
  latestBooking: LatestBooking | null;
  lastMessage: { body: string; senderUserId: string; createdAt: string };
}

interface OwnerMsg {
  id: number;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

function threadKey(t: OwnerThread) {
  return `${t.courtId}__${t.threadUserId}`;
}

function messagesQueryKey(courtId: number, threadUserId: string) {
  return ["owner-court-messages", courtId, threadUserId] as const;
}

function ThreadList({
  threads,
  selectedKey,
  loading,
  onSelect,
}: {
  threads: OwnerThread[];
  selectedKey: string | null;
  loading: boolean;
  onSelect: (t: OwnerThread) => void;
}) {
  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-6 text-center">
        <MessageSquare className="w-10 h-10 opacity-20" />
        <p className="font-medium">Dar nėra žinučių.</p>
        <p className="text-xs">
          Kai klientai parašys apie šio objekto aikšteles, pokalbiai atsiras čia.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {threads.map((t) => {
        const key = threadKey(t);
        const active = key === selectedKey;
        const last = t.lastMessage;
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={`w-full text-left px-4 py-3 transition-colors flex gap-3 ${
                active ? "bg-primary/10" : "hover:bg-muted/60"
              }`}
            >
              <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                {t.threadUserImageUrl && <AvatarImage src={t.threadUserImageUrl} alt={t.threadUserName} />}
                <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
                  {t.threadUserName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="font-semibold text-sm truncate">{t.threadUserName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(parseISO(last.createdAt), "HH:mm · dd MMM")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate mb-0.5">{t.courtName}</div>
                {t.latestBooking && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal gap-1 border-primary/30 text-primary">
                      <Calendar className="w-2.5 h-2.5" />
                      {t.latestBooking.date} · {t.latestBooking.startTime}–{t.latestBooking.endTime}
                    </Badge>
                  </div>
                )}
                <div className="text-xs text-foreground/80 truncate">{last.body}</div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OwnerChatPane({
  thread,
  ownerUserId,
  ownerName,
  ownerEmail,
  onBack,
}: {
  thread: OwnerThread;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const queryKey = messagesQueryKey(thread.courtId, thread.threadUserId);

  const { data: msgs = [], isLoading } = useQuery<OwnerMsg[]>({
    queryKey,
    queryFn: () =>
      customFetch<OwnerMsg[]>(
        `${API_URL}/courts/${thread.courtId}/messages?userId=${encodeURIComponent(thread.threadUserId)}`,
      ),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      customFetch<OwnerMsg>(`${API_URL}/courts/${thread.courtId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUserId: ownerUserId,
          senderName: ownerName,
          senderEmail: ownerEmail,
          body,
          threadUserId: thread.threadUserId,
        }),
      }),
    onSuccess: (msg) => {
      queryClient.setQueryData<OwnerMsg[]>(queryKey, (prev) =>
        prev ? [...prev, msg] : [msg],
      );
      queryClient.invalidateQueries({ queryKey: ["owner-inbox"] });
      setText("");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = () => {
    const body = text.trim();
    if (!body || sendMutation.isPending) return;
    sendMutation.mutate(body);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button
          onClick={onBack}
          className="md:hidden text-muted-foreground hover:text-foreground mt-0.5"
          aria-label="Atgal"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar className="h-10 w-10 shrink-0">
          {thread.threadUserImageUrl && <AvatarImage src={thread.threadUserImageUrl} alt={thread.threadUserName} />}
          <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
            {thread.threadUserName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight truncate">{thread.threadUserName}</p>
          <p className="text-xs text-muted-foreground truncate">{thread.courtName}</p>
          {thread.latestBooking && (
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal gap-1 border-primary/30 text-primary">
                <Calendar className="w-2.5 h-2.5" />
                Rez. #{thread.latestBooking.id} · {thread.latestBooking.date} {thread.latestBooking.startTime}–{thread.latestBooking.endTime}
              </Badge>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <Skeleton className="h-10 w-44 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p>Dar nėra žinučių šiame pokalbyje.</p>
          </div>
        ) : (
          msgs.map((msg) => {
            const isMine = msg.senderUserId === ownerUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] flex flex-col gap-0.5 ${
                    isMine ? "items-end" : "items-start"
                  }`}
                >
                  {!isMine && (
                    <span className="text-[11px] text-muted-foreground px-1">
                      {msg.senderName}
                    </span>
                  )}
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-sm ${
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
      <div className="border-t bg-card px-3 py-2.5 flex gap-2 items-end shrink-0">
        <Textarea
          placeholder="Rašykite atsakymą..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={sendMutation.isPending}
          className="min-h-[40px] max-h-32 resize-none flex-1"
          rows={1}
        />
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={sendMutation.isPending || !text.trim()}
          aria-label="Siųsti"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default function OwnerFacilityMessages() {
  const { id } = useParams<{ id: string }>();
  const facilityId = Number(id);
  const { user } = useUser();
  const isDesktop = useIsDesktop();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: facility } = useQuery<FacilityData>({
    queryKey: ["facility-detail", id],
    queryFn: () => customFetch<FacilityData>(`${API_URL}/facilities/${id}`),
    enabled: !Number.isNaN(facilityId),
  });

  // Owner-scoped court list (so unverified / pending courts in this facility
  // are included). Bypasses the typed listCourts hook because its codegen
  // params don't currently expose ownerUserId.
  const facilityOwnerId = facility?.ownerUserId;
  const { data: courts } = useQuery<CourtSummary[]>({
    queryKey: ["owner-courts", facilityOwnerId],
    queryFn: () =>
      customFetch<CourtSummary[]>(
        `${API_URL}/courts?ownerUserId=${encodeURIComponent(facilityOwnerId!)}`,
      ),
    enabled: !!facilityOwnerId,
  });

  const facilityCourtIds = useMemo(() => {
    if (!courts) return new Set<number>();
    return new Set(
      courts.filter((c) => c.facilityId === facilityId).map((c) => c.id),
    );
  }, [courts, facilityId]);

  const { data: allThreads, isLoading: threadsLoading } = useQuery<OwnerThread[]>({
    queryKey: ["owner-inbox"],
    queryFn: () => customFetch<OwnerThread[]>(`${API_URL}/messages/owner-inbox`),
  });

  const threads = useMemo(() => {
    if (!allThreads) return [];
    if (facilityCourtIds.size === 0) return [];
    return allThreads.filter((t) => facilityCourtIds.has(t.courtId));
  }, [allThreads, facilityCourtIds]);

  const selectedThread = useMemo(
    () => threads.find((t) => threadKey(t) === selectedKey) ?? null,
    [threads, selectedKey],
  );

  // Auto-select the first thread only on desktop, and only once after threads
  // first arrive — so on mobile the user lands on the list, and pressing
  // "back" doesn't immediately re-open the first thread.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (
      isDesktop &&
      !autoSelectedRef.current &&
      !selectedKey &&
      threads.length > 0
    ) {
      autoSelectedRef.current = true;
      setSelectedKey(threadKey(threads[0]));
    }
  }, [isDesktop, threads, selectedKey]);

  const ownerUserId = user?.id ?? "";
  const ownerName =
    user?.fullName ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress ??
    "Savininkas";
  const ownerEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <OwnerLayout
      facilityId={facilityId}
      facilityName={facility?.name}
      title="Žinutės"
    >
      {/*
        Fill the entire OwnerLayout main column. OwnerLayout already spans the
        viewport minus the global topbar (4rem) and, on mobile, also injects a
        12px (h-12 = 3rem) facility header. Using flex-1 + min-h-0 inside that
        column makes us fit the remaining space exactly on both breakpoints.
      */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 md:px-6 py-3 border-b bg-card shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">Žinutės</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Klientų pokalbiai apie šio objekto aikšteles.
          </p>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr]">
          <aside
            className={`border-r bg-card overflow-y-auto ${
              selectedThread ? "hidden md:block" : "block"
            }`}
          >
            <ThreadList
              threads={threads}
              selectedKey={selectedKey}
              loading={threadsLoading}
              onSelect={(t) => setSelectedKey(threadKey(t))}
            />
          </aside>
          <section
            className={`min-h-0 ${selectedThread ? "block" : "hidden md:block"}`}
          >
            {selectedThread && ownerUserId ? (
              <OwnerChatPane
                key={threadKey(selectedThread)}
                thread={selectedThread}
                ownerUserId={ownerUserId}
                ownerName={ownerName}
                ownerEmail={ownerEmail}
                onBack={() => setSelectedKey(null)}
              />
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-6 text-center">
                <MessageSquare className="w-10 h-10 opacity-20" />
                <p className="font-medium">Pasirinkite pokalbį</p>
                <p className="text-xs">
                  Kairėje pasirinkite klientą, kad peržiūrėtumėte žinutes.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </OwnerLayout>
  );
}
