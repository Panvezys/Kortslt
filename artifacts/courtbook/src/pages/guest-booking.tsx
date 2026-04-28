// Public page for guest-booking management. Authorized purely by knowledge of the
// opaque token in the URL — no Clerk session is required. Mirrors the auth'd
// /bookings/:id detail page so the visual experience is consistent for guests.

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  CheckCircle2, Calendar, Clock, ArrowLeft, MapPin, Phone, Mail,
  User, CreditCard, Loader2, XCircle, ExternalLink, Download, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { lt } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface GuestBooking {
  id: number;
  courtId: number;
  courtName?: string;
  courtAddress?: string;
  courtCity?: string;
  courtPhone?: string;
  courtImageUrl?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: "pending" | "confirmed" | "cancelled";
  refundAmount: number;
  rentedItems?: string;
  createdAt: string;
}

interface RefundPreview {
  bookingId: number;
  totalPrice: number;
  hoursBeforeStart: number;
  refundPercent: number;
  refundAmount: number;
  refundable: boolean;
  canCancel: boolean;
  reason?: string;
}

function formatDateLong(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "EEEE, yyyy-MM-dd", { locale: lt });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-green-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Patvirtinta</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"><Clock className="w-3 h-3 mr-1" />Laukiama</Badge>;
    case "cancelled":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Atšaukta</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function GuestBooking() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [booking, setBooking] = useState<GuestBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation modal state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const reload = async () => {
    try {
      const r = await fetch(`${API}/guest/bookings/${encodeURIComponent(token)}`);
      if (r.status === 404) throw new Error("Rezervacija nerasta arba nuoroda nebegalioja");
      if (!r.ok) throw new Error("Nepavyko įkelti rezervacijos");
      const data = await r.json();
      setBooking(data);
    } catch (err: any) {
      setError(err.message ?? "Klaida");
    } finally {
      setLoading(false);
    }
  };

  // After Stripe redirects back to ?session_id=cs_xxx, eagerly call /payments/confirm
  // so the booking flips from `pending` to `confirmed` immediately instead of waiting
  // for the webhook. This mirrors the auth'd /booking-confirmed flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    let cancelled = false;

    (async () => {
      if (sessionId) {
        try {
          await fetch(`${API}/payments/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
        } catch {
          // The webhook will still confirm — best-effort only.
        }
        if (!cancelled) {
          // Strip the query params so a refresh doesn't re-confirm.
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
      if (!cancelled) await reload();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openCancelDialog = async () => {
    setCancelOpen(true);
    setPreviewLoading(true);
    try {
      const r = await fetch(`${API}/guest/bookings/${encodeURIComponent(token)}/refund-preview`);
      if (!r.ok) throw new Error("preview failed");
      setRefundPreview(await r.json());
    } catch {
      setRefundPreview(null);
      toast({ title: "Nepavyko gauti grąžinimo informacijos", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const r = await fetch(`${API}/guest/bookings/${encodeURIComponent(token)}/cancel`, { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || "Atšaukti nepavyko");
      }
      const refunded = (refundPreview?.refundAmount ?? 0) > 0;
      toast({
        title: "Rezervacija atšaukta",
        description: refunded
          ? `Grąžinta ${refundPreview!.refundAmount.toFixed(2)} € — pinigai grįš per 5–10 d.d.`
          : "Pagal politiką pinigai negrąžinami.",
      });
      setCancelOpen(false);
      await reload();
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message ?? "Bandykite dar kartą.", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !booking) {
    return (
      <Layout>
        <div className="container flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <XCircle className="w-12 h-12 text-destructive" />
          <p className="text-lg font-medium">{error ?? "Rezervacija nerasta"}</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Patikrinkite, ar nuoroda nukopijuota teisingai. Nuoroda yra Jūsų patvirtinimo el. laiške.
          </p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Į pradžią
          </Button>
        </div>
      </Layout>
    );
  }

  const courtName = booking.courtName ?? `Kortas #${booking.courtId}`;
  const address = booking.courtAddress && booking.courtCity ? `${booking.courtAddress}, ${booking.courtCity}` : null;
  const phone = booking.courtPhone ?? null;
  const duration = (() => {
    const [sh, sm] = booking.startTime.split(":").map(Number);
    const [eh, em] = booking.endTime.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + (sm ?? 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  })();

  const canCancel = booking.status !== "cancelled";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs text-muted-foreground">
          <User className="w-3 h-3" /> Svečio rezervacija
        </div>

        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold">Rezervacija #{booking.id}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{courtName}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {booking.courtImageUrl && (
          <div className="rounded-xl overflow-hidden mb-5 h-40 bg-muted">
            <img
              src={booking.courtImageUrl.startsWith("http") ? booking.courtImageUrl : `${BASE}/${booking.courtImageUrl}`}
              alt={courtName}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Booking info */}
        <div className="bg-card border rounded-xl divide-y divide-border overflow-hidden mb-4">
          <div className="px-4 py-3 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p className="text-sm font-medium capitalize">{formatDateLong(booking.date)}</p>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Laikas</p>
              <p className="text-sm font-medium">{booking.startTime} – {booking.endTime} <span className="text-muted-foreground font-normal">({duration})</span></p>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {booking.status === "confirmed" ? "Sumokėta" : booking.status === "cancelled" ? "Buvo sumokėta" : "Kaina"}
              </p>
              <p className="text-sm font-medium">
                {booking.totalPrice > 0 ? `€${Number(booking.totalPrice).toFixed(2)}` : "Nemokama"}
                {booking.status === "cancelled" && booking.refundAmount > 0 && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">grąžinta €{booking.refundAmount.toFixed(2)}</span>
                )}
              </p>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Rezervavo</p>
              <p className="text-sm font-medium">{booking.customerName}</p>
              <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
            </div>
          </div>
        </div>

        {(address || phone) && (
          <div className="bg-card border rounded-xl divide-y divide-border overflow-hidden mb-4">
            <div className="px-4 py-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aikštelės kontaktai</p>
            </div>
            {address && (
              <div className="px-4 py-3 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{address}</p>
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
            {phone && (
              <div className="px-4 py-3 flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`tel:${phone}`} className="text-sm hover:text-primary transition-colors">{phone}</a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mb-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setLocation(`/courts/${booking.courtId}`)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Aikštelės puslapis
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.open(`${API}/guest/bookings/${encodeURIComponent(token)}/ics`, "_blank")}
          >
            <Download className="w-4 h-4 mr-2" />
            Į kalendorių
          </Button>
        </div>

        {canCancel && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={openCancelDialog}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Atšaukti rezervaciją
          </Button>
        )}
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Atšaukti rezervaciją?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Skaičiuojama grąžinama suma…
                  </div>
                ) : refundPreview ? (
                  <>
                    <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Apmokėta suma</span>
                        <span className="font-medium">€{refundPreview.totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Iki rezervacijos</span>
                        <span className="font-medium">{refundPreview.hoursBeforeStart.toFixed(1)} val.</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="text-muted-foreground">Grąžinama</span>
                        <span className={refundPreview.refundAmount > 0 ? "font-bold text-green-600 dark:text-green-400" : "font-bold text-destructive"}>
                          €{refundPreview.refundAmount.toFixed(2)} ({refundPreview.refundPercent}%)
                        </span>
                      </div>
                    </div>
                    {refundPreview.refundAmount === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Likus mažiau nei 24 val. iki rezervacijos pinigai negrąžinami.
                      </p>
                    )}
                    {refundPreview.refundAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Pinigai į Jūsų kortelę grįš per 5–10 darbo dienų.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-destructive">Nepavyko gauti grąžinimo informacijos.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Grįžti</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmCancel(); }}
              disabled={cancelling || previewLoading || (refundPreview != null && !refundPreview.canCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Patvirtinti atšaukimą
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
