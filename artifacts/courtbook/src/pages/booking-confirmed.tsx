import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { CheckCircle2, Calendar, Clock, ArrowRight, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface BookingInfo {
  id: number;
  courtName?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  customerName: string;
  status: string;
}

function formatBookingDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "yyyy-MM-dd");
}

export default function BookingConfirmed() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("id");
  const sessionId = params.get("session_id");

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    try { sessionStorage.removeItem("stripeCancel_pending"); } catch { /* ignore */ }
    const confirm = async () => {
      try {
        if (sessionId && !sessionId.startsWith("mock_")) {
          // Confirm Stripe payment
          const r = await fetch(`${API}/payments/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (!r.ok) throw new Error("Payment confirmation failed");
          const data = await r.json();
          setBooking(data);
        } else if (bookingId) {
          // Free booking or mock — just fetch booking details
          const r = await fetch(`${API}/bookings/${bookingId}`);
          if (r.ok) {
            const data = await r.json();
            setBooking({ ...data, totalPrice: Number(data.totalPrice ?? 0) });
          }
        }
        // Refresh dependent caches so the user's bookings list, court activity,
        // and availability all reflect the new booking immediately.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
          queryClient.invalidateQueries({ queryKey: ["court-activity"] }),
          queryClient.invalidateQueries({ predicate: (q) => {
            const k = q.queryKey?.[0];
            return typeof k === "string" && k.includes("/availability");
          } }),
        ]);
        setState("success");
      } catch {
        setState("error");
      }
    };
    confirm();
  }, []);

  return (
    <Layout>
      <div className="container flex items-center justify-center min-h-[70vh] px-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-xl space-y-6">

          {state === "loading" && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Apdorojamas mokėjimas…</h1>
                <p className="text-muted-foreground text-sm">Prašome palaukti</p>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-destructive" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Mokėjimas nepavyko</h1>
                <p className="text-muted-foreground text-sm">Bandykite dar kartą arba susisiekite su mumis.</p>
              </div>
              <Button onClick={() => setLocation("/courts")} className="w-full">
                Grįžti į aikštelių sąrašą
              </Button>
            </>
          )}

          {state === "success" && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold mb-2">Rezervacija patvirtinta!</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {booking?.totalPrice && booking.totalPrice > 0
                    ? `Mokėjimas €${booking.totalPrice.toFixed(2)} gautas sėkmingai.`
                    : "Jūsų aikštelės rezervacija sėkmingai patvirtinta."}
                  {" "}Patvirtinimo laiškas išsiųstas jūsų el. paštu.
                </p>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 flex flex-col gap-2.5 text-sm text-left">
                {booking?.courtName && (
                  <div className="flex items-center gap-2 font-medium">
                    <span>🏟️</span>
                    <span>{booking.courtName}</span>
                  </div>
                )}
                {booking?.date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{formatBookingDate(booking.date)}</span>
                  </div>
                )}
                {booking?.startTime && booking?.endTime && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{booking.startTime} – {booking.endTime}</span>
                  </div>
                )}
                {booking?.totalPrice != null && booking.totalPrice > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>💳</span>
                    <span>Sumokėta: €{booking.totalPrice.toFixed(2)}</span>
                  </div>
                )}
                {!booking?.date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>Patikrinkite savo el. paštą dėl detalių</span>
                  </div>
                )}
              </div>

              {/* Test card reminder */}
              {sessionId && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-600 dark:text-yellow-400 text-left">
                  🔑 <strong>Sandbox režimas:</strong> Naudotas testavimo mokėjimas. Realūs pinigai nenurašyti.
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={() => setLocation("/bookings")} className="flex-1 gap-2">
                  Mano rezervacijos
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => setLocation("/courts")} className="flex-1">
                  Ieškoti aikštelių
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
