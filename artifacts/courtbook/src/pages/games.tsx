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
import { Calendar, Clock, MapPin, Users, Plus, UserCheck, UserPlus, Trophy, Lock, Search, X, Swords, Shield, Info } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  "table-tennis": "Stalo tenisas", table_tennis: "Stalo tenisas",
  golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
  volleyball: "Tinklinis", hockey: "Ledo ritulys", futsal: "Futsalas",
  floorball: "Florbolai", "beach-volleyball": "Paplūdimio tinklinis",
  pickleball: "Pikliboulas",
};
const SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table-tennis", "volleyball", "hockey", "futsal", "floorball", "beach-volleyball", "golf", "bowling", "pickleball"];

const SKILL_LABELS: Record<string, string> = {
  any: "Bet koks", beginner: "Pradedantysis", intermediate: "Vidutinis", advanced: "Pažengęs",
};

const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena", "Kėdainiai", "Telšiai", "Tauragė", "Ukmergė", "Visaginas", "Plungė", "Kretinga", "Palanga", "Šilutė", "Radviliškis", "Druskininkai", "Rokiškis", "Biržai", "Elektrėnai"];

interface Game {
  id: number; creatorUserId: string; creatorName: string; sport: string; city: string;
  placeName: string | null; playersNeeded: number; skillLevel: string; datetime: string;
  durationMinutes: number; description: string | null; status: string; matchType: string;
  isPrivate: boolean; joinedCount: number; slotsLeft: number; isJoined: boolean; createdAt: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("lt-LT", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toMin(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function tierStyle(elo: number) {
  if (elo >= 1600) return { name: "Diamond", cls: "bg-cyan-500/15 text-cyan-400 border-cyan-400/30" };
  if (elo >= 1400) return { name: "Gold", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-400/30" };
  if (elo >= 1200) return { name: "Silver", cls: "bg-slate-400/15 text-slate-400 border-slate-300/30" };
  return { name: "Bronze", cls: "bg-orange-700/15 text-orange-600 border-orange-500/30" };
}

function GameCard({ g }: { g: Game }) {
  const full = g.slotsLeft === 0;
  const isRated = g.matchType === "rated";
  return (
    <Link href={`/games/${g.id}`}>
      <div className="group relative rounded-2xl border border-border hover:border-primary/50 hover:shadow-xl transition-all overflow-hidden cursor-pointer bg-card">
        {/* Top accent */}
        <div className={`h-1.5 ${isRated ? "bg-gradient-to-r from-purple-500 to-purple-400" : full ? "bg-orange-500/60" : "bg-gradient-to-r from-[#C5E041] to-[#C5E041]/60"}`} />

        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)" }}
              >
                <SportIcon sport={g.sport} className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground font-medium">{SPORT_LABELS[g.sport] ?? g.sport}</div>
                <div className="text-xs text-muted-foreground">{SKILL_LABELS[g.skillLevel]}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {isRated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-purple-500/15 text-purple-400 border-purple-400/30">
                  <Swords className="w-3 h-3"/>Reit.
                </span>
              )}
              {g.isJoined && (
                <Badge className="bg-primary/15 text-primary border-primary/30 text-xs"><UserCheck className="w-3 h-3 mr-1"/>Prisijungęs</Badge>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
              {g.creatorName} · {g.playersNeeded} žaidėjams
            </h3>
            {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary/70"/>{formatDateTime(g.datetime)}</div>
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary/70"/>{g.city}{g.placeName ? ` · ${g.placeName}` : ""}</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary/70"/>{g.durationMinutes} min</div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-primary/70" />
              <span className="font-semibold">{g.joinedCount}</span>
              <span className="text-muted-foreground">/ {g.playersNeeded}</span>
            </div>
            {full ? (
              <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30">Užpildyta</Badge>
            ) : (
              <Badge className="bg-[#C5E041]/15 text-[#8aa72e] border-[#C5E041]/30">
                {g.slotsLeft} laisv{g.slotsLeft === 1 ? "a vieta" : "ų vietų"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

type Venue = "self" | "korts";
interface CourtListItem { id: number; name: string; sport: string; city: string; pricePerHour: string | number; }
interface AvailabilitySlot { startTime: string; endTime: string; available: boolean; price: number; }
interface AvailabilityResp { slots: AvailabilitySlot[]; }

function CreateGameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [venue, setVenue] = useState<Venue>("self");
  const [courtId, setCourtId] = useState<number | null>(null);
  const [bookingStart, setBookingStart] = useState<string>("");
  const [bookingEnd, setBookingEnd] = useState<string>("");

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
    matchType: "casual" as "casual" | "rated",
  });

  // ─── Korts.lt mode: fetch courts filtered by sport+city, then availability ──
  const courtsQ = useQuery<CourtListItem[]>({
    queryKey: ["courts-for-game", form.sport, form.city],
    queryFn: () => customFetch<CourtListItem[]>(`${API}/courts?sport=${encodeURIComponent(form.sport)}&city=${encodeURIComponent(form.city)}`),
    enabled: venue === "korts" && open,
  });

  const availabilityQ = useQuery<AvailabilityResp>({
    queryKey: ["court-availability-for-game", courtId, form.date],
    queryFn: () => customFetch<AvailabilityResp>(`${API}/courts/${courtId}/availability?date=${form.date}`),
    enabled: venue === "korts" && courtId != null && open,
  });

  // Derived: total price for the selected slot range
  const selectedRangePrice = (() => {
    if (venue !== "korts" || !bookingStart || !bookingEnd || !availabilityQ.data) return null;
    const startM = toMin(bookingStart), endM = toMin(bookingEnd);
    let total = 0;
    for (const s of availabilityQ.data.slots) {
      const sM = toMin(s.startTime);
      if (sM >= startM && sM < endM) total += Number(s.price ?? 0);
    }
    return total;
  })();

  const create = useMutation({
    mutationFn: async () => {
      if (venue === "korts") {
        // ─── Host-Pays-All checkout flow → redirect to Stripe ──
        if (!courtId || !bookingStart || !bookingEnd) throw new Error("Pasirinkite aikštę ir laiką");
        const successUrl = `${window.location.origin}${BASE}/games?payment=success`;
        const cancelUrl = `${window.location.origin}${BASE}/games?payment=cancelled`;
        const resp = await customFetch<{ checkoutUrl: string; gameId: number; bookingId: number }>(`${API}/games/checkout`, {
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
            durationMinutes: toMin(bookingEnd) - toMin(bookingStart),
            description: form.description || null,
            isPrivate: form.isPrivate,
            matchType: form.matchType,
            courtId,
            bookingDate: form.date,
            bookingStart,
            bookingEnd,
            successUrl,
            cancelUrl,
          }),
        });
        return { redirectUrl: resp.checkoutUrl } as { redirectUrl: string };
      }

      // ─── Self-venue (existing flow) ──
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
          matchType: form.matchType,
        }),
      });
      return res as Game;
    },
    onSuccess: (result) => {
      if ("redirectUrl" in (result as any)) {
        window.location.href = (result as { redirectUrl: string }).redirectUrl;
        return;
      }
      const g = result as Game;
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
          {/* Match type selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, matchType: "casual" }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                form.matchType === "casual"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-border/80"
              }`}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-sm font-semibold">Laisvas</span>
              <span className="text-xs text-muted-foreground">ELO nekinta</span>
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, matchType: "rated" }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                form.matchType === "rated"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-border hover:border-border/80"
              }`}
            >
              <Swords className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-semibold">Reitinginis</span>
              <span className="text-xs text-muted-foreground">ELO keisis</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sporto šaka</Label>
              <Select value={form.sport} onValueChange={(v) => setForm(f => ({ ...f, sport: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
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
              <Select value={form.city} onValueChange={(v) => { setForm(f => ({ ...f, city: v })); setCourtId(null); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vieta</Label>
              {venue === "self" ? (
                <Input className="mt-1" placeholder="pvz. Forum Palace aikštelės" value={form.placeName}
                  onChange={(e) => setForm(f => ({ ...f, placeName: e.target.value }))} />
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Pasirinkite Korts.lt aikštę žemiau.</p>
              )}
            </div>
          </div>

          {/* ─── Venue toggle: Self-organised vs Korts.lt court (Host-Pays-All) ─── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setVenue("self"); setCourtId(null); }}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                venue === "self" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"
              }`}
            >
              <MapPin className="w-5 h-5" />
              <span className="text-sm font-semibold">Sava vieta</span>
              <span className="text-xs text-muted-foreground">Susitarta atskirai</span>
            </button>
            <button
              type="button"
              onClick={() => setVenue("korts")}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                venue === "korts" ? "border-[#C5E041] bg-[#C5E041]/10" : "border-border hover:border-border/80"
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-semibold">Korts.lt aikštė</span>
              <span className="text-xs text-muted-foreground">Apmokėsite dabar</span>
            </button>
          </div>

          {venue === "korts" && (
            <div className="space-y-3 rounded-lg border border-[#C5E041]/40 bg-[#C5E041]/5 p-3">
              <div>
                <Label>Aikštė</Label>
                {courtsQ.isLoading ? (
                  <Skeleton className="h-10 mt-1" />
                ) : (courtsQ.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Nėra aikščių pasirinktam sportui ir miestui.</p>
                ) : (
                  <Select value={courtId ? String(courtId) : ""} onValueChange={(v) => { setCourtId(parseInt(v, 10)); setBookingStart(""); setBookingEnd(""); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Pasirinkite aikštę" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {courtsQ.data!.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} — €{Number(c.pricePerHour).toFixed(2)}/h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {courtId != null && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pradžia</Label>
                    {availabilityQ.isLoading ? (
                      <Skeleton className="h-10 mt-1" />
                    ) : (
                      <Select value={bookingStart} onValueChange={(v) => { setBookingStart(v); if (bookingEnd && toMin(bookingEnd) <= toMin(v)) setBookingEnd(""); }}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="--:--" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(availabilityQ.data?.slots ?? []).filter(s => s.available).map(s => (
                            <SelectItem key={s.startTime} value={s.startTime}>{s.startTime}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>Pabaiga</Label>
                    <Select value={bookingEnd} onValueChange={setBookingEnd} disabled={!bookingStart}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="--:--" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {(availabilityQ.data?.slots ?? [])
                          .filter(s => bookingStart && toMin(s.endTime) > toMin(bookingStart))
                          .map(s => (
                            <SelectItem key={s.endTime} value={s.endTime}>{s.endTime}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedRangePrice != null && (
                <div className="rounded-md bg-background/60 border border-border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Aikštės kaina:</span>
                    <span className="font-bold">€{selectedRangePrice.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apmokėsite visą sumą iš karto. Dalis tenkanti vienam žaidėjui: <b>€{(selectedRangePrice / Math.max(1, form.playersNeeded)).toFixed(2)}</b>.
                  </p>
                </div>
              )}
            </div>
          )}

          {venue === "self" && (
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
          )}

          {venue === "korts" && (
            <div>
              <Label>Data</Label>
              <Input type="date" className="mt-1" value={form.date}
                onChange={(e) => { setForm(f => ({ ...f, date: e.target.value })); setBookingStart(""); setBookingEnd(""); }} />
            </div>
          )}
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
          <Button onClick={() => create.mutate()} disabled={create.isPending || (venue === "korts" && (!courtId || !bookingStart || !bookingEnd))}
            className="bg-[#C5E041] text-[#132D4C] hover:bg-[#d4ee56] font-bold">
            {create.isPending ? (venue === "korts" ? "Nukreipiama į Stripe..." : "Kuriama...") : (venue === "korts" ? `Apmokėti ir sukurti${selectedRangePrice != null ? ` (€${selectedRangePrice.toFixed(2)})` : ""}` : "Sukurti žaidimą")}
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
  const [matchTypeFilter, setMatchTypeFilter] = useState<"all" | "casual" | "rated">("all");
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
    if (matchTypeFilter !== "all" && g.matchType !== matchTypeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return g.creatorName.toLowerCase().includes(s) || g.city.toLowerCase().includes(s) ||
      (g.placeName ?? "").toLowerCase().includes(s) || (g.description ?? "").toLowerCase().includes(s);
  });

  const activeFilters = (sport !== "all" ? 1 : 0) + (city !== "all" ? 1 : 0) + (search ? 1 : 0) + (matchTypeFilter !== "all" ? 1 : 0);
  const resetFilters = () => { setSearch(""); setSport("all"); setCity("all"); setMatchTypeFilter("all"); };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative h-52 sm:h-64 md:h-72 overflow-hidden">
          <img
            src="/coaches/coach_banner_2.webp"
            srcSet="/coaches/coach_banner_2-480.webp 480w, /coaches/coach_banner_2-800.webp 800w, /coaches/coach_banner_2.webp 1200w"
            sizes="100vw"
            alt="Partneriai"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1200}
            height={655}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(19,45,76,0.4), rgba(19,45,76,0.3), rgba(19,45,76,0.85))" }} />
          <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 pb-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#C5E041]/20 backdrop-blur-sm border border-[#C5E041]/30 flex items-center justify-center">
                <Trophy className="w-4.5 h-4.5 text-[#C5E041]" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">Žaidimai</h1>
            </div>
            <p className="text-white/80 text-sm sm:text-base max-w-xl drop-shadow-sm">
              Prisijunk prie kitų žaidėjų kuriamų žaidimų arba sukurk savo. Reitinginiai žaidimai keičia jūsų ELO.
            </p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Show when="signed-in">
                <Button size="sm" onClick={() => setCreateOpen(true)}
                  className="bg-[#C5E041] text-[#132D4C] hover:bg-[#d4ee56] font-bold border-0">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Sukurti žaidimą
                </Button>
              </Show>
              <Show when="signed-out">
                <Button size="sm" asChild className="backdrop-blur-sm bg-white/20 hover:bg-white/30 text-white border border-white/30">
                  <Link href="/sign-in">Prisijungti, kad sukurtum</Link>
                </Button>
              </Show>
              <Button size="sm" asChild variant="outline" className="backdrop-blur-sm bg-white/10 hover:bg-white/20 text-white border border-white/30">
                <Link href="/games/guide">
                  <Info className="w-3.5 h-3.5 mr-1.5" />Kaip tai veikia?
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          {/* Sticky filter bar */}
          <div className="sticky top-[6.5rem] z-30 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9 h-9 text-sm" placeholder="Ieškoti..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Visos sporto šakos"/></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Visos sporto šakos</SelectItem>
                  {SPORTS.map(s => <SelectItem key={s} value={s}>{SPORT_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Visi miestai"/></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Visi miestai</SelectItem>
                  {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={matchTypeFilter} onValueChange={(v) => setMatchTypeFilter(v as any)}>
                  <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Tipas"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Visi tipai</SelectItem>
                    <SelectItem value="casual">Laisvi</SelectItem>
                    <SelectItem value="rated">Reitinginiai</SelectItem>
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

          {/* Stats strip */}
          {(games?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#C5E041]"/>
                {filtered.length} žaidim{filtered.length === 1 ? "as" : "ų"}
              </span>
              {games?.filter(g => g.matchType === "rated").length ? (
                <span className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-purple-400"/>
                  {games.filter(g => g.matchType === "rated").length} reitinginių
                </span>
              ) : null}
            </div>
          )}

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
                <Button onClick={() => setCreateOpen(true)}
                  className="bg-[#C5E041] text-[#132D4C] hover:bg-[#d4ee56] font-bold">
                  <Plus className="w-4 h-4 mr-2"/>Sukurti žaidimą
                </Button>
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
