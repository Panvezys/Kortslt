import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { SafeShow as Show } from "@/lib/safeAuth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SportPill, SPORT_LABELS } from "@/components/sport-icon";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import {
  Calendar, Clock, MapPin, Users, Plus, Trophy, Lock, Swords,
  Globe, Zap, Star, Euro, UserCheck,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table-tennis", "volleyball", "hockey", "futsal", "floorball", "beach-volleyball", "golf", "bowling", "pickleball"];
const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena", "Kėdainiai", "Telšiai", "Tauragė", "Ukmergė", "Visaginas", "Plungė", "Kretinga", "Palanga", "Šilutė", "Radviliškis", "Druskininkai", "Rokiškis", "Biržai", "Elektrėnai"];

const SKILL_LABELS: Record<string, string> = {
  any: "Bet koks", beginner: "Pradedantysis", intermediate: "Vidutinis", advanced: "Pažengęs",
};

type FeedKind = "booked" | "casual";

interface FeedItem {
  kind: FeedKind;
  gameId: number;
  sport: string;
  matchType: string;
  visibility: string;
  creatorName: string;
  creatorUserId: string;
  description: string | null;
  datetime: string;
  minSkillLevel: number | null;
  maxSkillLevel: number | null;
  bookingId: number | null;
  token: string | null;
  courtName: string | null;
  courtId: number | null;
  facilityName: string | null;
  facilityCity: string | null;
  courtImageUrl: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  pricePerSlot: number | null;
  totalSlots: number | null;
  paidSlots: number | null;
  slotsLeft: number;
  city: string | null;
  placeName: string | null;
  skillLevel: string | null;
  durationMinutes: number | null;
  joinedCount: number | null;
  playersNeeded: number | null;
  isPrivate: boolean;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("lt-LT", { weekday: "short", month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("lt-LT", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SkillBadge({ min, max }: { min: number | null; max: number | null }) {
  if (min == null && max == null) return null;
  const label = min != null && max != null
    ? `Lygis ${min.toFixed(1)}–${max.toFixed(1)}`
    : min != null ? `Lygis ≥${min.toFixed(1)}`
    : `Lygis ≤${max!.toFixed(1)}`;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/20">
      <Star className="w-3 h-3" />{label}
    </span>
  );
}

function BookedMatchCard({ m }: { m: FeedItem }) {
  const full = m.slotsLeft === 0;
  const total = m.totalSlots ?? 1;
  const paid = m.paidSlots ?? 0;

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all hover:shadow-xl hover:border-primary/50 bg-card ${full ? "opacity-60" : ""}`}>
      <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />

      {m.courtImageUrl && (
        <div className="h-28 overflow-hidden">
          <img src={m.courtImageUrl} alt={m.courtName ?? ""} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SportPill sport={m.sport} variant="subtle" size="sm" />
              {m.matchType === "rated" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-400/20">
                  <Swords className="w-3 h-3" />Reitinginis
                </span>
              )}
              <SkillBadge min={m.minSkillLevel} max={m.maxSkillLevel} />
            </div>
            <p className="font-semibold text-sm truncate">{m.courtName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {m.facilityName}{m.facilityCity ? `, ${m.facilityCity}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-primary">{(m.pricePerSlot ?? 0).toFixed(2)} €</p>
            <p className="text-[10px] text-muted-foreground">/ žaid.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {m.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(m.date)}</span>}
          {m.startTime && m.endTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.startTime}–{m.endTime}</span>}
        </div>

        {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Žaidėjai</span>
            <span className="font-semibold">{paid}/{total}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${Math.round((paid / total) * 100)}%` }} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={`w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-bold ${i < paid ? "bg-primary border-primary text-primary-foreground" : "bg-muted/60 border-border text-muted-foreground"}`}>
                {i < paid ? "✓" : i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t gap-2">
          <p className="text-xs text-muted-foreground truncate">{m.creatorName}</p>
          {full ? (
            <Badge variant="secondary" className="text-xs shrink-0">Užpildyta</Badge>
          ) : m.token ? (
            <Link href={`/join/${m.token}`}>
              <Button size="sm" className="button-primary h-8 px-3 text-xs font-semibold shrink-0 gap-1">
                <Euro className="w-3 h-3" />Prisijungti ir apmokėti
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CasualGameCard({ m }: { m: FeedItem }) {
  const full = m.slotsLeft === 0;
  const joined = m.joinedCount ?? 0;
  const needed = m.playersNeeded ?? 2;
  const isRated = m.matchType === "rated";

  return (
    <Link href={`/games/${m.gameId}`}>
      <div className="group relative rounded-2xl border border-border hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden cursor-pointer bg-card/80">
        <div className={`h-1.5 ${isRated ? "bg-gradient-to-r from-purple-500 to-purple-400" : "bg-gradient-to-r from-emerald-500 to-emerald-400"}`} />

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <SportPill sport={m.sport} variant="subtle" size="sm" />
                {isRated ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-400/20">
                    <Swords className="w-3 h-3" />Reitinginis
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-400/20">
                  Nemokama
                </span>
              </div>
              {m.skillLevel && m.skillLevel !== "any" && (
                <p className="text-xs text-muted-foreground">{SKILL_LABELS[m.skillLevel] ?? m.skillLevel}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Nemokama</p>
              <p className="text-[10px] text-muted-foreground">kortą susiranda patys</p>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">
              {m.creatorName} · {needed} žaidėjams
            </h3>
            {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-primary/70 shrink-0" />
              {formatDateTime(m.datetime)}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
              {m.city}{m.placeName ? ` · ${m.placeName}` : ""}
            </div>
            {m.durationMinutes && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-primary/70 shrink-0" />
                {m.durationMinutes} min
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-primary/70" />
              <span className="font-semibold">{joined}</span>
              <span className="text-muted-foreground">/ {needed}</span>
            </div>
            {full ? (
              <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-xs">Užpildyta</Badge>
            ) : (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30 text-xs">
                {m.slotsLeft} laisv{m.slotsLeft === 1 ? "a vieta" : "ų vietų"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function toMin(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface CourtListItem { id: number; name: string; sport: string; city: string; pricePerHour: string | number; }
interface AvailabilitySlot { startTime: string; endTime: string; available: boolean; price: number; }
interface AvailabilityResp { slots: AvailabilitySlot[]; }
type Venue = "self" | "korts";

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
        if (!courtId || !bookingStart || !bookingEnd) throw new Error("Pasirinkite aikštę ir laiką");
        const successUrl = `${window.location.origin}${BASE}/matches?payment=success`;
        const cancelUrl = `${window.location.origin}${BASE}/matches?payment=cancelled`;
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
      const datetime = new Date(`${form.date}T${form.time}:00`).toISOString();
      const res = await customFetch<{ id: number }>(`${API}/games`, {
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
      return res;
    },
    onSuccess: (result) => {
      if ("redirectUrl" in (result as any)) {
        window.location.href = (result as { redirectUrl: string }).redirectUrl;
        return;
      }
      qc.invalidateQueries({ queryKey: ["open-matches"] });
      toast({ title: "Žaidimas sukurtas!", description: "Galite pasidalinti nuoroda su draugais." });
      onOpenChange(false);
      setLocation(`/games/${(result as { id: number }).id}`);
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
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm(f => ({ ...f, matchType: "casual" }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${form.matchType === "casual" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
              <Trophy className="w-5 h-5" />
              <span className="text-sm font-semibold">Laisvas</span>
              <span className="text-xs text-muted-foreground">ELO nekinta</span>
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, matchType: "rated" }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${form.matchType === "rated" ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-border/80"}`}>
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
                  {SPORTS.map(s => <SelectItem key={s} value={s}>{(SPORT_LABELS as any)[s] ?? s}</SelectItem>)}
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

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setVenue("self"); setCourtId(null); }}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${venue === "self" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
              <MapPin className="w-5 h-5" />
              <span className="text-sm font-semibold">Sava vieta</span>
              <span className="text-xs text-muted-foreground">Susitarta atskirai</span>
            </button>
            <button type="button" onClick={() => setVenue("korts")}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${venue === "korts" ? "border-primary bg-primary/10" : "border-border hover:border-border/80"}`}>
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-semibold">Korts.lt aikštė</span>
              <span className="text-xs text-muted-foreground">Apmokėsite dabar</span>
            </button>
          </div>

          {venue === "korts" && (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
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
                    {availabilityQ.isLoading ? <Skeleton className="h-10 mt-1" /> : (
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
                        {(availabilityQ.data?.slots ?? []).filter(s => bookingStart && toMin(s.endTime) > toMin(bookingStart)).map(s => (
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
                    Apmokėsite visą sumą iš karto. Dalis vienam žaidėjui: <b>€{(selectedRangePrice / Math.max(1, form.playersNeeded)).toFixed(2)}</b>.
                  </p>
                </div>
              )}
            </div>
          )}

          {venue === "self" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" className="mt-1" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Laikas</Label>
                <Input type="time" className="mt-1" value={form.time} onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
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
              <Label className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />Privatus žaidimas</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Nebus rodomas sąraše — tik per pakvietimo nuorodą.</p>
            </div>
            <Switch checked={form.isPrivate} onCheckedChange={(v) => setForm(f => ({ ...f, isPrivate: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Atšaukti</Button>
          <Button onClick={() => create.mutate()}
            disabled={create.isPending || (venue === "korts" && (!courtId || !bookingStart || !bookingEnd))}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            {create.isPending
              ? (venue === "korts" ? "Nukreipiama į Stripe..." : "Kuriama...")
              : (venue === "korts"
                ? `Apmokėti ir sukurti${selectedRangePrice != null ? ` (€${selectedRangePrice.toFixed(2)})` : ""}`
                : "Sukurti žaidimą")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FeedFilter = "all" | "booked" | "casual";

export default function UnifiedMatchesPage() {
  const { user } = useUser();
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [sport, setSport] = useState("all");
  const [city, setCity] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery<{ matches: FeedItem[]; total: number }>({
    queryKey: ["open-matches", sport, city, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sport && sport !== "all") params.set("sport", sport);
      if (city) params.set("city", city);
      if (dateFilter) params.set("date", dateFilter);
      const r = await fetch(`${API}/matches/open?${params.toString()}`);
      if (!r.ok) throw new Error("Nepavyko gauti mačų");
      return r.json();
    },
    staleTime: 30_000,
  });

  const allItems = data?.matches ?? [];

  const filtered = useMemo(() => {
    if (feedFilter === "all") return allItems;
    return allItems.filter(m => m.kind === feedFilter);
  }, [allItems, feedFilter]);

  const bookedCount = allItems.filter(m => m.kind === "booked").length;
  const casualCount = allItems.filter(m => m.kind === "casual").length;

  const TAB_CLS = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
    }`;

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative h-48 sm:h-60 overflow-hidden">
          <img
            src="/coaches/coach_banner_2.webp"
            srcSet="/coaches/coach_banner_2-480.webp 480w, /coaches/coach_banner_2-800.webp 800w, /coaches/coach_banner_2.webp 1200w"
            sizes="100vw"
            alt="Mačai"
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
              <div className="w-9 h-9 rounded-xl bg-primary/20 backdrop-blur-sm border border-primary/30 flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow">Mačai</h1>
            </div>
            <p className="text-white/80 text-sm max-w-xl drop-shadow-sm">
              Prisijunk prie atvirų mačų su kortu arba rask bendruomenės žaidimą. Sukurk savo ir pakvieskite žaidėjus.
            </p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Show when="signed-in">
                <Button size="sm" onClick={() => setCreateOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold border-0">
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

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
          {/* Feed type tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button className={TAB_CLS(feedFilter === "all")} onClick={() => setFeedFilter("all")}>
              Visi {allItems.length > 0 && <span className="ml-1 opacity-60 text-xs">({allItems.length})</span>}
            </button>
            <button className={TAB_CLS(feedFilter === "booked")} onClick={() => setFeedFilter("booked")}>
              <Zap className="w-3.5 h-3.5 inline mr-1" />
              Su kortu {bookedCount > 0 && <span className="ml-1 opacity-60 text-xs">({bookedCount})</span>}
            </button>
            <button className={TAB_CLS(feedFilter === "casual")} onClick={() => setFeedFilter("casual")}>
              <UserCheck className="w-3.5 h-3.5 inline mr-1" />
              Ieško kompanijos {casualCount > 0 && <span className="ml-1 opacity-60 text-xs">({casualCount})</span>}
            </button>
          </div>

          {/* Filters */}
          <div className="bg-card border rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Visos sporto šakos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos sporto šakos</SelectItem>
                  {SPORTS.map(s => <SelectItem key={s} value={s}>{(SPORT_LABELS as any)[s] ?? s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={city || "all"} onValueChange={v => setCity(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Visi miestai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi miestai</SelectItem>
                  {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="h-9 text-sm" />
            </div>

            {(sport !== "all" || city || dateFilter) && (
              <div className="flex justify-end border-t pt-2">
                <button onClick={() => { setSport("all"); setCity(""); setDateFilter(""); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Išvalyti filtrus
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Globe className="w-12 h-12 text-muted-foreground/30" />
              <div>
                <p className="text-lg font-semibold text-muted-foreground">Nėra mačų</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Pabandykite pakeisti filtrus arba sukurkite savo žaidimą.
                </p>
              </div>
              <div className="flex gap-2">
                <Show when="signed-in">
                  <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                    <Plus className="w-4 h-4" />Sukurti žaidimą
                  </Button>
                </Show>
                <Button variant="outline" asChild>
                  <Link href="/courts">Rasti aikštelę</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Rodoma: <span className="font-semibold text-foreground">{filtered.length}</span> mačų
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(m => (
                  m.kind === "booked"
                    ? <BookedMatchCard key={`b-${m.gameId}`} m={m} />
                    : <CasualGameCard key={`c-${m.gameId}`} m={m} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {user && <CreateGameDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </Layout>
  );
}
