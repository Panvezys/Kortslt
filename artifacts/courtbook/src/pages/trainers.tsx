import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Mail, Clock, Euro, Search, User, Dumbbell } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

const DAYS_SHORT = ["Sek", "Pir", "Ant", "Tre", "Ket", "Pen", "Šeš"];

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

function TrainerCard({ trainer }: { trainer: Trainer }) {
  let avail: Record<string, { start: string; end: string }> = {};
  try { avail = trainer.availabilityJson ? JSON.parse(trainer.availabilityJson) : {}; } catch { /* ignore */ }
  const activeDays = Object.keys(avail).map(Number).sort();

  return (
    <Link href={`/trainers/${trainer.id}`}>
      <div className="group rounded-2xl border border-border bg-card hover:border-primary/60 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer">
        {/* Photo / avatar */}
        <div className="relative h-44 bg-gradient-to-br from-muted to-muted/60 overflow-hidden">
          {trainer.photoUrl ? (
            <img src={trainer.photoUrl} alt={trainer.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-10 h-10 text-primary/60" />
              </div>
            </div>
          )}
          {trainer.hourlyRate != null && (
            <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-sm font-semibold">
              <Euro className="w-3.5 h-3.5 text-primary" />
              {trainer.hourlyRate}/val
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-base leading-tight">{trainer.name}</h3>
            {trainer.bio && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{trainer.bio}</p>
            )}
          </div>

          {/* Sports */}
          {trainer.sports.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trainer.sports.slice(0, 3).map(s => (
                <Badge key={s} variant="secondary" className="gap-1 text-xs px-2 py-0.5">
                  <SportIcon sport={s} className="w-3 h-3" />
                  {SPORT_LABELS[s] ?? s}
                </Badge>
              ))}
              {trainer.sports.length > 3 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">+{trainer.sports.length - 3}</Badge>
              )}
            </div>
          )}

          {/* Availability */}
          {activeDays.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex gap-1">
                {[0,1,2,3,4,5,6].map(d => (
                  <span key={d} className={`text-[10px] font-medium px-1 py-0.5 rounded ${activeDays.includes(d) ? "bg-primary/20 text-primary" : "text-muted-foreground/40"}`}>
                    {DAYS_SHORT[d]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="flex gap-3 text-xs text-muted-foreground">
            {trainer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{trainer.phone}</span>}
            {trainer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> El. paštas</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TrainersPage() {
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");

  const { data: trainers = [], isLoading } = useQuery<Trainer[]>({
    queryKey: ["trainers"],
    queryFn: async () => {
      const r = await fetch(`${API}/trainers`);
      if (!r.ok) throw new Error("Failed to load trainers");
      return r.json();
    },
  });

  const filtered = trainers.filter(t => {
    const matchSport = sport === "all" || t.sports.includes(sport);
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    return matchSport && matchSearch;
  });

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Treneriai</h1>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Raskite profesionalų trenerį savo sporto šakai. Individualios pamokos, grupiniai užsiėmimai ir personalizuotas treniravimasis.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ieškoti trenerio..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Sporto šaka" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visos sporto šakos</SelectItem>
                {Object.entries(SPORT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Kraunama..." : `Rasta ${filtered.length} trenerių`}
          </p>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Trenerių nerasta</p>
              <p className="text-sm mt-1">Pabandykite pakeisti filtrus</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map(t => <TrainerCard key={t.id} trainer={t} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
