import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useUser, Show } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileCard } from "@/components/user-profile-card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SportIcon } from "@/components/sport-icon";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { openChat } from "@/components/chat-bubble";
import {
  Calendar, Clock, MapPin, Users, ArrowLeft, Share2, Copy, UserCheck, UserMinus, UserPlus,
  MessageCircle, Crown, Trash2, Trophy, CheckCircle2, Lock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};
const SKILL_LABELS: Record<string, string> = {
  any: "Bet koks", beginner: "Pradedantysis", intermediate: "Vidutinis", advanced: "Pažengęs",
};

interface Participant {
  id: number; gameId: number; userId: string; userName: string; userEmail: string | null; status: string; joinedAt: string;
}
interface GameDetail {
  id: number; creatorUserId: string; creatorName: string; creatorEmail: string | null;
  sport: string; city: string; placeName: string | null;
  courtId: number | null; facilityId: number | null;
  playersNeeded: number; skillLevel: string; datetime: string; durationMinutes: number;
  description: string | null; status: string; isPrivate: boolean; inviteToken: string | null;
  joinedCount: number; slotsLeft: number; isJoined: boolean;
  participants: Participant[];
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("lt-LT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

  const participantIds = data?.participants.map(p => p.userId) ?? [];
  const { data: avatarMap } = useQuery<Record<string, string | null>>({
    queryKey: ["participant-avatars", participantIds.join(",")],
    queryFn: () => customFetch<Record<string, string | null>>(`${API}/user-profiles/batch?ids=${participantIds.join(",")}`),
    enabled: participantIds.length > 0,
    staleTime: 60_000,
  });

  const [profileView, setProfileView] = useState<{ userId: string; userName: string } | null>(null);

  const join = useMutation({
    mutationFn: () => customFetch(`${API}/games/${id}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: user?.fullName || user?.firstName || "Žaidėjas",
        userEmail: user?.emailAddresses[0]?.emailAddress,
        token: token || undefined,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
      toast({ title: "Prisijungėte prie žaidimo!" });
    },
    onError: (e: any) => toast({ title: "Nepavyko prisijungti", description: e?.message, variant: "destructive" }),
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

  const isCreator = user?.id === data.creatorUserId;
  const shareUrl = data.isPrivate && data.inviteToken
    ? `${window.location.origin}${BASE}/games/${data.id}?token=${data.inviteToken}`
    : `${window.location.origin}${BASE}/games/${data.id}`;

  const copyShare = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Nuoroda nukopijuota!" });
  };

  const full = data.slotsLeft === 0;
  const isPast = new Date(data.datetime) < new Date();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/games"><ArrowLeft className="w-4 h-4 mr-1.5"/>Visi žaidimai</Link>
        </Button>

        {/* Hero card */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden mb-6">
          <div className="bg-gradient-to-br from-primary/25 via-primary/10 to-background p-6 sm:p-8">
            <div className="flex flex-wrap items-start gap-4 sm:gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <SportIcon sport={data.sport} className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge className="bg-primary/15 text-primary border-primary/30">{SPORT_LABELS[data.sport]}</Badge>
                  <Badge variant="outline">{SKILL_LABELS[data.skillLevel]}</Badge>
                  {data.isPrivate && <Badge variant="outline" className="border-purple-500/40 text-purple-400"><Lock className="w-3 h-3 mr-1"/>Privatus</Badge>}
                  {full && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Užpildytas</Badge>}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {data.creatorName} · ieško {data.playersNeeded - 1} partner{data.playersNeeded === 2 ? "io" : "ių"}
                </h1>
                {data.description && <p className="text-muted-foreground mt-2">{data.description}</p>}
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-1.5"/>Panaikinti žaidimą</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Panaikinti žaidimą?</AlertDialogTitle>
                      <AlertDialogDescription>Visi dalyviai bus pašalinti. Šio veiksmo atšaukti negalima.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate()}>Panaikinti</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : data.isJoined ? (
                <Button variant="outline" size="sm" onClick={() => leave.mutate()} disabled={leave.isPending}>
                  <UserMinus className="w-4 h-4 mr-1.5"/>Palikti žaidimą
                </Button>
              ) : (
                <Button size="lg" onClick={() => join.mutate()} disabled={join.isPending || full || isPast}>
                  <UserPlus className="w-4 h-4 mr-2"/>
                  {full ? "Užpildyta" : isPast ? "Pasibaigė" : "Prisijungti prie žaidimo"}
                </Button>
              )}
              {!isCreator && user?.id && data.creatorUserId !== user.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openChat({
                    userId: data.creatorUserId,
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
              <Button asChild><Link href="/sign-in">Prisijungti, kad dalyvautum</Link></Button>
            </Show>

            <div className="sm:ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyShare}>
                <Share2 className="w-4 h-4 mr-1.5"/>Dalintis
              </Button>
            </div>
          </div>
        </div>

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

        {/* Participants */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary"/>
            <h2 className="font-bold text-lg">Dalyviai ({data.joinedCount}/{data.playersNeeded})</h2>
          </div>
          <div className="space-y-2">
            {data.participants.map((p) => {
              const pImageUrl = avatarMap?.[p.userId] ?? null;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <button onClick={() => setProfileView({ userId: p.userId, userName: p.userName })} className="shrink-0">
                    <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer">
                      {pImageUrl && <AvatarImage src={pImageUrl} alt={p.userName} />}
                      <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                        {p.userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setProfileView({ userId: p.userId, userName: p.userName })}
                      className="font-medium flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      {p.userName}
                      {p.userId === data.creatorUserId && <Crown className="w-3.5 h-3.5 text-primary" />}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      Prisijungė {new Date(p.joinedAt).toLocaleDateString("lt-LT")}
                    </div>
                  </div>
                  {user?.id && user.id !== p.userId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openChat({
                        userId: p.userId,
                        userName: p.userName,
                        ctxType: "game",
                        ctxId: data.id,
                      })}
                    >
                      <MessageCircle className="w-4 h-4"/>
                    </Button>
                  )}
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
