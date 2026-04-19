import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocation } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

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
    case "game_join_request": return "🏃";
    case "game_cancelled": return "🚫";
    default: return "🔔";
  }
}

export function NotificationBell() {
  const { user, isSignedIn } = useUser();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = user?.id ?? null;
  const unread = notifs.filter(n => !n.read).length;

  async function fetchNotifs() {
    if (!userId) return;
    try {
      const res = await fetch(`${API}/notifications?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!userId) return;
    fetchNotifs();
    intervalRef.current = setInterval(fetchNotifs, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  async function markRead(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await fetch(`${API}/notifications/${id}/read`, { method: "PATCH" });
    } catch { /* silent */ }
  }

  async function markAllRead() {
    if (!userId) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch(`${API}/notifications/read-all?userId=${encodeURIComponent(userId)}`, { method: "POST" });
    } catch { /* silent */ }
  }

  async function handleClick(notif: Notif) {
    await markRead(notif.id);
    setOpen(false);
    if (notif.link) setLocation(notif.link);
  }

  if (!isSignedIn) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Pranešimai"
          className="relative flex items-center justify-center w-8 h-8 rounded-md border border-border hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Pranešimai</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Pažymėti visus kaip skaitytus
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Bell className="h-8 w-8 opacity-30" />
              <span>Pranešimų nėra</span>
            </div>
          ) : (
            notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b last:border-b-0 flex gap-3 hover:bg-accent transition-colors ${
                  n.read ? "opacity-60" : "bg-primary/5"
                }`}
              >
                <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${n.read ? "font-normal" : "font-semibold"}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
