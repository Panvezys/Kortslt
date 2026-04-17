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
import { Calendar, Clock, MapPin, Users, Plus, UserCheck, UserPlus, Trophy, Shield, Lock, Search } from "lucide-react";

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 sm:py-10 max-w-6xl">
        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-border p-6 sm:p-10 mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Rasti žaidimo partnerį</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-2xl">
                Prisijunk prie kitų žaidėjų kuriamų žaidimų arba sukurk savo ir pakviesk partnerius.
              </p>
            </div>
            <Show when="signed-in">
              <Button size="lg" className="shrink-0" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Sukurti žaidimą
              </Button>
            </Show>
            <Show when="signed-out">
              <Button size="lg" asChild className="shrink-0">
                <Link href="/sign-in">Prisijungti, kad sukurtum</Link>
              </Button>
            </Show>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="sm:col-span-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Ieškoti..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger><SelectValue placeholder="Visos sporto šakos"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visos sporto šakos</SelectItem>
              {SPORTS.map(s => <SelectItem key={s} value={s}>{SPORT_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger><SelectValue placeholder="Visi miestai"/></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Visi miestai</SelectItem>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
    </Layout>
  );
}
