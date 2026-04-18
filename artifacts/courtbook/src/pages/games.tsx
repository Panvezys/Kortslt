import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useUser, Show } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SportIcon } from "@/components/sport-icon";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { Calendar, Clock, MapPin, Users, Plus, UserCheck, UserPlus, Trophy, Shield, Lock, Search, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};
const SPORTS = Object.keys(SPORT_LABELS);

const SKILL_LABELS: Record<string, string> = {
  any: "Bet koks", beginner: "Pradedantysis", intermediate: "Vidutinis", advanced: "Pažengęs",
};

const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena", "Kėdainiai", "Telšiai", "Tauragė", "Ukmergė", "Visaginas", "Plungė", "Kretinga", "Palanga", "Šilutė", "Radviliškis", "Druskininkai", "Rokiškis", "Biržai", "Elektrėnai"];

interface Game {
  id: number;
  creatorUserId: string;
  creatorName: string;
  sport: string;
  city: string;
  placeName: string | null;
  playersNeeded: number;
  skillLevel: string;
  datetime: string;
  durationMinutes: number;
  description: string | null;
  status: string;
  isPrivate: boolean;
  joinedCount: number;
  slotsLeft: number;
  isJoined: boolean;
  createdAt: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("lt-LT", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function GameCard({ g }: { g: Game }) {
  const full = g.slotsLeft === 0;
  return (
    <Link href={`/games/${g.id}`}>
      <div className="group rounded-2xl border border-border bg-card hover:border-primary/60 hover:shadow-lg transition-all overflow-hidden cursor-pointer">
        <div className={`h-1.5 ${full ? "bg-orange-500/60" : "bg-gradient-to-r from-primary to-primary/60"}`} />
        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <SportIcon sport={g.sport} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{SPORT_LABELS[g.sport] ?? g.sport}</div>
                <div className="text-xs font-medium text-muted-foreground">{SKILL_LABELS[g.skillLevel]}</div>
              </div>
            </div>
            {g.isJoined && (
              <Badge className="bg-primary/15 text-primary border-primary/30 text-xs"><UserCheck className="w-3 h-3 mr-1"/>Prisijungęs</Badge>
            )}
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
              {g.creatorName} · {g.playersNeeded} žaidėjams
            </h3>
            {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary"/>{formatDateTime(g.datetime)}</div>
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary"/>{g.city}{g.placeName ? ` · ${g.placeName}` : ""}</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary"/>{g.durationMinutes} min</div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-semibold">{g.joinedCount}</span>
              <span className="text-muted-foreground">/ {g.playersNeeded}</span>
            </div>
            {full ? (
              <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30">Užpildyta</Badge>
            ) : (
              <Badge className="bg-green-500/15 text-green-500 border-green-500/30">
                {g.slotsLeft} laisv{g.slotsLeft === 1 ? "a vieta" : "ų vietų"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CreateGameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState({
    sport: "tennis",
    city: "Vilnius",
    placeName: "",
    playersNeeded: 4,
    skillLevel: "any",
    date: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
    time: "18:00",
    durationMinutes: 60,
    description: "",
    isPrivate: false,
  });

  const create = useMutation({
    mutationFn: async () => {
      const datetime = new Date(`${form.date}T${form.time}:00`).toISOString();
      const res = await customFetch<Game>(`${API}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorName: user?.fullName || user?.firstName || "Žaidėjas",
          creatorEmail: user?.emailAddresses[0]?.emailAddress,
          sport: form.sport,
          city: form.city,
          placeName: form.placeName || null,
          playersNeeded: form.playersNeeded,
          skillLevel: form.skillLevel,
          datetime,
          durationMinutes: form.durationMinutes,
          description: form.description || null,
          isPrivate: form.isPrivate,
        }),
      });
      return res;
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["games"] });
      toast({ title: "Žaidimas sukurtas!", description: "Galite pasidalinti nuoroda su draugais." });
      onOpenChange(false);
      setLocation(`/games/${g.id}`);
    },
    onError: (e: any) => {
      toast({ title: "Nepavyko sukurti", description: e?.message ?? "Klaida", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sukurti naują žaidimą</DialogTitle>
          <DialogDescription>Raskite partnerių tarp korts.lt bendruomenės.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sporto šaka</Label>
              <Select value={form.sport} onValueChange={(v) => setForm(f => ({ ...f, sport: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPORTS.map(s => <SelectItem key={s} value={s}>{SPORT_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lygis</Label>
              <Select value={form.skillLevel} onValueChange={(v) => setForm(f => ({ ...f, skillLevel: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SKILL_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Miestas</Label>
              <Select value={form.city} onValueChange={(v) => setForm(f => ({ ...f, city: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vieta (neprivaloma)</Label>
              <Input className="mt-1" placeholder="pvz. Forum Palace aikštelės" value={form.placeName}
                onChange={(e) => setForm(f => ({ ...f, placeName: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" className="mt-1" value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Laikas</Label>
              <Input type="time" className="mt-1" value={form.time}
                onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
            <div>
              <Label>Trukmė (min)</Label>
              <Input type="number" min={30} step={15} className="mt-1" value={form.durationMinutes}
                onChange={(e) => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value || "60", 10) }))} />
            </div>
          </div>
          <div>
            <Label>Žaidėjų skaičius (iš viso)</Label>
            <Input type="number" min={2} max={30} className="mt-1" value={form.playersNeeded}
              onChange={(e) => setForm(f => ({ ...f, playersNeeded: parseInt(e.target.value || "4", 10) }))} />
            <p className="text-xs text-muted-foreground mt-1">Įskaitant jus. Jūs prisijungsite automatiškai.</p>
          </div>
          <div>
            <Label>Aprašymas (neprivaloma)</Label>
            <Textarea className="mt-1" rows={3} placeholder="Apie žaidimą, taisykles, ką atsinešti..." value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5"/>Privatus žaidimas</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Nebus rodomas sąraše — tik per pakvietimo nuorodą.</p>
            </div>
            <Switch checked={form.isPrivate} onCheckedChange={(v) => setForm(f => ({ ...f, isPrivate: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Atšaukti</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Kuriama..." : "Sukurti žaidimą"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GamesPage() {
  const { user } = useUser();
  const [sport, setSport] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ["games", sport, city],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (sport !== "all") p.set("sport", sport);
      if (city !== "all") p.set("city", city);
      const qs = p.toString();
      return customFetch<Game[]>(`${API}/games${qs ? `?${qs}` : ""}`);
    },
  });

  const filtered = (games ?? []).filter(g => {
    if (!search) return true;
    const s = search.toLowerCase();
    return g.creatorName.toLowerCase().includes(s) || g.city.toLowerCase().includes(s) ||
      (g.placeName ?? "").toLowerCase().includes(s) || (g.description ?? "").toLowerCase().includes(s);
  });

  const activeFilters = (sport !== "all" ? 1 : 0) + (city !== "all" ? 1 : 0) + (search ? 1 : 0);
  const resetFilters = () => { setSearch(""); setSport("all"); setCity("all"); };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Photo Hero */}
        <div className="relative h-52 sm:h-64 md:h-72 overflow-hidden">
          <img
            src="/coaches/coach_banner_2.png"
            alt="Partneriai"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />
          <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 pb-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/20 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Users className="w-4.5 h-4.5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">Partneriai</h1>
            </div>
            <p className="text-white/80 text-sm sm:text-base max-w-xl drop-shadow-sm">
              Prisijunk prie kitų žaidėjų kuriamų žaidimų arba sukurk savo ir pakviesk partnerius.
            </p>
            <div className="mt-3 flex gap-2">
              <Show when="signed-in">
                <Button size="sm" onClick={() => setCreateOpen(true)} className="backdrop-blur-sm bg-white/20 hover:bg-white/30 text-white border border-white/30">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Sukurti žaidimą
                </Button>
              </Show>
              <Show when="signed-out">
                <Button size="sm" asChild className="backdrop-blur-sm bg-white/20 hover:bg-white/30 text-white border border-white/30">
                  <Link href="/sign-in">Prisijungti, kad sukurtum</Link>
                </Button>
              </Show>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          {/* Sticky filter bar */}
          <div className="sticky top-[6.5rem] z-30 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9 h-9 text-sm" placeholder="Ieškoti..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Visos sporto šakos"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos sporto šakos</SelectItem>
                  {SPORTS.map(s => <SelectItem key={s} value={s}>{SPORT_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Visi miestai"/></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">Visi miestai</SelectItem>
                    {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {activeFilters > 0 && (
                  <button onClick={resetFilters} className="flex items-center gap-1 px-2.5 h-9 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-border">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Kol kas nėra atvirų žaidimų</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">Būkite pirmas — sukurkite žaidimą ir kvieskite partnerius!</p>
              <Show when="signed-in">
                <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2"/>Sukurti žaidimą</Button>
              </Show>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(g => <GameCard key={g.id} g={g} />)}
            </div>
          )}

          {user && <CreateGameDialog open={createOpen} onOpenChange={setCreateOpen} />}
        </div>
      </div>
    </Layout>
  );
}
