import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SportPill, SPORT_LABELS } from "@/components/sport-icon";
import { Calendar, Clock, MapPin, Users, Euro, Search, Swords, Globe, Zap, Shield, Star, LogIn } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table-tennis", "volleyball", "futsal", "pickleball"];
const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Druskininkai", "Palanga"];

interface OpenMatch {
  gameId: number;
  bookingId: number;
  token: string | null;
  courtName: string;
  courtId: number | null;
  facilityName: string;
  facilityCity: string;
  courtImageUrl: string | null;
  date: string;
  startTime: string;
  endTime: string;
  sport: string;
  matchType: string;
  minSkillLevel: number | null;
  maxSkillLevel: number | null;
  pricePerSlot: number;
  totalSlots: number;
  paidSlots: number;
  slotsLeft: number;
  creatorName: string;
  description: string | null;
  datetime: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("lt-LT", { weekday: "short", month: "short", day: "numeric" });
}

function SkillBadge({ min, max }: { min: number | null; max: number | null }) {
  if (min == null && max == null) return null;
  const label = min != null && max != null
    ? `Lygis ${min.toFixed(1)}–${max.toFixed(1)}`
    : min != null ? `Lygis ≥${min.toFixed(1)}`
    : `Lygis ≤${max!.toFixed(1)}`;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/20">
      <Star className="w-3 h-3" />
      {label}
    </span>
  );
}

function MatchCard({ m, mySkill }: { m: OpenMatch; mySkill: number | null }) {
  const qualifies = mySkill == null
    || ((m.minSkillLevel == null || mySkill >= m.minSkillLevel) && (m.maxSkillLevel == null || mySkill <= m.maxSkillLevel));
  const full = m.slotsLeft === 0;

  return (
    <div className={`relative rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/40 ${full ? "opacity-60" : ""}`}>
      <div className={`h-1.5 ${m.matchType === "competitive" ? "bg-gradient-to-r from-purple-500 to-purple-400" : "bg-gradient-to-r from-primary to-primary/60"}`} />

      {m.courtImageUrl && (
        <div className="h-28 overflow-hidden">
          <img src={m.courtImageUrl} alt={m.courtName} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SportPill sport={m.sport} variant="subtle" size="sm" />
              {m.matchType === "competitive" && (
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
            <p className="text-lg font-bold text-primary">{m.pricePerSlot.toFixed(2)} €</p>
            <p className="text-[10px] text-muted-foreground">/ žaid.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(m.date)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.startTime}–{m.endTime}</span>
        </div>

        {m.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Žaidėjai</span>
            <span className="font-semibold">{m.paidSlots}/{m.totalSlots}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((m.paidSlots / m.totalSlots) * 100)}%` }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: m.totalSlots }).map((_, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-bold ${
                  i < m.paidSlots
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted/60 border-border text-muted-foreground"
                }`}
              >
                {i < m.paidSlots ? "✓" : i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t gap-2">
          <p className="text-xs text-muted-foreground truncate">
            {m.creatorName}
          </p>
          {full ? (
            <Badge variant="secondary" className="text-xs shrink-0">Užpildyta</Badge>
          ) : !qualifies ? (
            <span className="text-[11px] text-muted-foreground italic shrink-0">Neatitinka lygio</span>
          ) : m.token ? (
            <Link href={`/join/${m.token}`}>
              <Button size="sm" className="button-primary h-8 px-4 text-xs font-semibold shrink-0 gap-1.5">
                <Zap className="w-3 h-3" />
                Prisijungti
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OpenMatchesPage() {
  const { user, isSignedIn } = useUser();
  const [sport, setSport] = useState("all");
  const [city, setCity] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [myLevelOnly, setMyLevelOnly] = useState(false);

  const mySkill: number | null = null; // TODO: fetch from user sport profile

  const { data, isLoading } = useQuery<{ matches: OpenMatch[]; total: number }>({
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

  const matches = useMemo(() => {
    let list = data?.matches ?? [];
    if (myLevelOnly && mySkill != null) {
      list = list.filter(m =>
        (m.minSkillLevel == null || mySkill >= m.minSkillLevel) &&
        (m.maxSkillLevel == null || mySkill <= m.maxSkillLevel)
      );
    }
    return list;
  }, [data, myLevelOnly, mySkill]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              Atviri mačai
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Prisijunk prie ieškomų žaidėjų ir sumokėk savo dalį tiesiogiai.
            </p>
          </div>
          <Link href="/games">
            <Button variant="outline" size="sm" className="shrink-0">
              Visi žaidimai
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-2xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Visos sporto šakos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visos sporto šakos</SelectItem>
                {SPORTS.map(s => (
                  <SelectItem key={s} value={s}>{(SPORT_LABELS as any)[s] ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={city || "all"} onValueChange={v => setCity(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Visi miestai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi miestai</SelectItem>
                {CITIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="h-9 text-sm"
              placeholder="Data"
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMyLevelOnly(o => !o)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${myLevelOnly ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${myLevelOnly ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm">Tik mano lygiui tinkantys mačai</span>
            </div>
            {(sport !== "all" || city || dateFilter) && (
              <button
                type="button"
                onClick={() => { setSport("all"); setCity(""); setDateFilter(""); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Išvalyti filtrus
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <Globe className="w-12 h-12 text-muted-foreground/30" />
            <div>
              <p className="text-lg font-semibold text-muted-foreground">Nėra atvirų mačų</p>
              <p className="text-sm text-muted-foreground mt-1">
                Pabandykite pakeisti filtrus arba rezervuokite aikštelę ir pakvieskite žaidėjus.
              </p>
            </div>
            <Link href="/courts">
              <Button variant="outline" className="mt-2">Rasti aikštelę</Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Rasta: <span className="font-semibold text-foreground">{matches.length}</span> mačų
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map(m => (
                <MatchCard key={m.gameId} m={m} mySkill={mySkill} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
