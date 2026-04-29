import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useUser } from "@clerk/react";
import { SafeShow as Show } from "@/lib/safeAuth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileCard } from "@/components/user-profile-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { SportIcon } from "@/components/sport-icon";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { openChat } from "@/components/chat-bubble";
import {
  Calendar, Clock, MapPin, Users, ArrowLeft, Share2, Copy, UserCheck, UserMinus, UserPlus,
  MessageCircle, Crown, Trash2, Trophy, CheckCircle2, Lock, Swords, XCircle, Mail, Send, Shield, Search,
  X, ShieldCheck, ShieldX, Loader2,
} from "lucide-react";
import { getTier, SPORT_EMOJIS } from "@/lib/rank-tier";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  "table-tennis": "Stalo tenisas", table_tennis: "Stalo tenisas",
  golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
  volleyball: "Tinklinis", hockey: "Ledo ritulys", futsal: "Futsalas",
  floorball: "Florbolai", "beach-volleyball": "Paplūdimio tinklinis",
  pickleball: "Pikliboulas",
};
const SKILL_LABELS: Record<string, string> = {
  any: "Bet koks", beginner: "Pradedantysis", intermediate: "Vidutinis", advanced: "Pažengęs",
};

interface Participant {
  id: number; gameId: number; userId?: string; userName: string;
  team: string | null; status: string; joinedAt: string; elo?: number; isOrganizer?: boolean;
  reliabilityScore?: number;
}
interface PendingParticipant {
  id: number; gameId: number; userId: string; userName: string; joinedAt: string;
}
interface GameDetail {
  id: number; creatorUserId?: string; creatorName: string;
  sport: string; city: string; placeName: string | null;
  courtId: number | null; facilityId: number | null;
  bookingId?: number | null;
  playersNeeded: number; skillLevel: string; datetime: string; durationMinutes: number;
  description: string | null; status: string; matchType: string; isPrivate: boolean;
  requiresApproval: boolean; teamCount: number; isCreator: boolean;
  inviteToken: string | null; joinedCount: number; slotsLeft: number; isJoined: boolean;
  isPending: boolean;
  participants: Participant[];
  pendingParticipants: PendingParticipant[];
}
interface BookingSummary { id: number; totalPrice: string | number; status: string; date: string; startTime: string; endTime: string; }
interface GameResult {
  id: number; gameId: number; reportedByUserId: string;
  scoreTeamA: number; scoreTeamB: number; status: string; autoConfirmAt: string | null;
}
interface UserRating { sportSlug: string; elo: number; wins: number; losses: number; draws: number; tier: { name: string; color: string } }

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("lt-LT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EloBadge({ elo, sport }: { elo: number; sport?: string }) {
  const t = getTier(elo);
  const sportEmoji = sport ? (SPORT_EMOJIS[sport] ?? "🏅") : null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${t.bgCls} ${t.cls}`}>
      {sportEmoji ?? t.emoji} {elo}
    </span>
  );
}

interface UserSearchResult { userId: string; userName: string; }

function PlayerSearchAdd({ gameId, sport, onAdded }: { gameId: number; sport: string; onAdded: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data: results, isLoading } = useQuery<UserSearchResult[]>({
    queryKey: ["user-search", query],
    queryFn: () => customFetch<UserSearchResult[]>(`${API}/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  const addPlayer = useMutation({
    mutationFn: (u: UserSearchResult) => customFetch(`${API}/games/${gameId}/add-player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: u.userId, targetUserName: u.userName }),
    }),
    onSuccess: () => {
      toast({ title: "Žaidėjas pridėtas!" });
      setOpen(false);
      setQuery("");
      onAdded();
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Search className="w-3.5 h-3.5" />
          Ieškoti žaidėjo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pridėti žaidėją</DialogTitle>
          <DialogDescription>Suraskite žaidėją pagal vardą</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Vardas..."
              className="pl-9"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          {query.length >= 2 && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {isLoading && <p className="text-xs text-center text-muted-foreground py-4">Ieškoma...</p>}
              {!isLoading && (!results || results.length === 0) && (
                <p className="text-xs text-center text-muted-foreground py-4">Nieko nerasta</p>
              )}
              {results?.map(u => (
                <button
                  key={u.userId}
                  onClick={() => addPlayer.mutate(u)}
                  disabled={addPlayer.isPending}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                    {u.userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.userName}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportResultDialog({ gameId, isCreator, result, sport }: {
  gameId: number; isCreator: boolean; result?: GameResult; sport: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<SportScore | null>(null);
  const [valid, setValid] = useState(false);

  const winnerSide = score && valid ? deriveWinner(score, getSportConfig(sport)) : null;

  const report = useMutation({
    mutationFn: () => customFetch(`${API}/games/${gameId}/result`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", gameId] });
      qc.invalidateQueries({ queryKey: ["game-result", gameId] });
      toast({ title: "Rezultatas paskelbtas!", description: "Dalyviai gali patvirtinti per 24h." });
      setOpen(false);
      setScore(null);
      setValid(false);
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  if (result) {
    const statusMap: Record<string, { label: string; cls: string }> = {
      pending_verification: { label: "Laukiama patvirtinimo", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-400/30" },
      confirmed: { label: "Patvirtinta", cls: "bg-green-500/15 text-green-500 border-green-400/30" },
      disputed: { label: "Ginčijama", cls: "bg-red-500/15 text-red-500 border-red-400/30" },
    };
    const s = statusMap[result.status] ?? { label: result.status, cls: "" };
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Rezultatas</h2>
          <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>{s.label}</span>
        </div>
        <div className="flex items-center justify-center gap-6 py-4 bg-muted/30 rounded-xl">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Komanda A</div>
            <div className="text-4xl font-black text-primary">{result.scoreTeamA}</div>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">:</div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Komanda B</div>
            <div className="text-4xl font-black text-primary">{result.scoreTeamB}</div>
          </div>
        </div>
        {result.autoConfirmAt && result.status === "pending_verification" && (
          <p className="text-xs text-muted-foreground text-center">
            Auto-patvirtinimas: {new Date(result.autoConfirmAt).toLocaleString("lt-LT")}
          </p>
        )}
      </div>
    );
  }

  if (!isCreator) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Trophy className="w-4 h-4" />Paskelbti rezultatą
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Paskelbti žaidimo rezultatą</DialogTitle>
          <DialogDescription>Dalyviai gaus pranešimą ir turės 24h patvirtinti.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <SportScoreInput
            sport={sport}
            labelA="Komanda A"
            labelB="Komanda B"
            value={score}
            onChange={(s, v) => { setScore(s); setValid(v); }}
            showErrors
            disabled={report.isPending}
          />
          {score && valid && !winnerSide && (
            <p className="mt-3 text-xs text-destructive">Lygiosios negalimos – pakoreguokite rezultatą.</p>
          )}
          {winnerSide && (
            <p className="mt-3 text-xs text-muted-foreground">
              Nugalėtoja: <span className="font-semibold text-foreground">Komanda {winnerSide === "a" ? "A" : "B"}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Atšaukti</Button>
          <Button onClick={() => report.mutate()} disabled={!score || !valid || !winnerSide || report.isPending}>
            {report.isPending ? "Skelbiama..." : "Paskelbti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerifyResultSection({ gameId, result, isParticipant }: {
  gameId: number; result: GameResult; isParticipant: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const verify = useMutation({
    mutationFn: (action: "confirm" | "dispute") => customFetch(`${API}/games/${gameId}/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: ["game", gameId] });
      qc.invalidateQueries({ queryKey: ["game-result", gameId] });
      toast({
        title: action === "confirm" ? "Rezultatas patvirtintas!" : "Rezultatas ginčijamas",
        description: action === "confirm" ? "ELO reitingai atnaujinti." : "Organizatorius gavo pranešimą.",
      });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  if (!isParticipant || result.status !== "pending_verification") return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
        onClick={() => verify.mutate("confirm")}
        disabled={verify.isPending}
      >
        <CheckCircle2 className="w-4 h-4" />Patvirtinti rezultatą
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-red-500/40 text-red-500 hover:bg-red-500/10 gap-1.5"
        onClick={() => verify.mutate("dispute")}
        disabled={verify.isPending}
      >
        <XCircle className="w-4 h-4" />Ginčyti
      </Button>
    </div>
  );
}

function InviteSection({ gameId }: { gameId: number }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const invite = useMutation({
    mutationFn: () => customFetch(`${API}/games/${gameId}/invite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined }),
    }),
    onSuccess: () => {
      toast({ title: "Kvietimas išsiųstas!", description: `El. laiškas išsiųstas ${email}` });
      setEmail(""); setName(""); setOpen(false);
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Mail className="w-4 h-4" />Pakviesti el. paštu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pakviesti žaidėją</DialogTitle>
          <DialogDescription>Išsiųsime kvietimą el. paštu su nuoroda prisijungti.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>El. paštas *</Label>
            <Input className="mt-1" type="email" placeholder="draugas@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Vardas (neprivaloma)</Label>
            <Input className="mt-1" placeholder="Jonas" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Atšaukti</Button>
          <Button onClick={() => invite.mutate()} disabled={invite.isPending || !email}>
            <Send className="w-4 h-4 mr-1.5" />
            {invite.isPending ? "Siunčiama..." : "Siųsti kvietimą"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GameRefundPreview {
  gameId: number;
  bookingId: number | null;
  hasBooking: boolean;
  totalPrice: number;
  hoursBeforeStart: number;
  refundPercent: number;
  refundAmount: number;
  refundable: boolean;
  canCancel: boolean;
  reason?: string;
}

function CancelGameDialog({
  gameId,
  hasBooking,
  onConfirmed,
  pending,
}: {
  gameId: number;
  hasBooking: boolean;
  onConfirmed: () => Promise<unknown>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: preview, isLoading } = useQuery<GameRefundPreview>({
    queryKey: ["game-refund-preview", gameId],
    queryFn: () => customFetch<GameRefundPreview>(`${API}/games/${gameId}/refund-preview`),
    enabled: open && hasBooking,
    staleTime: 0,
  });

  // If preview has loaded, trust its hasBooking (handles the orphan case where
  // game.bookingId points at a missing/deleted booking row → fall back to plain warning).
  const effectiveHasBooking = preview ? preview.hasBooking : hasBooking;
  const showRefundUi = effectiveHasBooking && (isLoading || !!preview);
  const refundEur = preview?.refundAmount ?? 0;
  const totalPaid = preview?.totalPrice ?? 0;
  const isLate = preview ? !preview.refundable : false;
  const tierMsg = !preview
    ? ""
    : (preview.refundPercent >= 80
        ? "Atšaukus dabar, bus grąžinta 80% sumos."
        : preview.refundPercent >= 50
          ? "Atšaukus dabar, bus grąžinta 50% sumos."
          : "Atšaukus dabar, pinigai nebus grąžinami.");

  const blockedByPolicy = effectiveHasBooking && preview && !preview.canCancel;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirmed();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && !pending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="w-4 h-4 mr-1.5" />Panaikinti žaidimą
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Panaikinti žaidimą?</DialogTitle>
          <DialogDescription>
            {!hasBooking
              ? "Visi dalyviai bus pašalinti. Šio veiksmo atšaukti negalima."
              : isLoading || !preview
                ? "Skaičiuojamas grąžintinas mokestis…"
                : blockedByPolicy
                  ? (preview.reason ?? "Atšaukti šiuo metu negalima.")
                  : tierMsg}
          </DialogDescription>
        </DialogHeader>

        {showRefundUi && preview && preview.canCancel && totalPaid > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sumokėta</span>
              <span className="font-medium">€{totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grąžinama</span>
              <span className="font-medium">{preview.refundPercent}%</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 mt-1.5">
              <span className="font-semibold">Grąžinama suma</span>
              <span className={`font-bold ${isLate ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                €{refundEur.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {hasBooking
            ? "Grąžinimo politika: ≥48h iki pradžios — 80%, ≥24h — 50%, mažiau — 0%."
            : "Visi prisijungę dalyviai bus informuoti."}
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting || pending}>
            Atšaukti
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || pending || (hasBooking && !!blockedByPolicy)}
          >
            {(submitting || pending) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Panaikinti žaidimą
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const id = parseInt(params.id!, 10);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const { data, isLoading, error } = useQuery<GameDetail>({
    queryKey: ["game", id, token],
    queryFn: () => customFetch<GameDetail>(`${API}/games/${id}${token ? `?token=${token}` : ""}`),
    enabled: !isNaN(id),
  });

  const { data: result } = useQuery<GameResult>({
    queryKey: ["game-result", id],
    queryFn: () => customFetch<GameResult>(`${API}/games/${id}/result`).catch(() => null as any),
    enabled: !isNaN(id) && !!data && (data.status === "pending_verification" || data.status === "completed" || data.status === "disputed"),
    staleTime: 30_000,
  });

  const participantIds = data?.participants.map(p => p.userId) ?? [];
  const { data: avatarMap } = useQuery<Record<string, string | null>>({
    queryKey: ["participant-avatars", participantIds.join(",")],
    queryFn: () => customFetch<Record<string, string | null>>(`${API}/user-profiles/batch?ids=${participantIds.join(",")}`),
    enabled: participantIds.length > 0,
    staleTime: 60_000,
  });

  const { data: bookingSummary } = useQuery<BookingSummary>({
    queryKey: ["booking-summary", data?.bookingId],
    queryFn: () => customFetch<BookingSummary>(`${API}/bookings/${data!.bookingId}`).catch(() => null as any),
    enabled: !!data?.bookingId,
    staleTime: 60_000,
  });

  const { data: creatorRatings } = useQuery<UserRating[]>({
    queryKey: ["user-ratings", data?.creatorUserId],
    queryFn: () => customFetch<UserRating[]>(`${API}/user-ratings/${data!.creatorUserId}`),
    enabled: !!data?.creatorUserId,
    staleTime: 60_000,
  });

  const [profileView, setProfileView] = useState<{ userId: string; userName: string } | null>(null);

  const join = useMutation({
    mutationFn: () => customFetch<{ ok: boolean; status?: string; alreadyJoined?: boolean }>(`${API}/games/${id}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: user?.fullName || user?.firstName || "Žaidėjas",
        userEmail: user?.emailAddresses[0]?.emailAddress,
        token: token || undefined,
      }),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["game", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
      if (res.status === "pending") {
        toast({ title: "Prašymas išsiųstas!", description: "Laukite organizatoriaus patvirtinimo." });
      } else {
        toast({ title: "Prisijungėte prie žaidimo!" });
      }
    },
    onError: (e: any) => toast({ title: "Nepavyko prisijungti", description: e?.message, variant: "destructive" }),
  });

  const approveJoin = useMutation({
    mutationFn: ({ participantId, action }: { participantId: number; action: "approve" | "reject" }) =>
      customFetch(`${API}/games/${id}/approve-join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, action }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["game", id] });
      toast({
        title: vars.action === "approve" ? "Žaidėjas patvirtintas!" : "Prašymas atmestas",
        description: vars.action === "approve" ? "Žaidėjas pridėtas prie dalyvių." : "Žaidėjas informuotas.",
      });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  const removePlayer = useMutation({
    mutationFn: (targetUserId: string) => customFetch(`${API}/games/${id}/remove-player`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", id] });
      toast({ title: "Žaidėjas pašalintas", description: "Žaidėjas gavo pranešimą." });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  const leave = useMutation({
    mutationFn: () => customFetch(`${API}/games/${id}/leave`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
      toast({ title: "Palikote žaidimą" });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: () => customFetch(`${API}/games/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Žaidimas panaikintas" });
      setLocation("/games");
    },
  });

  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isParticipantOrCreator = data?.isJoined || data?.isCreator;

  const { data: chatMessages = [] } = useQuery<any[]>({
    queryKey: ["game-chat", id],
    queryFn: () => customFetch<any[]>(`${API}/games/${id}/chat`),
    enabled: !isNaN(id) && !!user && !!isParticipantOrCreator,
    refetchInterval: 5000,
    staleTime: 0,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const sendChat = useMutation({
    mutationFn: (body: string) => customFetch(`${API}/games/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderName: user?.fullName || user?.firstName || "Žaidėjas", body }),
    }),
    onSuccess: () => {
      setChatInput("");
      qc.invalidateQueries({ queryKey: ["game-chat", id] });
    },
    onError: (e: any) => toast({ title: "Klaida siunčiant žinutę", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
          <Skeleton className="h-12 w-32" /><Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Žaidimas nerastas</h1>
          <p className="text-muted-foreground mb-6">Galbūt buvo panaikintas arba nuoroda neteisinga.</p>
          <Button asChild><Link href="/games">Grįžti į žaidimus</Link></Button>
        </div>
      </Layout>
    );
  }

  const isCreator = !!data.isCreator;
  const isParticipant = data.isJoined && !isCreator;
  const shareUrl = data.isPrivate && data.inviteToken
    ? `${window.location.origin}${BASE}/games/${data.id}?token=${data.inviteToken}`
    : `${window.location.origin}${BASE}/games/${data.id}`;

  const copyShare = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Nuoroda nukopijuota!" });
  };

  const full = data.slotsLeft === 0;
  const isPast = new Date(data.datetime) < new Date();
  const isEnded = (new Date(data.datetime).getTime() + (data.durationMinutes ?? 0) * 60_000) < Date.now();
  const isRated = data.matchType === "rated";

  const creatorSportRating = creatorRatings?.find(r => r.sportSlug === data.sport);

  const statusBadge = () => {
    if (data.status === "completed") return <Badge className="bg-green-500/15 text-green-500 border-green-400/30"><CheckCircle2 className="w-3 h-3 mr-1"/>Baigtas</Badge>;
    if (data.status === "pending_verification") return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-400/30">Laukiama patvirtinimo</Badge>;
    if (data.status === "disputed") return <Badge className="bg-red-500/15 text-red-500 border-red-400/30">Ginčijamas</Badge>;
    if (full) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Užpildytas</Badge>;
    return null;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/games"><ArrowLeft className="w-4 h-4 mr-1.5"/>Visi žaidimai</Link>
        </Button>

        {/* ─── Host-Pays-All split-cost banner (booked Korts.lt court) ─── */}
        {bookingSummary && data.bookingId && (
          <div className={`mb-4 rounded-2xl border p-4 ${isCreator ? "border-[#C5E041]/40 bg-[#C5E041]/10" : "border-blue-500/30 bg-blue-500/10"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCreator ? "bg-[#C5E041]/30" : "bg-blue-500/20"}`}>
                <Trophy className="w-5 h-5" />
              </div>
              <div className="flex-1">
                {isCreator ? (
                  <>
                    <div className="font-bold">Aikštelė užsakyta — apmokėjote €{Number(bookingSummary.totalPrice).toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      Dalis vienam žaidėjui: <b>€{(Number(bookingSummary.totalPrice) / Math.max(1, data.playersNeeded)).toFixed(2)}</b>.
                      Susirinkite mokestį iš dalyvių aikštelėje.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold">Tavo dalis: €{(Number(bookingSummary.totalPrice) / Math.max(1, data.playersNeeded)).toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      Aikštelę užsakė kūrėjas (€{Number(bookingSummary.totalPrice).toFixed(2)}). Sumokėkite jam grynais arba pavedimu aikštelėje.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hero card */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden mb-6">
          <div
            className="p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #132D4C 0%, #1a3d66 70%, #0f2240 100%)" }}
          >
            <div className="flex flex-wrap items-start gap-4 sm:gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                <SportIcon sport={data.sport} className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge className="bg-[#C5E041]/20 text-[#C5E041] border-[#C5E041]/40">
                    {SPORT_LABELS[data.sport] ?? data.sport}
                  </Badge>
                  <Badge variant="outline" className="border-white/30 text-white/80">{SKILL_LABELS[data.skillLevel]}</Badge>
                  {isRated ? (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
                      <Swords className="w-3 h-3 mr-1"/>Reitinginis
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-white/20 text-white/60">Laisvas</Badge>
                  )}
                  {data.isPrivate && <Badge variant="outline" className="border-white/30 text-white/80"><Lock className="w-3 h-3 mr-1"/>Privatus</Badge>}
                  {statusBadge()}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {data.creatorName} · {data.playersNeeded} žaidėjams
                </h1>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {creatorSportRating && (
                    <EloBadge elo={creatorSportRating.elo} sport={data.sport} />
                  )}
                  <span className="text-white/60 text-sm">
                    {creatorSportRating
                      ? `${creatorSportRating.wins}V ${creatorSportRating.losses}P ${creatorSportRating.draws}L`
                      : ""}
                  </span>
                </div>
                {data.description && <p className="text-white/70 mt-2 text-sm">{data.description}</p>}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Calendar className="w-5 h-5 text-primary"/></div>
              <div><div className="text-xs text-muted-foreground">Kada</div><div className="font-semibold capitalize">{formatDateTime(data.datetime)}</div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Clock className="w-5 h-5 text-primary"/></div>
              <div><div className="text-xs text-muted-foreground">Trukmė</div><div className="font-semibold">{data.durationMinutes} min</div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><MapPin className="w-5 h-5 text-primary"/></div>
              <div>
                <div className="text-xs text-muted-foreground">Kur</div>
                <div className="font-semibold">{data.city}{data.placeName ? ` · ${data.placeName}` : ""}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Users className="w-5 h-5 text-primary"/></div>
              <div>
                <div className="text-xs text-muted-foreground">Žaidėjai</div>
                <div className="font-semibold">{data.joinedCount} / {data.playersNeeded} {full ? "" : `(dar ${data.slotsLeft})`}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="p-4 sm:p-6 flex flex-wrap items-center gap-2 sm:gap-3">
            <Show when="signed-in">
              {isCreator ? (
                <>
                  <CancelGameDialog
                    gameId={id}
                    hasBooking={!!data.bookingId}
                    onConfirmed={() => del.mutateAsync()}
                    pending={del.isPending}
                  />

                  {isEnded && !result && <ReportResultDialog gameId={id} isCreator={isCreator} result={result} sport={data.sport} />}
                  <InviteSection gameId={id} />
                </>
              ) : data.isJoined ? (
                <Button variant="outline" size="sm" onClick={() => leave.mutate()} disabled={leave.isPending}>
                  <UserMinus className="w-4 h-4 mr-1.5"/>Palikti žaidimą
                </Button>
              ) : data.isPending ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-400/30 text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                  <Clock className="w-4 h-4 shrink-0" />
                  Laukiama organizatoriaus patvirtinimo
                </div>
              ) : (
                <Button
                  size="lg"
                  onClick={() => join.mutate()}
                  disabled={join.isPending || full || isPast}
                  className="bg-[#C5E041] text-[#132D4C] hover:bg-[#d4ee56] font-bold"
                >
                  <UserPlus className="w-4 h-4 mr-2"/>
                  {full ? "Užpildyta" : isPast ? "Pasibaigė"
                    : data.requiresApproval ? "Prašyti prisijungti"
                    : "Prisijungti prie žaidimo"}
                </Button>
              )}
              {!isCreator && !!user?.id && !!data.creatorUserId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openChat({
                    userId: data.creatorUserId!,
                    userName: data.creatorName,
                    ctxType: "game",
                    ctxId: data.id,
                  })}
                >
                  <MessageCircle className="w-4 h-4 mr-1.5"/>Parašyti organizatoriui
                </Button>
              )}
            </Show>
            <Show when="signed-out">
              <Button asChild className="bg-[#C5E041] text-[#132D4C] hover:bg-[#d4ee56] font-bold">
                <Link href="/sign-in">Prisijungti, kad dalyvautum</Link>
              </Button>
            </Show>

            <div className="sm:ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyShare}>
                <Share2 className="w-4 h-4 mr-1.5"/>Dalintis
              </Button>
            </div>
          </div>
        </div>

        {/* Result section if exists */}
        {result && (
          <div className="mb-6">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Rezultatas</h2>
                {(() => {
                  const statusMap: Record<string, { label: string; cls: string }> = {
                    pending_verification: { label: "Laukiama patvirtinimo", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-400/30" },
                    confirmed: { label: "Patvirtinta", cls: "bg-green-500/15 text-green-500 border-green-400/30" },
                    disputed: { label: "Ginčijama", cls: "bg-red-500/15 text-red-500 border-red-400/30" },
                  };
                  const s = statusMap[result.status] ?? { label: result.status, cls: "" };
                  return <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>{s.label}</span>;
                })()}
              </div>
              <div className="flex items-center justify-center gap-6 py-4 bg-muted/30 rounded-xl">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Komanda A</div>
                  <div className="text-4xl font-black text-primary">{result.scoreTeamA}</div>
                </div>
                <div className="text-2xl font-bold text-muted-foreground">:</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Komanda B</div>
                  <div className="text-4xl font-black text-primary">{result.scoreTeamB}</div>
                </div>
              </div>
              {result.autoConfirmAt && result.status === "pending_verification" && (
                <p className="text-xs text-muted-foreground text-center">
                  Auto-patvirtinimas: {new Date(result.autoConfirmAt).toLocaleString("lt-LT")}
                </p>
              )}
              {user && isParticipant && (
                <VerifyResultSection gameId={id} result={result} isParticipant={isParticipant} />
              )}
            </div>
          </div>
        )}

        {/* Share card */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="w-4 h-4 text-primary"/>
            <h3 className="font-semibold text-sm">Kviesk draugus</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Nukopijuok nuorodą ir siųsk draugams — jie galės prisijungti tiesiai iš puslapio.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs break-all font-mono">{shareUrl}</code>
            <Button size="sm" onClick={copyShare}><Copy className="w-4 h-4"/></Button>
          </div>
        </div>

        {/* Pending join requests — creator only */}
        {isCreator && (data.pendingParticipants?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/5 p-5 sm:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-500" />
              <h2 className="font-bold text-base">
                Prisijungimo prašymai
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-bold">
                  {data.pendingParticipants.length}
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {data.pendingParticipants.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                    {p.userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      Prašė {new Date(p.joinedAt).toLocaleDateString("lt-LT")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 gap-1"
                      onClick={() => approveJoin.mutate({ participantId: p.id, action: "approve" })}
                      disabled={approveJoin.isPending}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Patvirtinti
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 gap-1 border-red-500/40 text-red-500 hover:bg-red-500/10"
                      onClick={() => approveJoin.mutate({ participantId: p.id, action: "reject" })}
                      disabled={approveJoin.isPending}
                    >
                      <ShieldX className="w-3.5 h-3.5" />
                      Atmesti
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary"/>
            <h2 className="font-bold text-lg">Dalyviai ({data.joinedCount}/{data.playersNeeded})</h2>
            {isCreator && data.requiresApproval && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-400/30">
                <UserCheck className="w-3 h-3"/>Patvirtinimas
              </span>
            )}
            {isCreator && data.status === "open" && (
              <div className="ml-auto">
                <PlayerSearchAdd gameId={data.id} sport={data.sport} onAdded={() => qc.invalidateQueries({ queryKey: ["game", id] })} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            {data.participants.map((p) => {
              const pImageUrl = avatarMap?.[p.userId] ?? null;
              const pElo = p.elo ?? 1200;
              const teamColors: Record<string, string> = {
                A: "bg-blue-500/15 text-blue-500",
                B: "bg-red-500/15 text-red-500",
                C: "bg-green-500/15 text-green-600",
                D: "bg-amber-500/15 text-amber-600",
                E: "bg-purple-500/15 text-purple-500",
                F: "bg-orange-500/15 text-orange-500",
              };
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <button onClick={() => p.userId && setProfileView({ userId: p.userId, userName: p.userName })} className="shrink-0">
                    <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer">
                      {pImageUrl && <AvatarImage src={pImageUrl} alt={p.userName} />}
                      <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                        {p.userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => p.userId && setProfileView({ userId: p.userId, userName: p.userName })}
                      className="font-medium flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      {p.userName}
                      {!!p.isOrganizer && <Crown className="w-3.5 h-3.5 text-primary" />}
                    </button>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <EloBadge elo={pElo} sport={data.sport} />
                      {typeof p.reliabilityScore === "number" && (
                        <span
                          title="Patikimumo balas (krenta paliekant žaidimą paskutinę minutę)"
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${
                            p.reliabilityScore >= 80
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : p.reliabilityScore >= 50
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              : "bg-red-500/10 text-red-600 border-red-500/30"
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {p.reliabilityScore}
                        </span>
                      )}
                      <span>· {new Date(p.joinedAt).toLocaleDateString("lt-LT")}</span>
                      {p.team && (
                        <span className={`px-1.5 py-0 rounded text-xs font-bold ${teamColors[p.team] ?? "bg-muted text-muted-foreground"}`}>
                          Komanda {p.team}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!!user?.id && !!p.userId && user.id !== p.userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openChat({
                          userId: p.userId!,
                          userName: p.userName,
                          ctxType: "game",
                          ctxId: data.id,
                        })}
                      >
                        <MessageCircle className="w-4 h-4"/>
                      </Button>
                    )}
                    {isCreator && !p.isOrganizer && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          >
                            <X className="w-4 h-4"/>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Pašalinti {p.userName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Žaidėjas bus pašalintas iš žaidimo ir gaus pranešimą. Šio veiksmo atšaukti negalima.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => removePlayer.mutate(p.userId)}
                            >
                              Pašalinti
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
            {Array.from({ length: data.slotsLeft }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-muted-foreground"/>
                </div>
                <div className="text-sm text-muted-foreground italic">Laisva vieta</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Chat — only for participants and creator */}
      {(data.isJoined || isCreator) && (
        <div className="glass-card rounded-2xl p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Žaidimo pokalbiai</h3>
            <Badge variant="outline" className="text-xs ml-auto">Tik dalyviams</Badge>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-3 mb-4 pr-1">
            {chatMessages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 italic">
                Dar nėra žinučių. Pradėkite pokalbį!
              </p>
            )}
            {chatMessages.map((msg: any) => {
              const isMe = msg.senderUserId === user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs">{msg.senderName?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[11px] text-muted-foreground mb-0.5">{msg.senderName}</span>
                    <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(msg.createdAt).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Rašykite žinutę..."
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                  e.preventDefault();
                  sendChat.mutate(chatInput);
                }
              }}
              className="flex-1"
              disabled={sendChat.isPending}
            />
            <Button
              size="icon"
              onClick={() => { if (chatInput.trim()) sendChat.mutate(chatInput); }}
              disabled={!chatInput.trim() || sendChat.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {profileView && (
        <UserProfileCard
          open={!!profileView}
          onClose={() => setProfileView(null)}
          userId={profileView.userId}
          userName={profileView.userName}
          userImageUrl={avatarMap?.[profileView.userId]}
          onMessage={user?.id && user.id !== profileView.userId ? () => {
            openChat({ userId: profileView.userId, userName: profileView.userName, ctxType: "game", ctxId: data?.id });
          } : undefined}
        />
      )}
    </Layout>
  );
}
