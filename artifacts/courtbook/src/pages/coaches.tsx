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
  MapPin, CalendarDays, Euro, Clock,
  GraduationCap, CalendarCheck, TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { SportIcon, sportColor, SPORT_LABELS, SportPill, getSportColor } from "@/components/sport-icon";
import { format } from "date-fns";
import { DateCalendar } from "@/components/ui/date-calendar";
import { lt as ltLocale, enUS, ru as ruLocale } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";

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

interface Coach {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio?: string;
  photoUrl?: string;
  pricePerHour?: number;
  sports: string[];
  availabilityDescription?: string;
  phone?: string;
  cities?: string[];
}

async function fetchCoaches(): Promise<Coach[]> {
  const r = await fetch(`${API}/coaches`);
  if (!r.ok) return [];
  return r.json();
}

function CoachCard({ coach }: { coach: Coach }) {
  const initials = coach.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <Link href={`/coach/${coach.id}`}>
      <div className="group bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col h-full">
        {/* Photo / Avatar */}
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
          {coach.pricePerHour != null && (
            <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur rounded-xl px-2.5 py-1 text-white text-xs font-semibold flex items-center gap-1">
              <Euro className="w-3 h-3" />
              {coach.pricePerHour}€/val
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 flex flex-col gap-2.5 flex-1">
          <h3 className="font-semibold text-base leading-tight truncate">{coach.name}</h3>

          {coach.sports.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {coach.sports.slice(0, 3).map(s => (
                <SportPill key={s} sport={s} variant="subtle" />
              ))}
              {coach.sports.length > 3 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  +{coach.sports.length - 3}
                </span>
              )}
            </div>
          )}

          {coach.bio && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{coach.bio}</p>
          )}

          {coach.availabilityDescription && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-auto">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{coach.availabilityDescription}</span>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Button size="sm" variant="outline" className="w-full text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            Peržiūrėti profilį
          </Button>
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
  const [searchCity, setSearchCity] = useState(initialCity);
  const [cityInput, setCityInput] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [showMoreCities, setShowMoreCities] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [searchDateObj, setSearchDateObj] = useState<Date | undefined>(undefined);
  const [searchDate, setSearchDate] = useState("");
  const dateRef = useRef<HTMLDivElement>(null);

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
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cities from courts API
  const { data: courts } = useListCourts(undefined, { query: { queryKey: getListCourtsQueryKey(), staleTime: 60_000 } });
  const uniqueCities = [...new Set((courts ?? []).map(c => c.city).filter(Boolean))].sort();
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

  // Coaches data
  const { data: coaches, isLoading } = useQuery<Coach[]>({
    queryKey: ["coaches"],
    queryFn: fetchCoaches,
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

  // Sync hero sport pill → sidebar
  useEffect(() => {
    if (searchSport) {
      setActiveSports(new Set([searchSport]));
    } else {
      setActiveSports(new Set(ALL_SPORTS));
    }
  }, [searchSport]);

  useEffect(() => { setPage(1); }, [search, activeSports, maxPrice, sortBy, searchCity]);

  const allSportsActive = activeSports.size === ALL_SPORTS.length;
  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) {
        if (next.size === 1) return prev;
        next.delete(sport);
      } else { next.add(sport); }
      return next;
    });
  };

  const filteredCoaches = (coaches ?? []).filter(c => {
    const matchesSearch = !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.bio ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesSport = activeSports.size === ALL_SPORTS.length || c.sports.some(s => activeSports.has(s));
    const matchesPrice = c.pricePerHour == null || c.pricePerHour <= maxPrice;
    const matchesCity = !searchCity || (c.cities ?? []).some(
      city => city.toLowerCase() === searchCity.toLowerCase()
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
    maxPrice < 200,
    search.trim().length > 0,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setActiveSports(new Set(ALL_SPORTS));
    setMaxPrice(200);
    setSearch("");
    setSortBy("default");
  };

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
          <button
            onClick={() => setActiveSports(allSportsActive ? new Set(ALL_SPORTS.slice(0,1)) : new Set(ALL_SPORTS))}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            {allSportsActive ? "Slėpti viską" : "Rodyti viską"}
          </button>
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
    </div>
  );

  return (
    <Layout>
      {/* ── Hero with rotating background + search bar ── */}
      <section className="relative bg-zinc-950 text-white" style={{ minHeight: 280 }}>
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

        <div className="relative z-10 container mx-auto px-4 pt-12 pb-14">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white drop-shadow-md">
            Treneriai
          </h1>
          <p className="text-white/70 max-w-xl text-sm md:text-base leading-relaxed drop-shadow mb-8">
            Rask profesionalų trenerį bet kuriam sporto žaidimui — individualios pamokos, grupės ir daugiau.
          </p>

          {/* ── Sport pills (identical to home.tsx) ── */}
          <div className="flex gap-2 flex-wrap mb-4">
            {ALL_SPORTS.map(sport => {
              const color = getSportColor(sport);
              const active = searchSport === sport;
              return (
                <button
                  key={sport}
                  onClick={() => setSearchSport(active ? "" : sport)}
                  className="rounded-full transition-all"
                >
                  <SportPill sport={sport} variant={active ? "solid" : "subtle"} size="sm" />
                </button>
              );
            })}
          </div>

          {/* ── City + Date row (identical to home.tsx Row 3) ── */}
          <div className="flex gap-2 flex-wrap items-center max-w-2xl">

            {/* City combobox */}
            <div className="relative flex-1 min-w-[140px]" ref={cityRef}>
              <div
                className="flex items-center gap-2 bg-white/10 backdrop-blur-md border rounded-xl px-3 py-2.5 cursor-text transition-all"
                style={{ borderColor: cityDropdownOpen || searchCity ? accentColor + "99" : "rgba(255,255,255,0.2)" }}
                onClick={() => setCityDropdownOpen(true)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: cityDropdownOpen || searchCity ? accentColor : "rgba(255,255,255,0.5)" }} />
                <input
                  type="text"
                  value={searchCity ? searchCity : cityInput}
                  placeholder="Miestas"
                  onFocus={() => { setCityDropdownOpen(true); if (searchCity) setCityInput(""); }}
                  onChange={e => { setCityInput(e.target.value); setSearchCity(""); setCityDropdownOpen(true); }}
                  className="bg-transparent text-sm text-white/80 placeholder:text-white/40 outline-none flex-1 w-full min-w-0"
                />
                {searchCity && (
                  <button
                    onClick={e => { e.stopPropagation(); setSearchCity(""); setCityInput(""); }}
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
                          onClick={() => { setSearchCity(city); setCityInput(""); setCityDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 flex items-center justify-between"
                          style={searchCity === city ? { color: accentColor, fontWeight: "600", background: accentColor + "18" } : { color: "rgba(255,255,255,0.8)" }}
                        >
                          <span>{city}</span>
                          <span className="text-xs text-white/30 tabular-nums">{cityCounts[city] ?? 0}</span>
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
                              onClick={() => { setSearchCity(city); setCityInput(""); setCityDropdownOpen(false); setShowMoreCities(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 flex items-center justify-between"
                              style={searchCity === city ? { color: accentColor, fontWeight: "600", background: accentColor + "18" } : { color: "rgba(255,255,255,0.8)" }}
                            >
                              <span>{city}</span>
                              <span className="text-xs text-white/30 tabular-nums">{cityCounts[city] ?? 0}</span>
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

            {/* Date calendar popover */}
            <div className="relative" ref={dateRef}>
              <button
                onClick={() => setDateDropdownOpen(v => !v)}
                className="flex items-center gap-2 bg-white/10 backdrop-blur-md border rounded-xl px-3 py-2.5 transition-colors whitespace-nowrap"
                style={{ borderColor: dateDropdownOpen ? accentColor + "99" : "rgba(255,255,255,0.2)" }}
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: dateDropdownOpen || searchDateObj ? accentColor : "rgba(255,255,255,0.5)" }} />
                <span className="text-sm text-white/80">
                  {searchDateObj ? format(searchDateObj, "d MMM") : "Data"}
                </span>
                {searchDateObj && (
                  <span
                    onClick={e => { e.stopPropagation(); setSearchDateObj(undefined); setSearchDate(""); }}
                    className="text-white/40 hover:text-white/70 text-lg leading-none ml-1"
                  >×</span>
                )}
              </button>

              {dateDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-[252px]">
                  <DateCalendar
                    selected={searchDateObj}
                    onSelect={(d) => { setSearchDateObj(d); setSearchDate(format(d, "yyyy-MM-dd")); setDateDropdownOpen(false); }}
                    onClose={() => setDateDropdownOpen(false)}
                    accentColor={accentColor}
                    accentFg={accentFg}
                    locale={locale}
                  />
                </div>
              )}
            </div>

            {/* Search button */}
            <button
              onClick={() => {
                setPage(1);
                setCityDropdownOpen(false);
                setDateDropdownOpen(false);
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
              </div>
            </div>

            {/* Mobile result count */}
            <div className="md:hidden mb-4 text-sm font-medium text-muted-foreground">
              {isLoading ? "..." : `${total} trener${total === 1 ? "is" : "ių"}`}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col space-y-3">
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : paged.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {paged.map(coach => (
                    <CoachCard key={coach.id} coach={coach} />
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
