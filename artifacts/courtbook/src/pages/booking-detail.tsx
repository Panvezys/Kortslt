import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { BackButton } from "@/components/back-button";
import {
  CheckCircle2, Calendar, Clock, MapPin, Phone, Mail,
  User, CreditCard, Loader2, XCircle, ExternalLink, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { lt } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface BookingDetail {
  id: number;
  courtId: number;
  courtName?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: "pending" | "confirmed" | "cancelled";
  stripeSessionId?: string | null;
  createdAt: string;
}

interface CourtDetail {
  id: number;
  name: string;
  address: string;
  city: string;
  phone?: string | null;
  ownerEmail?: string | null;
  imageUrl?: string | null;
  type: string;
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "yyyy-MM-dd");
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

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [court, setCourt] = useState<CourtDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const bookingRes = await fetch(`${API}/bookings/${id}`);
        if (!bookingRes.ok) throw new Error("Rezervacija nerasta");
        const bookingData = await bookingRes.json();
        setBooking(bookingData);

        if (bookingData.courtId) {
          const courtRes = await fetch(`${API}/courts/${bookingData.courtId}`);
          if (courtRes.ok) {
            const courtData = await courtRes.json();
            setCourt(courtData);
          }
        }
      } catch (err: any) {
        setError(err.message ?? "Klaida");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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
        <div className="container flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <XCircle className="w-12 h-12 text-destructive" />
          <p className="text-lg font-medium">{error ?? "Rezervacija nerasta"}</p>
          <BackButton to="/bookings" label="Grįžti" />
        </div>
      </Layout>
    );
  }

  const courtName = booking.courtName ?? court?.name ?? `Kortas #${booking.courtId}`;
  const address = court ? `${court.address}, ${court.city}` : null;
  const phone = court?.phone ?? null;
  const email = court?.ownerEmail ?? null;
  const duration = (() => {
    const [sh, sm] = booking.startTime.split(":").map(Number);
    const [eh, em] = booking.endTime.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + (sm ?? 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  })();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Back button */}
        <BackButton to="/bookings" label="Visos rezervacijos" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold">Rezervacija #{booking.id}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{courtName}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Court image */}
        {court?.imageUrl && (
          <div className="rounded-xl overflow-hidden mb-5 h-40 bg-muted">
            <img
              src={court.imageUrl.startsWith("http") ? court.imageUrl : `${BASE}/${court.imageUrl}`}
              alt={courtName}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Booking info card */}
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
            <div>
              <p className="text-xs text-muted-foreground">
                {booking.status === "confirmed" ? "Sumokėta" : "Kaina"}
              </p>
              <p className="text-sm font-medium">
                {booking.totalPrice > 0 ? `€${Number(booking.totalPrice).toFixed(2)}` : "Nemokama"}
              </p>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Rezervavo</p>
              <p className="text-sm font-medium">{booking.customerName}</p>
            </div>
          </div>
        </div>

        {/* Court contact info */}
        {(address || phone || email) && (
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
                  onClick={e => e.stopPropagation()}
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
            {email && (
              <div className="px-4 py-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${email}`} className="text-sm hover:text-primary transition-colors truncate">{email}</a>
              </div>
            )}
          </div>
        )}

        {/* Court link + calendar */}
        <div className="flex gap-3">
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
            onClick={() => window.open(`${API}/bookings/${booking.id}/ics`, "_blank")}
          >
            <Download className="w-4 h-4 mr-2" />
            Pridėti į kalendorių
          </Button>
        </div>
      </div>
    </Layout>
  );
}
