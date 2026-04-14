import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Mail, Euro, Clock, MapPin, ArrowLeft, User, Dumbbell } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

const DAYS = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];

interface Trainer {
  id: number;
  courtId: number;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  sports: string[];
  hourlyRate: number | null;
  availabilityJson: string | null;
  email: string | null;
  phone: string | null;
}

interface Court {
  id: number;
  name: string;
  city: string;
  address: string;
}

export default function TrainerDetail() {
  const { id } = useParams();
  const trainerId = parseInt(id || "0", 10);

  const { data: trainer, isLoading } = useQuery<Trainer>({
    queryKey: ["trainer", trainerId],
    queryFn: async () => {
      const r = await fetch(`${API}/trainers/${trainerId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !isNaN(trainerId),
  });

  const { data: court } = useQuery<Court>({
    queryKey: ["court", trainer?.courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${trainer!.courtId}`);
      if (!r.ok) throw new Error("Court not found");
      return r.json();
    },
    enabled: !!trainer?.courtId,
  });

  let avail: Record<string, { start: string; end: string }> = {};
  try { avail = trainer?.availabilityJson ? JSON.parse(trainer.availabilityJson) : {}; } catch { /* ignore */ }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    );
  }

  if (!trainer) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Treneris nerastas.</p>
          <Link href="/trainers"><Button variant="outline" className="mt-4">Grįžti į sąrašą</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <Link href="/trainers">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-6 -ml-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Visi treneriai
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="md:col-span-1 space-y-5">
            {/* Photo */}
            <div className="rounded-2xl overflow-hidden border border-border bg-muted aspect-square">
              {trainer.photoUrl ? (
                <img src={trainer.photoUrl} alt={trainer.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-12 h-12 text-primary/60" />
                  </div>
                </div>
              )}
            </div>

            {/* Price */}
            {trainer.hourlyRate != null && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                <Euro className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Kaina už valandą</p>
                  <p className="text-xl font-bold text-primary">€{trainer.hourlyRate}</p>
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">Kontaktai</p>
              {trainer.phone && (
                <a href={`tel:${trainer.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {trainer.phone}
                </a>
              )}
              {trainer.email && (
                <a href={`mailto:${trainer.email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {trainer.email}
                </a>
              )}
              {!trainer.phone && !trainer.email && (
                <p className="text-xs text-muted-foreground">Kontaktinė informacija nenurodyta</p>
              )}
            </div>

            {/* Court */}
            {court && (
              <Link href={`/courts/${court.id}`}>
                <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/60 transition-colors cursor-pointer">
                  <p className="text-xs text-muted-foreground mb-1">Dirba korte</p>
                  <p className="font-semibold text-sm">{court.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {court.city}
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Right column */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">{trainer.name}</h1>
              {trainer.sports.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {trainer.sports.map(s => (
                    <Badge key={s} variant="secondary" className="gap-1.5">
                      <SportIcon sport={s} className="w-3.5 h-3.5" />
                      {SPORT_LABELS[s] ?? s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {trainer.bio && (
              <div className="space-y-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  Apie trenerį
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{trainer.bio}</p>
              </div>
            )}

            {/* Availability */}
            {Object.keys(avail).length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Darbo laikas
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[0,1,2,3,4,5,6].map(d => {
                    const slot = avail[String(d)];
                    return (
                      <div key={d} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${slot ? "bg-primary/5 border-primary/20 text-foreground" : "bg-muted/30 border-transparent text-muted-foreground/50"}`}>
                        <span className="font-medium">{DAYS[d]}</span>
                        {slot ? (
                          <span className="text-xs font-mono">{slot.start} – {slot.end}</span>
                        ) : (
                          <span className="text-xs">Laisva diena</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
              <p className="text-sm font-semibold">Norite rezervuoti treniruotę?</p>
              <p className="text-xs text-muted-foreground">Susisiekite su treneriu tiesiogiai arba rezervuokite kortą.</p>
              <div className="flex flex-wrap gap-2">
                {trainer.phone && (
                  <a href={`tel:${trainer.phone}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      Skambinti
                    </Button>
                  </a>
                )}
                {trainer.email && (
                  <a href={`mailto:${trainer.email}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Rašyti el. laišką
                    </Button>
                  </a>
                )}
                {court && (
                  <Link href={`/courts/${court.id}`}>
                    <Button size="sm" className="gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Rezervuoti kortą
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
