import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Euro, Users, Trophy, ArrowLeft, Clock, MapPin, Phone, Mail, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Rengiamas", open: "Registracija atidaryta", closed: "Registracija uždaryta", completed: "Baigtas",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-green-500/15 text-green-500 border-green-500/20",
  closed: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  completed: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};
const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Viengubas pašalinimas",
  double_elimination: "Dvigubas pašalinimas",
  round_robin: "Round Robin",
  league: "Lyga",
};

interface Tournament {
  id: number;
  courtId: number;
  name: string;
  description: string | null;
  sport: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  maxParticipants: number;
  entryFee: number | null;
  prizeInfo: string | null;
  status: string;
  format: string;
  registrationCount: number;
}

interface Court { id: number; name: string; city: string; address: string; phone: string | null; }

export default function TournamentDetail() {
  const { id } = useParams();
  const tournamentId = parseInt(id || "0", 10);
  const { user, isSignedIn } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [registered, setRegistered] = useState(false);

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const r = await fetch(`${API}/tournaments/${tournamentId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !isNaN(tournamentId),
  });

  const { data: court } = useQuery<Court>({
    queryKey: ["court", tournament?.courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${tournament!.courtId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!tournament?.courtId,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { playerName: string; playerEmail: string; playerPhone?: string; userId?: string }) => {
      const r = await fetch(`${API}/tournaments/${tournamentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Registracija nepavyko");
      }
      return r.json();
    },
    onSuccess: () => {
      setRegistered(true);
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      toast({ title: "Sėkmingai užsiregistravote!" });
    },
    onError: (e: Error) => {
      toast({ title: e.message, variant: "destructive" });
    },
  });

  const handleRegister = () => {
    const name = isSignedIn ? (user?.fullName ?? playerName) : playerName;
    const email = isSignedIn ? (user?.primaryEmailAddress?.emailAddress ?? playerEmail) : playerEmail;

    if (!name.trim()) { toast({ title: "Įveskite vardą", variant: "destructive" }); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Įveskite teisingą el. paštą", variant: "destructive" }); return;
    }

    registerMutation.mutate({
      playerName: name.trim(),
      playerEmail: email.trim(),
      playerPhone: playerPhone.trim() || undefined,
      userId: user?.id,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!tournament) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Turnyras nerastas.</p>
          <Link href="/tournaments"><Button variant="outline" className="mt-4">Grįžti į sąrašą</Button></Link>
        </div>
      </Layout>
    );
  }

  const spotsLeft = tournament.maxParticipants - tournament.registrationCount;
  const isFull = spotsLeft <= 0;
  const isOpen = tournament.status === "open";
  const deadlinePassed = tournament.registrationDeadline ? new Date() > new Date(tournament.registrationDeadline) : false;
  const canRegister = isOpen && !isFull && !deadlinePassed && !registered;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <Link href="/tournaments">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-6 -ml-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Visi turnyrai
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main */}
          <div className="md:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <SportIcon sport={tournament.sport} className="w-5 h-5" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">{SPORT_LABELS[tournament.sport] ?? tournament.sport}</span>
                <span className={`ml-auto text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[tournament.status]}`}>
                  {STATUS_LABELS[tournament.status] ?? tournament.status}
                </span>
              </div>
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{tournament.description}</p>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Data</p>
                <p className="font-semibold text-sm">{tournament.startDate}</p>
                {tournament.startDate !== tournament.endDate && (
                  <p className="text-xs text-muted-foreground">– {tournament.endDate}</p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Dalyviai</p>
                <p className="font-semibold text-sm">{tournament.registrationCount} / {tournament.maxParticipants}</p>
                {isOpen && (
                  <p className={`text-xs mt-0.5 font-medium ${isFull ? "text-destructive" : "text-green-500"}`}>
                    {isFull ? "Pilna" : `${spotsLeft} vietos liko`}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" />Formatas</p>
                <p className="font-semibold text-sm">{FORMAT_LABELS[tournament.format] ?? tournament.format}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Euro className="w-3.5 h-3.5" />Dalyvio mokestis</p>
                <p className={`font-semibold text-sm ${!tournament.entryFee || tournament.entryFee === 0 ? "text-green-500" : ""}`}>
                  {!tournament.entryFee || tournament.entryFee === 0 ? "Nemokama" : `€${tournament.entryFee}`}
                </p>
              </div>
            </div>

            {/* Prize */}
            {tournament.prizeInfo && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-1">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  Prizai
                </p>
                <p className="text-sm text-muted-foreground">{tournament.prizeInfo}</p>
              </div>
            )}

            {/* Court */}
            {court && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-2">Vieta</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{court.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3" />{court.city} · {court.address}
                    </div>
                  </div>
                  <Link href={`/courts/${court.id}`}>
                    <Button variant="outline" size="sm">Peržiūrėti aikštelę</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — registration */}
          <div className="md:col-span-1 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 sticky top-20">
              <h2 className="font-semibold text-base">Registracija</h2>
              <Separator />

              {registered ? (
                <div className="py-4 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                  <p className="font-semibold text-green-500">Užsiregistravote!</p>
                  <p className="text-xs text-muted-foreground">Patvirtinimas bus išsiųstas el. paštu</p>
                </div>
              ) : !isOpen ? (
                <div className="py-4 text-center space-y-2 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm">{STATUS_LABELS[tournament.status] ?? tournament.status}</p>
                </div>
              ) : isFull ? (
                <div className="py-4 text-center space-y-2 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-destructive">Turnyras pilnas</p>
                </div>
              ) : deadlinePassed ? (
                <div className="py-4 text-center space-y-2 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm">Registracija pasibaigė</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tournament.registrationDeadline && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Registracija iki {tournament.registrationDeadline}
                    </div>
                  )}

                  {isSignedIn ? (
                    <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                      <p className="font-semibold">{user?.fullName}</p>
                      <p className="text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Vardas pavardė *</Label>
                        <Input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Jonas Jonaitis" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">El. paštas *</Label>
                        <Input type="email" value={playerEmail} onChange={e => setPlayerEmail(e.target.value)} placeholder="jonas@email.lt" className="h-9 text-sm" />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefonas (neprivaloma)</Label>
                    <Input type="tel" value={playerPhone} onChange={e => setPlayerPhone(e.target.value)} placeholder="+370 600 00000" className="h-9 text-sm" />
                  </div>

                  {tournament.entryFee != null && tournament.entryFee > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm">
                      <span className="text-muted-foreground">Mokestis</span>
                      <span className="font-bold">€{tournament.entryFee}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleRegister}
                    className="w-full h-11 font-semibold gap-2"
                    disabled={registerMutation.isPending}
                  >
                    <Trophy className="w-4 h-4" />
                    {registerMutation.isPending ? "Registruojama..." : "Registruotis"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {spotsLeft} {spotsLeft === 1 ? "vieta" : "vietos"} iš {tournament.maxParticipants}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
