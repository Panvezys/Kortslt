import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CoachLayout } from "@/components/coach-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { MessageSquare } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

// Mirrors the /dm/threads response shape. We share the same queryKey as
// chat-bubble's inbox query so both views read from one cache entry, then
// filter client-side for contextType === 'coach' to surface coach-scoped DMs.
interface Thread {
  otherUserId: string;
  otherUserName: string;
  otherUserImageUrl: string | null;
  lastMessage: {
    body: string;
    createdAt: string;
    senderUserId: string;
    contextType?: string | null;
    contextId?: number | null;
  };
  unread: number;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "dabar";
  if (min < 60) return `${min} min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} val.`;
  return d.toLocaleDateString("lt-LT", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function CoachMessages() {
  const { data: coachThreads = [], isLoading } = useQuery<Thread[], Error, Thread[]>({
    queryKey: ["dm-threads"],
    queryFn: () => customFetch<Thread[]>(`${API}/dm/threads`),
    staleTime: 60_000,
    select: (threads) =>
      threads.filter((t) => t.lastMessage.contextType === "coach"),
  });

  return (
    <CoachLayout title="Žinutės">
      <div className="flex-1 min-h-0 flex flex-col max-w-3xl">
        <div className="px-4 md:px-6 py-3 border-b bg-card">
          <h1 className="text-xl font-semibold tracking-tight">Žinutės</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mokinių užklausos dėl trenerystės.
          </p>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : coachThreads.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={<MessageSquare className="h-10 w-10" />}
              title="Užklausų dar nėra"
              description="Kai mokiniai parašys jums dėl pamokų, pokalbiai atsiras čia."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {coachThreads.map((t) => (
              <li key={t.otherUserId}>
                <Link
                  href={`/messages?u=${t.otherUserId}&n=${encodeURIComponent(t.otherUserName)}`}
                  className="w-full text-left p-4 flex gap-3 hover:bg-muted/40 transition-colors items-start"
                >
                  <Avatar className="h-11 w-11 shrink-0">
                    {t.otherUserImageUrl && (
                      <AvatarImage src={t.otherUserImageUrl} alt={t.otherUserName} />
                    )}
                    <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
                      {initials(t.otherUserName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{t.otherUserName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(t.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${
                          t.unread > 0 ? "font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {t.lastMessage.body}
                      </p>
                      {t.unread > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 shrink-0 bg-red-500 hover:bg-red-500 text-white">
                          {t.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CoachLayout>
  );
}
