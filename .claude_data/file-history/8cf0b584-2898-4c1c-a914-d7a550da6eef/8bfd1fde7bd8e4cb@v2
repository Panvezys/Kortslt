import { useState, useCallback, useEffect } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Bell, CheckCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

type Notif = {
  id: number;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ką tik";
  if (mins < 60) return `prieš ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `prieš ${hrs} val`;
  const days = Math.floor(hrs / 24);
  return `prieš ${days} d`;
}

function typeIcon(type: string) {
  switch (type) {
    case "message": return "💬";
    case "booking_created": return "📅";
    case "booking_cancelled": return "❌";
    case "court_approved": return "✅";
    case "court_rejected": return "🚫";
    case "facility_approved": return "✅";
    case "facility_rejected": return "🚫";
    case "coach_approved": return "✅";
    case "coach_rejected": return "🚫";
    case "game_join_request": return "🏃";
    case "game_cancelled": return "🚫";
    case "game_join_approved": return "✅";
    case "game_join_rejected": return "🚫";
    case "game_removed": return "🚫";
    case "result_confirmation": return "🏆";
    case "result_disputed": return "⚠️";
    case "elo_update": return "📊";
    case "split_player_joined": return "👥";
    case "admin_pending_review": return "🔔";
    default: return "🔔";
  }
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { getToken } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    const headers = new Headers(options?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers, credentials: "include" });
  }, [getToken]);

  const fetchPage = useCallback(async (pageIndex: number, replace: boolean) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/notifications?limit=${PAGE_SIZE + 1}&offset=${pageIndex * PAGE_SIZE}`);
      if (!res.ok) return;
      const data: Notif[] = await res.json();
      const hasNext = data.length > PAGE_SIZE;
      setHasMore(hasNext);
      const items = hasNext ? data.slice(0, PAGE_SIZE) : data;
      setNotifs(prev => replace ? items : [...prev, ...items]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (isLoaded && isSignedIn) fetchPage(0, true);
  }, [isLoaded, isSignedIn, fetchPage]);

  async function handleClick(n: Notif) {
    if (!n.read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      authFetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    if (n.link) setLocation(n.link);
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await authFetch(`/api/notifications/read-all`, { method: "POST" });
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, false);
  }

  if (isLoaded && !isSignedIn) {
    setLocation("/sign-in");
    return null;
  }

  const unread = notifs.filter(n => !n.read).length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pranešimai</h1>
            {unread > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">{unread} neskaityti</p>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={markingAll}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Pažymėti visus
            </Button>
          )}
        </div>

        {loading && notifs.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-4 rounded-lg border">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="Pranešimų nėra"
            description="Čia bus rodomi visi jūsų pranešimai."
          />
        ) : (
          <div className="space-y-1">
            {notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left p-4 rounded-lg border flex gap-3 hover:bg-accent transition-colors ${
                  n.read ? "opacity-70" : "bg-primary/5 border-primary/20"
                }`}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${n.read ? "font-normal" : "font-semibold"}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))}

            {hasMore && (
              <div className="pt-4 text-center">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? "Kraunama..." : "Rodyti daugiau"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
