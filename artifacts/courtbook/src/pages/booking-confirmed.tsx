import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { Layout } from "@/components/layout";
import { CheckCircle2, Calendar, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BookingConfirmed() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const dateValue = searchParams.get("date");
  const formattedDate = dateValue ? format(parseISO(dateValue), "yyyy-MM-dd") : null;

  return (
    <Layout>
      <div className="container flex items-center justify-center min-h-[70vh] px-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-xl space-y-6">

          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold mb-2">Rezervacija patvirtinta!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Jūsų korto rezervacija sėkmingai patvirtinta. Patvirtinimo laiškas išsiųstas jūsų el. paštu.
            </p>
          </div>

          <div className="bg-muted/40 rounded-xl p-4 flex flex-col gap-2 text-sm text-left">
            {formattedDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Data {formattedDate}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Patikrinkite savo el. paštą dėl detalių</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Laiškas turėtų pasirodyti per kelias minutes</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setLocation("/bookings")} className="flex-1 gap-2">
              Mano rezervacijos
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setLocation("/courts")} className="flex-1">
              Ieškoti kortų
            </Button>
          </div>

        </div>
      </div>
    </Layout>
  );
}
