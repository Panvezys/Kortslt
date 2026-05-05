import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  CalendarDays,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Users,
} from "lucide-react";
import { OwnerLayout, useFacilityId } from "@/components/owner-layout";
import { SportPill } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

interface PendingTournament {
  id: number;
  facilityId: number | null;
  facilityName: string | null;
  facilityCity: string | null;
  organizerId: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  entryFee: number | null;
  prizeInfo: string | null;
  description: string | null;
  approvalStatus: string;
  courtIds: number[];
  createdAt: string;
}

interface FacilitySummary {
  id: number;
  name: string;
  courtCount?: number;
  courts?: Array<{ id: number; name: string }>;
}

export default function OwnerTournamentsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [responseMap, setResponseMap] = useState<Record<number, string>>({});
  const facilityId = useFacilityId();

  const { data: pendingAll = [], isLoading } = useQuery<PendingTournament[]>({
    queryKey: ["owner-tournament-requests"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/owner/tournament-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Nepavyko gauti užklausų");
      return r.json();
    },
  });

  const facilitiesQ = useQuery<FacilitySummary[]>({
    queryKey: ["owner-facilities"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/facilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Nepavyko gauti objektų");
      return r.json();
    },
    enabled: !!facilityId,
  });

  const selectedFacility = facilityId
    ? facilitiesQ.data?.find(f => f.id === facilityId)
    : undefined;
  const facilityName = selectedFacility?.name;
  // Mirror the guard used on /owner/facility/:id — only disable once we have the
  // facility loaded and can confirm it has zero courts. While loading, allow the
  // click so the user is not blocked by a stale state.
  const facilityHasNoCourts =
    !!facilityId &&
    !!selectedFacility &&
    ((selectedFacility.courts?.length ?? selectedFacility.courtCount ?? 0) === 0);

  const pending = pendingAll.filter(t =>
    !facilityId || t.facilityId === facilityId
  );

  const respondMutation = useMutation({
    mutationFn: async (vars: { tournamentId: number; decision: "approve" | "reject"; message?: string }) => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/owner/respond-to-tournament`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(vars),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko atsakyti");
      }
      return r.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["owner-tournament-requests"] });
      toast({
        title: vars.decision === "approve" ? "Turnyras patvirtintas" : "Turnyras atmestas",
        description: vars.decision === "approve" ? "Aikštelės tomis dienomis užblokuotos automatiškai." : undefined,
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facilityName} title="Turnyrai">
      <div className="p-4 md:p-8 max-w-5xl">
        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold">Turnyrai</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {facilityId
                ? "Patvirtinkite arba atmeskite šio objekto turnyrų užklausas. Patvirtinus, aikštelės tomis dienomis automatiškai užblokuojamos kasdieniniam rezervavimui."
                : "Kurkite naujus turnyrus arba patvirtinkite kitų organizatorių prašymus rengti turnyrus jūsų aikštynuose. Patvirtinus, aikštelės tomis dienomis automatiškai užblokuojamos kasdieniniam rezervavimui."}
            </p>
          </div>
          {facilityHasNoCourts ? (
            <Button
              size="sm"
              className="gap-2 self-start shrink-0"
              disabled
              title="Pirmiausia sukurkite bent vieną aikštelę šiame objekte."
            >
              <Plus className="w-4 h-4" />
              Naujas turnyras
            </Button>
          ) : (
            <Button asChild size="sm" className="gap-2 self-start shrink-0">
              <Link href={facilityId ? `/owner/tournaments/new?facility=${facilityId}` : "/owner/tournaments/new"}>
                <Plus className="w-4 h-4" />
                Naujas turnyras
              </Link>
            </Button>
          )}
        </div>

        {facilityHasNoCourts && (
          <div className="mb-4 text-sm text-muted-foreground bg-muted/40 p-4 rounded-lg">
            Pirmiausia sukurkite bent vieną aikštelę šiame objekte.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
            <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium">Nėra laukiančių užklausų</p>
            <p className="text-sm text-muted-foreground mt-1">Naujos užklausos pasirodys čia.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(t => (
              <div key={t.id} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <SportPill sport={t.sport} />
                      <span>·</span>
                      <span>{t.facilityName} {t.facilityCity && `(${t.facilityCity})`}</span>
                    </div>
                    <h3 className="font-bold text-lg">{t.name}</h3>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-500/15 text-orange-600 font-medium border border-orange-500/30">
                    <AlertCircle className="w-3 h-3" />
                    Laukia atsakymo
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t.startDate}{t.startDate !== t.endDate && ` – ${t.endDate}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t.maxParticipants} dalyvių</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t.courtIds?.length || 1} aikštel{t.courtIds?.length === 1 ? "ė" : "ės"}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Mokestis: {t.entryFee && t.entryFee > 0 ? `€${t.entryFee}` : "Nemokama"}
                  </div>
                </div>

                {(t.organizerName || t.organizerEmail) && (
                  <div className="text-xs text-muted-foreground mb-3">
                    Organizatorius: <span className="font-medium text-foreground">{t.organizerName ?? t.organizerEmail}</span>
                  </div>
                )}

                {t.description && (
                  <div className="rounded-lg bg-background border border-border p-3 mb-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {t.description}
                  </div>
                )}

                <Separator className="my-3" />

                <div className="space-y-2">
                  <Textarea
                    placeholder="Žinutė organizatoriui (neprivaloma)"
                    value={responseMap[t.id] ?? ""}
                    onChange={e => setResponseMap(m => ({ ...m, [t.id]: e.target.value }))}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => respondMutation.mutate({ tournamentId: t.id, decision: "reject", message: responseMap[t.id] })}
                      disabled={respondMutation.isPending}
                      className="gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Atmesti
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => respondMutation.mutate({ tournamentId: t.id, decision: "approve", message: responseMap[t.id] })}
                      disabled={respondMutation.isPending}
                      className="gap-1.5 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Patvirtinti
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-xs text-muted-foreground">
          <Link href="/tournaments" className="underline hover:text-foreground">Žiūrėti viešą turnyrų sąrašą →</Link>
        </div>
      </div>
    </OwnerLayout>
  );
}
