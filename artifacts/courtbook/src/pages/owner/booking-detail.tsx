import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { OwnerLayout, useFacilityId } from "@/components/owner-layout";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Clock, User, Mail, Phone, Building2,
  CreditCard, FileText, AlertTriangle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface BookingDetail {
  id: number;
  courtId: number;
  courtName?: string;
  courtSport?: string;
  facilityName?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  bookerUserId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  refundAmount?: number | null;
  status: string;
  notes?: string | null;
  rentedItems?: string | null;
  createdAt: string;
  isSplit?: boolean;
  totalSlots?: number;
  pricePerSlot?: number;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Patvirtinta",
  pending: "Laukiama",
  cancelled: "Atšaukta",
  blocked: "Užblokuota",
  awaiting_players: "Laukiama žaidėjų",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  blocked: "outline",
  awaiting_players: "secondary",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

export default function OwnerBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const facilityId = useFacilityId();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: booking, isLoading, error } = useQuery<BookingDetail>({
    queryKey: ["owner-booking", id],
    queryFn: () => customFetch<BookingDetail>(`${API}/bookings/${id}`),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => customFetch(`${API}/bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Rezervacija atšaukta" });
      queryClient.invalidateQueries({ queryKey: ["owner-booking", id] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
    onError: (e: any) =>
      toast({ title: "Klaida", description: e?.data?.error || e?.message || "Nepavyko atšaukti", variant: "destructive" }),
  });

  const canCancel = booking && ["confirmed", "pending", "blocked", "awaiting_players"].includes(booking.status);
  const isGuest = booking && !booking.bookerUserId;
  const note = booking?.rentedItems ?? booking?.notes ?? null;

  return (
    <OwnerLayout facilityId={facilityId} title="Rezervacija">
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
        <BackButton label="Atgal" historyBack fallbackTo="/owner/dashboard" />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : error || !booking ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Rezervacija nerasta arba prieiga uždrausta.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Rezervacija #{booking.id}</h1>
                {booking.courtName && (
                  <p className="text-sm text-muted-foreground mt-0.5">{booking.courtName}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANTS[booking.status] ?? "outline"} className="mt-1 shrink-0">
                {STATUS_LABELS[booking.status] ?? booking.status}
              </Badge>
            </div>

            {/* Customer info */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Klientas
              </h2>
              <Separator className="my-2" />
              <Row label="Vardas">{booking.customerName}</Row>
              {booking.customerEmail && !booking.customerEmail.startsWith("manual-") && (
                <Row label="El. paštas">
                  <a href={`mailto:${booking.customerEmail}`} className="text-primary hover:underline">
                    {booking.customerEmail}
                  </a>
                </Row>
              )}
              {booking.customerPhone && (
                <Row label="Telefonas">
                  <a href={`tel:${booking.customerPhone}`} className="text-primary hover:underline">
                    {booking.customerPhone}
                  </a>
                </Row>
              )}
              {isGuest && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">Svečio rezervacija (be paskyros)</p>
              )}
            </div>

            {/* Booking info */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Rezervacijos detalės
              </h2>
              <Separator className="my-2" />
              {booking.facilityName && <Row label="Objektas">{booking.facilityName}</Row>}
              {booking.courtName && <Row label="Kortas">{booking.courtName}</Row>}
              <Row label="Data">
                {new Date(booking.date + "T12:00:00").toLocaleDateString("lt-LT", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </Row>
              <Row label="Laikas">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {booking.startTime} – {booking.endTime}
                </span>
              </Row>
              <Row label="Sukurta">
                {new Date(booking.createdAt).toLocaleDateString("lt-LT", {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </Row>
            </div>

            {/* Payment info */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Mokėjimas
              </h2>
              <Separator className="my-2" />
              {booking.isSplit ? (
                <>
                  <Row label="Tipas">Pasidalintas mokėjimas</Row>
                  <Row label="Dalyviai">{booking.totalSlots ?? "—"}</Row>
                  <Row label="Kaina / dalyvis">€{((booking.pricePerSlot ?? 0)).toFixed(2)}</Row>
                </>
              ) : null}
              <Row label="Bendra suma">
                <span className="text-base font-bold">€{booking.totalPrice.toFixed(2)}</span>
              </Row>
              {booking.refundAmount != null && booking.refundAmount > 0 && (
                <Row label="Grąžinta">
                  <span className="text-destructive">−€{booking.refundAmount.toFixed(2)}</span>
                </Row>
              )}
            </div>

            {/* Notes */}
            {note && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Pastaba
                </h2>
                <Separator className="my-2" />
                <p className="text-sm text-foreground">{note.startsWith("Pastaba: ") ? note.slice(9) : note}</p>
              </div>
            )}

            {/* Actions */}
            {canCancel && (
              <Button
                variant="destructive"
                className="w-full"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending
                  ? "Atšaukiama…"
                  : booking.status === "blocked"
                  ? "Atblokuoti laiką"
                  : "Atšaukti rezervaciją"}
              </Button>
            )}
          </>
        )}
      </div>
    </OwnerLayout>
  );
}
