import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import {
  CheckCircle2, XCircle, MapPin, Euro, User, Building2,
  CreditCard, ChevronLeft, RefreshCw, Image as ImageIcon,
  Clock, Zap,
} from "lucide-react";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

interface PendingCourt {
  id: number;
  name: string;
  type: string;
  description?: string;
  address: string;
  city: string;
  pricePerHour: number;
  ownerName: string;
  ownerEmail: string;
  imageUrl?: string;
  photos?: string[];
  status: string;
  stripeConnectStatus?: string;
  createdAt: string;
  instantBookingEnabled?: boolean;
}

function CourtCard({
  court,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  court: PendingCourt;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const mainPhoto = court.photos?.[0] ?? court.imageUrl;
  const stripeOk = court.stripeConnectStatus === "active";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Photo strip */}
      <div className="relative h-40 bg-muted">
        {mainPhoto ? (
          <img src={mainPhoto} alt={court.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-30" />
            <span className="text-xs">Nėra nuotraukų</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-bold text-base leading-tight">{court.name}</h3>
          <p className="text-white/70 text-xs mt-0.5">{SPORT_LABELS[court.type] ?? court.type}</p>
        </div>
        {court.photos && court.photos.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
            {court.photos.length} foto
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{court.city}, {court.address}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Euro className="h-3.5 w-3.5 shrink-0" />
            <span>{court.pricePerHour}€/val</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{court.ownerName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{new Date(court.createdAt).toLocaleDateString("lt-LT")}</span>
          </div>
        </div>

        {/* Stripe & instant booking indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${stripeOk ? "text-green-500 bg-green-500/10" : "text-yellow-500 bg-yellow-500/10"}`}>
            <CreditCard className="h-3 w-3" />
            {stripeOk ? "Stripe aktyvus" : "Stripe neprijungtas"}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${court.instantBookingEnabled !== false ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground bg-muted/40"}`}>
            <Zap className="h-3 w-3" />
            {court.instantBookingEnabled !== false ? "Momentinė rez." : "Rankinis patvirtinimas"}
          </span>
          {!mainPhoto && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-orange-500 bg-orange-500/10 font-medium">
              <ImageIcon className="h-3 w-3" />
              Nėra nuotraukų
            </span>
          )}
        </div>

        {court.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{court.description}</p>
        )}

        <Separator />

        {/* Owner email */}
        <p className="text-xs text-muted-foreground">{court.ownerEmail}</p>

        {/* Reject form */}
        {rejectOpen && (
          <div className="space-y-2">
            <Textarea
              placeholder="Atmetimo priežastis (privaloma)…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="text-sm min-h-[70px] resize-none"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                disabled={!rejectReason.trim() || isRejecting}
                onClick={() => { onReject(court.id, rejectReason); setRejectOpen(false); setRejectReason(""); }}
              >
                <XCircle className="h-3.5 w-3.5" />
                Patvirtinti atmetimą
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setRejectOpen(false)}>
                Atšaukti
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!rejectOpen && (
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-1.5 text-xs"
              size="sm"
              disabled={isApproving}
              onClick={() => onApprove(court.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isApproving ? "Tvirtinama…" : "Patvirtinti"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs border-destructive/40 text-destructive hover:bg-destructive/5"
              disabled={isRejecting}
              onClick={() => setRejectOpen(true)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Atmesti
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminApprovalsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: courts = [], isLoading, refetch, isFetching } = useQuery<PendingCourt[]>({
    queryKey: ["admin-pending-courts"],
    queryFn: () => customFetch<PendingCourt[]>(`${API_URL}/admin/courts/pending`),
  });

  const approveMutation = useMutation({
    mutationFn: (courtId: number) =>
      customFetch(`${API_URL}/courts/${courtId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending-courts"] });
      toast({ title: "✓ Aikštelė patvirtinta ir paskelbta" });
    },
    onError: () => toast({ title: "Klaida patvirtinant", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ courtId, reason }: { courtId: number; reason: string }) =>
      customFetch(`${API_URL}/courts/${courtId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "hidden", rejectionReason: reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending-courts"] });
      toast({ title: "Aikštelė atmesta" });
    },
    onError: () => toast({ title: "Klaida atmetant", variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`${BASE_URL}/admin`} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Aikštelių peržiūra</h1>
            <p className="text-sm text-muted-foreground">Savininkai pateikė aikšteles patvirtinimui</p>
          </div>
          <div className="flex items-center gap-3">
            {courts.length > 0 && (
              <span className="bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-full">
                {courts.length} laukia
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Atnaujinti
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Laukia patvirtinimo", value: courts.length, color: "text-amber-500" },
            { label: "Su Stripe", value: courts.filter(c => c.stripeConnectStatus === "active").length, color: "text-green-500" },
            { label: "Be nuotraukų", value: courts.filter(c => !c.imageUrl && (!c.photos || c.photos.length === 0)).length, color: "text-orange-500" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
                <Skeleton className="h-40 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : courts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Viskas patvirtinta!</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Šiuo metu nėra aikštelių, laukiančių peržiūros. Kai savininkai pateiks naujas aikšteles, jos pasirodys čia.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courts.map(court => (
              <CourtCard
                key={court.id}
                court={court}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id, reason) => rejectMutation.mutate({ courtId: id, reason })}
                isApproving={approveMutation.isPending && (approveMutation.variables as number) === court.id}
                isRejecting={rejectMutation.isPending && (rejectMutation.variables as any)?.courtId === court.id}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
