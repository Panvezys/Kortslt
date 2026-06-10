import { useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListCourts, getListCourtsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown,
  MapPin, CalendarDays, Clock,
  GraduationCap, CalendarCheck, TrendingUp,
  List, Map as MapIcon,
  Plane, Star,
} from "lucide-react";
import { CoachMap, type CoachMapCoach } from "@/components/coach-map";
import { PromotedBadge } from "@/components/promoted-badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { SportIcon, sportColor, SPORT_LABELS, SportPill, getSportColor } from "@/components/sport-icon";
import { format } from "date-fns";
import { DateField, TimeField } from "@/components/ui/date-time-field";
import { lt as ltLocale, enUS, ru as ruLocale } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";
import { centsToEuroString } from "@/lib/money";

const PAGE_SIZE = 12;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const HERO_IMAGES = [
  "coaches/coach_banner_1",
  "coaches/coach_banner_2",
  "coaches/coach_banner_3",
  "coaches/coach_banner_4",
  "coaches/coach_banner_5",
  "coaches/coach_banner_6",
];

const ALL_SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];
const sportLT = SPORT_LABELS;

type CancellationPolicy = "flexible" | "standard" | "strict";
type TravelPolicy = "any_court" | "affiliated_only";

interface SportAudience {
  sport: string;
  audiences: string[];
}

interface FacilityAffiliation {
  facilityId: number;
  facilityName: string;
  city: string | null;
  latitude: number;
  longitude: number;
  sports: string[];
}

interface Coach {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio?: string;
  photoUrl?: string;
  pricePerHour?: number;
  sports: string[];
  sportsAudiences?: SportAudience[];
  availabilityDescription?: string;
  phone?: string;
  cities?: string[];
  travelPolicy?: TravelPolicy;
  cancellationPolicy?: CancellationPolicy;
  facilityAffiliations?: FacilityAffiliation[];
  // Denormalized review aggregate — null means "no reviews yet" (renders the
  // "Naujas" badge); otherwise a 1.00–5.00 average. reviewCount is the total.
  averageRating?: number | null;
  reviewCount?: number;
  isPromoted?: boolean;
}

interface CoachQueryFilters {
  date?: string;
  startTime?: string;
  endTime?: string;
  audiences?: string[];
  travelPolicies?: string[];
  cancellationPolicies?: string[];
  city?: string;
  sport?: string;
}

async function fetchCoaches(f: CoachQueryFilters): Promise<Coach[]> {
  const params = new URLSearchParams();
  if (f.date && f.startTime && f.endTime) {
    params.set("date", f.date);
    params.set("startTime", f.startTime);
    params.set("endTime", f.endTime);
  }
  if (f.audiences?.length) params.set("audiences", f.audiences.join(","));
  if (f.travelPolicies?.length) params.set("travelPolicies", f.travelPolicies.join(","));
  if (f.cancellationPolicies?.length) params.set("cancellationPolicies", f.cancellationPolicies.join(","));
  if (f.city) params.set("city", f.city);
  if (f.sport) params.set("sport", f.sport);
  const r = await fetch(`${API}/coaches?${params.toString()}`);
  if (!r.ok) return [];
  return r.json();
}

const AUDIENCE_LT: Record<string, string> = {
  kids: "Vaikai",
  beginners: "Pradedantieji",
  advanced: "Pažengę",
  pros: "Profesionalai",
};

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function CoachCard({
  coach,
  windowAvailable,
  searchTime,
}: {
  coach: Coach;
  windowAvailable: boolean;
  searchTime: string;
}) {
  const initials = coach.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  // Dedupe audience labels across all of the coach's sports for compact rendering.
  const audienceSet = new Set<string>();
  for (const sa of coach.sportsAudiences ?? []) {
    for (const a of sa.audiences) audienceSet.add(a);
  }
  const flexibleCancel = coach.cancellationPolicy === "flexible";
  const willTravel = coach.travelPolicy === "any_court";
  const showAvailableAt = windowAvailable && !!searchTime;

  return (
    <Link href={`/coach/${coach.id}`}>
      <div className="group bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col h-full">
        <div className="relative h-40 bg-muted flex items-center justify-center overflow-hidden">
          {coach.photoUrl ? (
            <img
              src={coach.photoUrl}
              alt={coach.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/20">
              <span className="text-2xl font-bold text-primary">{initials}</span>
            </div>
          )}
          {coach.isPromoted && (
            <div className="absolute top-2 left-2">
              <PromotedBadge />
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col gap-2.5 flex-1">
          <h3 className="font-semibold text-base leading-tight truncate">{coach.name}</h3>

          {coach.sports.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {coach.sports.slice(0, 2).map(s => (
                <SportPill key={s} sport={s} variant="subtle" />
              ))}
              {coach.sports.length > 2 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  +{coach.sports.length - 2}
                </span>
              )}
            </div>
          )}

          {audienceSet.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(audienceSet).slice(0, 4).map(a => (
                <span
                  key={a}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                >
                  {AUDIENCE_LT[a] ?? a}
                </span>
              ))}
            </div>
          )}

          {(flexibleCancel || willTravel) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {willTravel && (
                <span className="inline-flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5 text-sky-500" />
                  Atvyksta į jūsų aikštelę
                </span>
              )}
              {flexibleCancel && (
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Lankstus atšaukimas
                </span>
              )}
            </div>
          )}

          {coach.bio && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{coach.bio}</p>
          )}

          {(coach.reviewCount ?? 0) > 0 && coach.averageRating != null ? (
            <div className="inline-flex items-center gap-1 text-xs font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="tabular-nums">{coach.averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground font-normal">({coach.reviewCount})</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary self-start">
              Naujas
            </span>
          )}
        </div>

        <div className="px-4 pb-4 space-y-2">
          {showAvailableAt && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 py-1.5 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Laisvas {searchTime}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground tabular-nums">
              {coach.pricePerHour != null
                ? <>{centsToEuroString(coach.pricePerHour)}<span className="text-muted-foreground font-normal text-xs"> €/val.</span></>
                : <span className="text-xs text-muted-foreground font-normal">Kaina pagal sutartį</span>
              }
            </div>
            <Button
              size="sm"
              className="text-xs group-hover:brightness-110 transition-all"
            >
              Peržiūrėti profilį
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CoachesPage() {
  const { locale } = useI18n();
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const _qp = new URLSearchParams(searchStr.replace(/^\?/, ""));
  const initialSport = _qp.get("sport") ?? "";
  const initialCity = _qp.get("city") ?? "";

  // Hero slideshow
  const [bgIdx, setBgIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBgIdx(i => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  // --- Hero search bar state (identical to home.tsx) ---
  const [searchSport, setSearchSport] = useState(initialSport);
  // City filter is multi-select to mirror /courts. The hero combobox is a
  // single-pick shortcut into the same Set; the sidebar lets users add more.
  const [selectedCities, setSelectedCities] = useState<Set<string>>(
    initialCity ? new Set([initialCity]) : new Set()
  );
  const searchCity = selectedCities.size === 1 ? Array.from(selectedCities)[0]! : "";
  const setSearchCity = (c: string) => {
    setSelectedCities(c ? new Set([c]) : new Set());
  };
  const [cityInput, setCityInput] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [showMoreCities, setShowMoreCities] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const [searchDateObj, setSearchDateObj] = useState<Date | undefined>(undefined);
  const [searchDate, setSearchDate] = useState("");

  // Time + duration — required by the availability matrix. When all three of
  // (date, time, duration) are present we pipe them to the /coaches endpoint
  // and the server filters by getCoachAvailability continuous coverage.
  const [searchTime, setSearchTime] = useState("");          // "HH:MM"
  const [searchDurationMin, setSearchDurationMin] = useState(60); // 30 | 60 | 90 | 120

  // Filters — Strike-onboarding/marketplace
  const [activeAudiences, setActiveAudiences] = useState<Set<string>>(new Set());
  const [travelOnly, setTravelOnly] = useState(false);   // "atvyksta į mano aikštelę"
  const [flexibleOnly, setFlexibleOnly] = useState(false);

  // Derived window for the API call. endTime exists only when all three are set.
  const effectiveEndTime = searchTime ? addMinutes(searchTime, searchDurationMin) : "";
  const windowReady = !!(searchDate && searchTime && effectiveEndTime);

  // Time-of-day accent
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const tick = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const TIME_PALETTES = [
    { color: "#38bdf8" }, // dawn
    { color: "#84cc16" }, // morning
    { color: "#f59e0b" }, // afternoon
    { color: "#f97316" }, // evening
    { color: "#8b5cf6" }, // night
  ];
  const timePalette =
    currentHour >= 5 && currentHour < 10 ? TIME_PALETTES[0] :
    currentHour >= 10 && currentHour < 14 ? TIME_PALETTES[1] :
    currentHour >= 14 && currentHour < 17 ? TIME_PALETTES[2] :
    currentHour >= 17 && currentHour < 21 ? TIME_PALETTES[3] :
    TIME_PALETTES[4];
  const timeAccent = timePalette.color;
  const accentColor = searchSport ? (sportColor[searchSport] ?? timeAccent) : timeAccent;
  function contrastText(hex: string) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.55 ? "#000" : "#fff";
  }
  const accentFg = contrastText(accentColor);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cities from courts API
  const { data: courts } = useListCourts(undefined, { query: { queryKey: getListCourtsQueryKey(), staleTime: 60_000 } });
  const uniqueCities = [...new Set((courts ?? []).map(c => c.city).filter((c): c is string => !!c))].sort();
  const cityCounts = (courts ?? []).reduce<Record<string, number>>((acc, c) => {
    if (c.city) acc[c.city] = (acc[c.city] ?? 0) + 1;
    return acc;
  }, {});
  const TOP_N = 5;
  const popularCities = [...uniqueCities].sort((a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0)).slice(0, TOP_N);
  const otherCities = uniqueCities.filter(c => !popularCities.includes(c));
  const cityFilter = cityInput.trim().toLowerCase();
  const filteredPopular = popularCities.filter(c => !cityFilter || c.toLowerCase().includes(cityFilter));
  const filteredOther = otherCities.filter(c => !cityFilter || c.toLowerCase().includes(cityFilter));

  // Coaches data — filters land in the queryKey so each filter combo gets
  // its own cache entry and the request fires when the filters change.
  const coachQueryFilters: CoachQueryFilters = {
    ...(windowReady ? { date: searchDate, startTime: searchTime, endTime: effectiveEndTime } : {}),
    ...(activeAudiences.size > 0 ? { audiences: Array.from(activeAudiences) } : {}),
    ...(travelOnly ? { travelPolicies: ["any_court"] } : {}),
    ...(flexibleOnly ? { cancellationPolicies: ["flexible"] } : {}),
    // API takes a single city; for multi-select we filter client-side below.
    ...(selectedCities.size === 1 ? { city: Array.from(selectedCities)[0] } : {}),
    ...(searchSport ? { sport: searchSport } : {}),
  };
  const { data: coaches, isLoading } = useQuery<Coach[]>({
    queryKey: ["coaches", coachQueryFilters],
    queryFn: () => fetchCoaches(coachQueryFilters),
    staleTime: 60_000,
  });

  // Sidebar filters
  const [search, setSearch] = useState("");
  const [activeSports, setActiveSports] = useState<Set<string>>(
    initialSport ? new Set([initialSport]) : new Set(ALL_SPORTS)
  );
  const [maxPrice, setMaxPrice] = useState(200);
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc" | "rating_desc">("default");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [cityExpanded, setCityExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Sync hero sport pill → sidebar
  useEffect(() => {
    if (searchSport) {
      setActiveSports(new Set([searchSport]));
    } else {
      setActiveSports(new Set(ALL_SPORTS));
    }
  }, [searchSport]);

  useEffect(() => {
    setPage(1);
  }, [search, activeSports, maxPrice, sortBy, selectedCities, searchDate, searchTime, searchDurationMin, activeAudiences, travelOnly, flexibleOnly]);

  const allSportsActive = activeSports.size === ALL_SPORTS.length;
  // Single-select sport filter: clicking a sport narrows to JUST that sport
  // in one click. Clicking the currently-only-selected sport widens back to
  // "all sports active" (the unfiltered state). No multi-select — the user
  // explicitly asked for "filtering by sport should be one click only".
  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      if (prev.size === 1 && prev.has(sport)) {
        return new Set(ALL_SPORTS);
      }
      return new Set([sport]);
    });
  };
  const resetSports = () => setActiveSports(new Set(ALL_SPORTS));

  const filteredCoaches = (coaches ?? []).filter(c => {
    const matchesSearch = !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.bio ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesSport = activeSports.size === ALL_SPORTS.length || c.sports.some(s => activeSports.has(s));
    // maxPrice is euros from the slider; coach.pricePerHour is integer cents.
    const matchesPrice = c.pricePerHour == null || c.pricePerHour <= maxPrice * 100;
    const matchesCity = selectedCities.size === 0 || (c.cities ?? []).some(
      city => selectedCities.has(city)
    );
    return matchesSearch && matchesSport && matchesPrice && matchesCity;
  });

  const sortedCoaches = [...filteredCoaches].sort((a, b) => {
    if (sortBy === "rating_desc") return ((b as any).rating ?? 0) - ((a as any).rating ?? 0);
    if (sortBy === "price_asc") return (a.pricePerHour ?? 999) - (b.pricePerHour ?? 999);
    if (sortBy === "price_desc") return (b.pricePerHour ?? 0) - (a.pricePerHour ?? 0);
    return 0;
  });

  const total = sortedCoaches.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = sortedCoaches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [
    activeSports.size < ALL_SPORTS.length,
    selectedCities.size > 0,
    maxPrice < 200,
    search.trim().length > 0,
    activeAudiences.size > 0,
    travelOnly,
    flexibleOnly,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setActiveSports(new Set(ALL_SPORTS));
    setSelectedCities(new Set());
    setCityInput("");
    setMaxPrice(200);
    setSearch("");
    setSortBy("default");
    setActiveAudiences(new Set());
    setTravelOnly(false);
    setFlexibleOnly(false);
  };

  const toggleCity = (c: string) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  // Cities sorted by court count (mirrors /courts), restricted to ones we
  // actually have coverage for. uniqueCities already drops nulls/dedupes.
  const sortedCitiesForFilter = uniqueCities
    .slice()
    .sort((a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0));

  function toggleAudience(a: string) {
    setActiveAudiences((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  const sportCounts = (coaches ?? []).reduce<Record<string, number>>((acc, c) => {
    c.sports.forEach(s => { acc[s] = (acc[s] ?? 0) + 1; });
    return acc;
  }, {});

  const filterControls = (
    <div className="space-y-6">
      {/* Sport filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sporto šakos</Label>
          {!allSportsActive && (
            <button
              onClick={resetSports}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Visi
            </button>
          )}
        </div>
        <div className="space-y-1">
          {ALL_SPORTS.map(sport => {
            const active = activeSports.has(sport);
            const color = sportColor[sport];
            const count = sportCounts[sport] ?? 0;
            return (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left text-sm ${
                  active ? "bg-muted/60 hover:bg-muted" : "opacity-40 hover:opacity-70 hover:bg-muted/30"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{ background: active ? color : "transparent", borderColor: color }}
                >
                  <SportIcon sport={sport} size={11} strokeWidth={2} style={{ color: active ? "white" : color }} />
                </div>
                <span className={`flex-1 font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {sportLT[sport]}
                </span>
                <span className={`text-xs tabular-nums ${active ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* City — multi-select, sorted by court count. Mirrors /courts pattern. */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Miestas</Label>
          {selectedCities.size > 0 && (
            <button
              onClick={() => setSelectedCities(new Set())}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Valyti ({selectedCities.size})
            </button>
          )}
        </div>
        {sortedCitiesForFilter.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nėra miestų</p>
        ) : (
          <>
            <div className="space-y-1">
              {(cityExpanded
                ? sortedCitiesForFilter
                : sortedCitiesForFilter.filter((c, i) => i < 5 || selectedCities.has(c))
              ).map(c => {
                const active = selectedCities.has(c);
                const count = cityCounts[c] ?? 0;
                return (
                  <button
                    key={c}
                    onClick={() => toggleCity(c)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left text-sm ${
                      active ? "bg-primary/10 hover:bg-primary/15" : "opacity-60 hover:opacity-90 hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        active ? "bg-primary border-primary" : "border-muted-foreground/40 bg-transparent"
                      }`}
                    >
                      {active && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {c}
                    </span>
                    <span className={`text-xs tabular-nums ${active ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {sortedCitiesForFilter.length > 5 && (
              <button
                onClick={() => setCityExpanded(v => !v)}
                className="mt-1 text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
              >
                {cityExpanded
                  ? "Rodyti mažiau ↑"
                  : `Rodyti daugiau (${sortedCitiesForFilter.length - 5}) ↓`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Name search */}
      <div>
        <Label htmlFor="coach-search" className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Paieška</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="coach-search"
            placeholder="Trenerio vardas..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Max price */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Maks. kaina</Label>
          <span className="text-primary font-bold text-sm">{maxPrice}€/val</span>
        </div>
        <input
          type="range"
          min={10} max={200} step={5}
          value={maxPrice}
          onChange={e => setMaxPrice(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>10€</span><span>200€+</span>
        </div>
      </div>

      {/* Skill level — tied to per-sport audience tags collected in onboarding */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Lygis</Label>
        <div className="space-y-1.5">
          {([
            { key: "kids", label: "Vaikai" },
            { key: "beginners", label: "Pradedantieji" },
            { key: "advanced", label: "Pažengę" },
            { key: "pros", label: "Profesionalai" },
          ] as const).map((a) => {
            const checked = activeAudiences.has(a.key);
            return (
              <label
                key={a.key}
                className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAudience(a.key)}
                  className="accent-primary w-4 h-4"
                />
                <span className={checked ? "text-foreground" : "text-muted-foreground"}>{a.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Conditions — flexible-cancel and will-travel toggles */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Sąlygos</Label>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
            <input
              type="checkbox"
              checked={flexibleOnly}
              onChange={() => setFlexibleOnly((v) => !v)}
              className="accent-primary w-4 h-4"
            />
            <span className={flexibleOnly ? "text-foreground" : "text-muted-foreground"}>
              Lankstus atšaukimas
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
            <input
              type="checkbox"
              checked={travelOnly}
              onChange={() => setTravelOnly((v) => !v)}
              className="accent-primary w-4 h-4"
            />
            <span className={travelOnly ? "text-foreground" : "text-muted-foreground"}>
              Atvyksta į mano aikštelę
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      {/* ── Hero with rotating background + search bar ── */}
      <section className="relative bg-zinc-950" style={{ minHeight: 280, color: "white" }}>
        {/* Slideshow */}
        {HERO_IMAGES.map((img, i) => (
          <img
            key={img}
            src={`${BASE}/${img}.webp`}
            srcSet={`${BASE}/${img}-480.webp 480w, ${BASE}/${img}-800.webp 800w, ${BASE}/${img}.webp 1200w`}
            sizes="100vw"
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ opacity: i === bgIdx ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-zinc-950/70 z-[1]" />
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent z-[2]" />

        <div className="relative z-10 container mx-auto px-4 pt-12 pb-14" style={{ color: "white" }}>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 drop-shadow-md" style={{ color: "white" }}>
            Treneriai
          </h1>
          <p className="text-white/70 max-w-xl text-sm md:text-base leading-relaxed drop-shadow mb-8">
            Rask profesionalų trenerį bet kuriam sporto žaidimui — individualios pamokos, grupės ir daugiau.
          </p>

          {/* ── Search bar: Sport · City · Date · Time · Duration · Search ── */}
          <div className="flex gap-2 flex-wrap items-center max-w-3xl">

            {/* Sport dropdown — first because users read left-to-right and
                sport is the most important filter on this page. */}
            <Select
              value={searchSport === "" ? "__all__" : searchSport}
              onValueChange={(v) => setSearchSport(v === "__all__" ? "" : v)}
            >
              <SelectTrigger
                className="bg-white/10 backdrop-blur-md border text-white/80 h-auto py-2.5 px-3 gap-1.5 w-auto min-w-[160px] [&_svg]:text-white/70"
                style={{ borderColor: searchSport ? accentColor + "99" : "rgba(255,255,255,0.2)" }}
              >
                <SelectValue placeholder="Sporto šaka" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Visos sporto šakos</SelectItem>
                {ALL_SPORTS.map(sport => (
                  <SelectItem key={sport} value={sport}>
                    <span className="inline-flex items-center gap-2">
                      <SportIcon sport={sport} className="h-3.5 w-3.5" />
                      {SPORT_LABELS[sport] ?? sport}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* City combobox */}
            <div className="relative flex-1 min-w-[140px]" ref={cityRef}>
              <div
                className="flex items-center gap-2 bg-white/10 backdrop-blur-md border rounded-xl px-3 py-2.5 cursor-text transition-all"
                style={{ borderColor: cityDropdownOpen || selectedCities.size > 0 ? accentColor + "99" : "rgba(255,255,255,0.2)" }}
                onClick={() => setCityDropdownOpen(true)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: cityDropdownOpen || selectedCities.size > 0 ? accentColor : "rgba(255,255,255,0.5)" }} />
                <input
                  type="text"
                  value={
                    selectedCities.size > 1
                      ? `${selectedCities.size} miestai`
                      : (searchCity || cityInput)
                  }
                  readOnly={selectedCities.size > 1}
                  placeholder="Miestas"
                  onFocus={() => { setCityDropdownOpen(true); if (searchCity) setCityInput(""); }}
                  onChange={e => { setCityInput(e.target.value); setSelectedCities(new Set()); setCityDropdownOpen(true); }}
                  className="bg-transparent text-sm text-white/80 placeholder:text-white/40 outline-none flex-1 w-full min-w-0"
                />
                {selectedCities.size > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedCities(new Set()); setCityInput(""); }}
                    className="text-white/40 hover:text-white/70 text-lg leading-none shrink-0"
                  >×</button>
                )}
              </div>

              {cityDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/96 backdrop-blur border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-64 overflow-y-auto">
                  <button
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setSearchCity(""); setCityInput(""); setCityDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 flex items-center gap-2"
                    style={{ color: !searchCity && !cityInput ? accentColor : "rgba(255,255,255,0.6)", fontWeight: !searchCity && !cityInput ? "600" : "400" }}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    Visi miestai
                  </button>

                  {filteredPopular.length > 0 && (
                    <>
                      <div className="px-4 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest border-t border-white/5">
                        Populiariausi
                      </div>
                      {filteredPopular.map(city => (
                        <button
                          key={city}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setSearchCity(city ?? ""); setCityInput(""); setCityDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 flex items-center justify-between"
                          style={searchCity === city ? { color: accentColor, fontWeight: "600", background: accentColor + "18" } : { color: "rgba(255,255,255,0.8)" }}
                        >
                          <span>{city}</span>
                          <span className="text-xs text-white/30 tabular-nums">{city ? (cityCounts[city] ?? 0) : 0}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {filteredOther.length > 0 && (
                    <>
                      {(showMoreCities || cityInput.length > 0) ? (
                        <>
                          <div className="px-4 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest border-t border-white/5">Kiti miestai</div>
                          {filteredOther.map(city => (
                            <button
                              key={city}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setSearchCity(city ?? ""); setCityInput(""); setCityDropdownOpen(false); setShowMoreCities(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 flex items-center justify-between"
                              style={searchCity === city ? { color: accentColor, fontWeight: "600", background: accentColor + "18" } : { color: "rgba(255,255,255,0.8)" }}
                            >
                              <span>{city}</span>
                              <span className="text-xs text-white/30 tabular-nums">{city ? (cityCounts[city] ?? 0) : 0}</span>
                            </button>
                          ))}
                          <button
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => setShowMoreCities(false)}
                            className="w-full text-left px-4 py-2 text-xs text-white/30 hover:text-white/60 border-t border-white/5 flex items-center gap-1"
                          >
                            <ChevronDown className="h-3 w-3 rotate-180" /> Mažiau
                          </button>
                        </>
                      ) : (
                        <button
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => setShowMoreCities(true)}
                          className="w-full text-left px-4 py-2.5 text-xs text-white/40 hover:text-white/70 border-t border-white/5 flex items-center gap-1 transition-colors"
                        >
                          <ChevronDown className="h-3 w-3" /> Daugiau miestų ({filteredOther.length})
                        </button>
                      )}
                    </>
                  )}

                  {filteredPopular.length === 0 && filteredOther.length === 0 && (
                    <div className="px-4 py-3 text-sm text-white/40 text-center">Nerasta miestų</div>
                  )}
                </div>
              )}
            </div>

            {/* Date — site-standard picker (see ui/date-time-field.tsx) */}
            <DateField
              value={searchDateObj}
              onChange={(d) => { setSearchDateObj(d); setSearchDate(d ? format(d, "yyyy-MM-dd") : ""); }}
              accentColor={accentColor}
              accentFg={accentFg}
              locale={locale}
              variant="on-dark"
            />

            {/* Time — site-standard picker, 30-min steps feed the matrix window */}
            <TimeField
              value={searchTime || null}
              onChange={(t) => setSearchTime(t ?? "")}
              stepMinutes={30}
              accentColor={accentColor}
              accentFg={accentFg}
              align="left"
              variant="on-dark"
            />

            {/* Duration — 30-min increments, gates the matrix window. */}
            <Select
              value={String(searchDurationMin)}
              onValueChange={(v) => setSearchDurationMin(Number(v))}
            >
              <SelectTrigger
                className="bg-white/10 backdrop-blur-md border text-white/80 h-auto py-2.5 px-3 gap-1.5 w-auto min-w-[100px] [&_svg]:text-white/70"
                style={{ borderColor: "rgba(255,255,255,0.2)" }}
              >
                <SelectValue placeholder="Trukmė" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 val.</SelectItem>
                <SelectItem value="90">1.5 val.</SelectItem>
                <SelectItem value="120">2 val.</SelectItem>
              </SelectContent>
            </Select>

            {/* Search button */}
            <button
              onClick={() => {
                setPage(1);
                setCityDropdownOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-md"
              style={{ background: accentColor, color: accentFg }}
            >
              <Search className="h-3.5 w-3.5" />
              Ieškoti
            </button>
          </div>
        </div>
      </section>

      {/* ── How it works (3-step intro) ── */}
      <section className="bg-primary/5 border-b border-border">
        <div className="container mx-auto px-4 py-8 md:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Kaip tai veikia</h2>
              <p className="text-sm text-muted-foreground mt-1">Trys paprasti žingsniai iki pirmosios treniruotės.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2 self-start md:self-auto">
              <Link href="/become-coach">
                <GraduationCap className="h-4 w-4" />
                Esate treneris? Registruokitės čia
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Search, title: "Raskite Pro", desc: "Filtruokite pagal miestą, sporto šaką ir lygį.", step: 1 },
              { icon: CalendarCheck, title: "Rezervuokite laiką", desc: "Pasirinkite jums patogų laiką ir patvirtintą aikštyną.", step: 2 },
              { icon: TrendingUp, title: "Tobulėkite", desc: "Mėgaukitės profesionaliomis treniruotėmis ir kilkite reitinge.", step: 3 },
            ].map(({ icon: Icon, title, desc, step }) => (
              <div key={step} className="relative bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="absolute top-3 right-3 text-xs font-bold text-muted-foreground/40 tabular-nums">0{step}</div>
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden sticky top-16 z-30 border-b bg-background/95 backdrop-blur px-4 py-2.5 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 flex-1"
          onClick={() => setMobileFiltersOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtrai
          {activeFilterCount > 0 && (
            <Badge className="h-5 px-1.5 text-xs ml-1">{activeFilterCount}</Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground px-2" onClick={resetFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Mobile filter sheet ── */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl flex flex-col">
          <SheetHeader className="mb-4 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtrai
              {activeFilterCount > 0 && <Badge className="h-5 px-1.5 text-xs">{activeFilterCount}</Badge>}
            </SheetTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={resetFilters}>
                <X className="h-3 w-3 mr-1" /> Valyti
              </Button>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-1">{filterControls}</div>
          <div className="shrink-0 border-t pt-4 pb-2">
            <SheetClose asChild>
              <Button className="w-full" size="lg">
                Rodyti {total} trener{total === 1 ? "į" : "ių"}
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Main layout ── */}
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* Sidebar — desktop */}
          <aside className="hidden md:block w-64 shrink-0 space-y-6 sticky top-24 overflow-y-auto max-h-[calc(100vh-7rem)] pr-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <SlidersHorizontal className="h-4 w-4" />
                Filtrai
                {activeFilterCount > 0 && <Badge className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={resetFilters}>
                  <X className="h-3 w-3 mr-1" /> Valyti
                </Button>
              )}
            </div>
            {filterControls}
          </aside>

          {/* Main content */}
          <main className="flex-1 w-full min-w-0">
            {/* Desktop header row */}
            <div className="hidden md:flex mb-6 justify-between items-center gap-3">
              <h2 className="text-base font-semibold text-muted-foreground shrink-0">
                {isLoading ? "..." : totalPages > 1
                  ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}`
                  : `${total} trener${total === 1 ? "is" : "ių"}`}
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
                  <SelectTrigger className="h-8 text-xs w-48 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Numatyta</SelectItem>
                    <SelectItem value="rating_desc">Įvertinimas: aukščiausias</SelectItem>
                    <SelectItem value="price_asc">Kaina: mažiausia</SelectItem>
                    <SelectItem value="price_desc">Kaina: didžiausia</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 rounded-md border p-0.5">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <List className="h-3.5 w-3.5" /> Sąrašas
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <MapIcon className="h-3.5 w-3.5" /> Žemėlapis
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile result count + view toggle */}
            <div className="md:hidden mb-4 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {isLoading ? "..." : `${total} trener${total === 1 ? "is" : "ių"}`}
              </span>
              <div className="flex gap-1 rounded-md border p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  aria-label="Sąrašas"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  aria-label="Žemėlapis"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isLoading ? (
              viewMode === "list" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col space-y-3">
                      <Skeleton className="h-[200px] w-full rounded-xl" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <Skeleton className="h-[500px] md:h-[640px] w-full rounded-xl" />
              )
            ) : viewMode === "map" ? (
              <div className="h-[500px] md:h-[640px]">
                <CoachMap coaches={(sortedCoaches as CoachMapCoach[]) ?? []} />
              </div>
            ) : paged.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {paged.map(coach => (
                    <CoachCard key={coach.id} coach={coach} windowAvailable={windowReady} searchTime={searchTime} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-8">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                      .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                        acc.push(p); return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "…" ? (
                          <span key={`e-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                        ) : (
                          <Button
                            key={p}
                            variant={page === p ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(p as number)}
                            className="h-9 w-9 p-0 text-sm"
                          >
                            {p}
                          </Button>
                        )
                      )}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 border rounded-xl bg-muted/10 border-dashed">
                <div className="text-4xl mb-4">🏋️</div>
                <h3 className="text-xl font-bold mb-2">Trenerių nerasta</h3>
                <p className="text-muted-foreground mb-4 px-4">Pabandykite pakeisti paieškos parametrus</p>
                <Button variant="outline" onClick={resetFilters}>Valyti filtrus</Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
