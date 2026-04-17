import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetStatsSummary, useGetPopularCourts, useListCourts, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { CourtMap } from "@/components/court-map";
import { CourtCard } from "@/components/court-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ArrowRight, Heart, Landmark, Search, Building2, Mail, Phone, Instagram, Facebook, MessageCircle, CalendarDays, Clock, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, CreditCard, Users, BarChart3, CheckCircle2, Euro, Bell, Trophy, Flame, Eye } from "lucide-react";
import { useT, useI18n } from "@/lib/i18n";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useUser } from "@clerk/react";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { sportLithuanian } from "@/components/court-map";
import { resolveCourtImage } from "@/lib/imageUrl";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, addMonths, subMonths } from "date-fns";
import { lt as ltLocale, enUS, ru as ruLocale } from "date-fns/locale";

const HERO_IMAGES = [
  "courts/court_2_bernardinu.png",
  "courts/padel/padel_court_indoor_1.jpg",
  "courts/court_1_seb_arena.png",
  "courts/football/football_futsal_court_2.jpg",
  "courts/court_4_verkiai.png",
  "courts/badminton/badminton_court_indoor_1.jpg",
  "courts/court_17_zalgiris.png",
  "courts/squash/squash_court_1.jpg",
  "courts/padel/padel_court_indoor_3.jpg",
  "courts/court_3_lsc_vingis.png",
];

type PopularCourt = { id: number; name: string; type: string; city: string; address?: string | null; imageUrl?: string | null; isIndoor?: boolean | null; rating?: number | null; pricePerHour?: number | string | null };

interface FeaturedTournament {
  id: number; name: string; sport: string; startDate: string; endDate: string;
  maxParticipants: number; entryFee: number | null; status: string;
  coverPhotoUrl: string | null; registrationCount: number; description: string | null;
  featuredUntil: string | null; isFeatured: boolean;
}

function FeaturedTournamentsSection() {
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
  const { data, isLoading } = useQuery<FeaturedTournament[]>({
    queryKey: ["featured-tournaments"],
    queryFn: () => customFetch<FeaturedTournament[]>(`${API_BASE}/tournaments?featured=1`),
  });

  if (isLoading) return null;
  const tournaments = (data ?? []).slice(0, 6);
  if (tournaments.length === 0) return null;

  return (
    <section className="py-14 md:py-20 container mx-auto px-4">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-3">
            <Flame className="w-3.5 h-3.5" /> Aktualūs turnyrai
          </div>
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">Artimiausi turnyrai</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Registruokis ir varžykis geriausiose Lietuvos aikštelėse.</p>
        </div>
        <Link href="/tournaments" className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">
          Visi turnyrai <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/tournaments/${t.id}`}>
            <div className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/60 hover:shadow-xl transition-all cursor-pointer h-full">
              <div className="h-32 bg-gradient-to-br from-primary/30 via-primary/15 to-background relative overflow-hidden">
                {t.coverPhotoUrl ? (
                  <img src={t.coverPhotoUrl} alt={t.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Trophy className="w-16 h-16 text-primary/30" />
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground shadow-md">
                  <Flame className="w-3 h-3 mr-1"/>Reklamuojamas
                </Badge>
              </div>
              <div className="p-5 space-y-3">
                <h3 className="font-bold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">{t.name}</h3>
                {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5"/>{new Date(t.startDate).toLocaleDateString("lt-LT", { month: "short", day: "numeric" })}</div>
                  <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5"/>{t.registrationCount}/{t.maxParticipants}</div>
                  {t.entryFee != null && <div className="flex items-center gap-1 font-semibold text-primary"><Euro className="w-3.5 h-3.5"/>{t.entryFee}</div>}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6 text-center md:hidden">
        <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Visi turnyrai <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

function StarRatingSmall({ rating }: { rating?: number | null }) {
  const t = useT();
  if (!rating) return <span className="text-[10px] text-muted-foreground italic">{t("detail.noReviews")}</span>;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: full }).map((_, i) => (
          <span key={`f${i}`} className="text-yellow-400 text-[11px] leading-none">★</span>
        ))}
        {hasHalf && <span className="text-yellow-300 text-[11px] leading-none">★</span>}
        {Array.from({ length: empty }).map((_, i) => (
          <span key={`e${i}`} className="text-muted-foreground/30 text-[11px] leading-none">★</span>
        ))}
      </div>
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function DragScrollRow({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  return (
    <div className="relative group/carousel">
      {/* Left arrow + fade */}
      <div className="absolute left-0 top-0 bottom-3 w-16 bg-gradient-to-r from-background/80 to-transparent z-10 pointer-events-none rounded-l-xl opacity-0 group-hover/carousel:opacity-100 transition-opacity" />
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-background/90 border shadow-md flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-accent"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={ref}
        className={`flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 cursor-grab active:cursor-grabbing select-none ${className ?? ""}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        onMouseDown={(e) => {
          dragging.current = true;
          startX.current = e.pageX - (ref.current?.offsetLeft ?? 0);
          scrollLeft.current = ref.current?.scrollLeft ?? 0;
        }}
        onMouseMove={(e) => {
          if (!dragging.current || !ref.current) return;
          e.preventDefault();
          const x = e.pageX - ref.current.offsetLeft;
          ref.current.scrollLeft = scrollLeft.current - (x - startX.current) * 1.5;
        }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
      >
        {children}
      </div>

      {/* Right arrow + fade */}
      <div className="absolute right-0 top-0 bottom-3 w-16 bg-gradient-to-l from-background/80 to-transparent z-10 pointer-events-none rounded-r-xl opacity-0 group-hover/carousel:opacity-100 transition-opacity" />
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-background/90 border shadow-md flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-accent"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function PopularCourtCard({ court }: { court: PopularCourt }) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const imgSrc = resolveCourtImage(court.imageUrl, court.type);
  const sportLabel = t(`sports.${court.type}` as never) || court.type;
  const color = sportColor[court.type] ?? "#84cc16";

  return (
    <Card
      className="h-full flex flex-col transition-colors duration-200 group overflow-hidden"
      style={{ borderColor: hovered ? color : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {imgSrc ? (
        <div className="w-full h-48 overflow-hidden bg-muted relative">
          <img
            src={imgSrc}
            alt={court.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(court.name)}&background=random&size=400`;
            }}
          />
          {court.isIndoor !== undefined && court.isIndoor !== null && (
            <div className="absolute top-2 right-2 flex gap-1 items-center">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                {court.isIndoor ? t("card.indoor") : t("card.outdoor")}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center">
          <SportIcon sport={court.type} size={40} style={{ color }} />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all duration-200 ${hovered ? "text-white" : "bg-muted text-muted-foreground"}`}
              style={hovered ? { background: color } : undefined}
            >
              <SportIcon sport={court.type} size={11} strokeWidth={2} className="shrink-0" />
              {sportLabel}
            </span>
            <StarRatingSmall rating={court.rating} />
          </div>
          {court.pricePerHour && (
            <span
              className="font-bold text-lg shrink-0 transition-colors duration-200"
              style={{ color: hovered ? color : undefined }}
            >
              <span className="text-xs font-normal text-muted-foreground mr-0.5">{t("card.from")}</span>{court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">{t("card.perHour")}</span>
            </span>
          )}
        </div>
        <CardTitle
          className="transition-colors duration-200 line-clamp-1 text-base"
          style={{ color: hovered ? color : undefined }}
        >
          {court.name}
        </CardTitle>
        <CardDescription className="flex items-center text-xs">
          <MapPin className="h-3 w-3 mr-1 shrink-0" />
          <span className="truncate">{court.city}{court.address ? ` — ${court.address}` : ""}</span>
        </CardDescription>
      </CardHeader>

      <CardFooter className="pt-0 mt-auto gap-2">
        <Link href={`/courts/${court.id}`} aria-label={t("card.view")}>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 transition-all duration-200 active:scale-[0.98]"
            title={t("card.view")}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </Link>
        <Link href={`/courts/${court.id}#reserve`} className="flex-1"
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
        >
          <Button
            className="w-full transition-all duration-200 active:scale-[0.98] font-semibold"
            style={{ backgroundColor: color, borderColor: color, color: "#fff", ...(btnHovered ? { boxShadow: `0 4px 14px ${color}55` } : {}) }}
          >
            {t("card.reserve")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function Home() {
  const t = useT();
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const { favorites, loading: favLoading } = useFavoritesContext();
  const [heroIdx, setHeroIdx] = useState(0);
  const ALL_SPORTS = Object.keys(sportLithuanian);
  const [activeSports, setActiveSports] = useState<Set<string>>(new Set(ALL_SPORTS));

  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) { next.delete(sport); } else { next.add(sport); }
      return next;
    });
  };
  const allActive = activeSports.size === ALL_SPORTS.length;
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [tappedStat, setTappedStat] = useState<string | null>(null);

  // Search bar state
  const [, setLocation] = useLocation();
  const [searchName, setSearchName] = useState("");
  const [searchSport, setSearchSport] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchTime, setSearchTime] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const cityRef = useRef<HTMLDivElement>(null);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const [timeSlider, setTimeSlider] = useState<number | null>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [searchDateObj, setSearchDateObj] = useState<Date | undefined>(undefined);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const dateRef = useRef<HTMLDivElement>(null);
  const [showMoreCities, setShowMoreCities] = useState(false);
  const { locale } = useI18n();

  // Time-of-day accent — uses local browser time so it's already location-aware
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const tick = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const TIME_PALETTES: { label: string; color: string; fg: string }[] = [
    { label: "dawn",      color: "#38bdf8", fg: "#000" }, // 05-09  sky blue
    { label: "morning",   color: "#84cc16", fg: "#000" }, // 10-13  lime (default)
    { label: "afternoon", color: "#f59e0b", fg: "#000" }, // 14-16  warm amber
    { label: "evening",   color: "#f97316", fg: "#000" }, // 17-20  sunset orange
    { label: "night",     color: "#8b5cf6", fg: "#fff" }, // 21-04  indigo/night
  ];
  const timePalette =
    currentHour >= 5  && currentHour < 10 ? TIME_PALETTES[0] :
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

  function handleSearch() {
    const params = new URLSearchParams();
    if (searchName.trim()) params.set("name", searchName.trim());
    if (searchSport) params.set("type", searchSport);
    if (searchCity) params.set("city", searchCity);
    if (searchDate) params.set("date", searchDate);
    if (searchTime) params.set("time", searchTime);
    setLocation(`/courts${params.toString() ? "?" + params.toString() : ""}`);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityDropdownOpen(false);
      }
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) {
        setTimeDropdownOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["courts"] });
    queryClient.invalidateQueries({ queryKey: ["cities"] });
  }, [queryClient]);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const SPORT_IMAGES: Record<string, string> = {
    tennis:     `${base}/courts/court_2_bernardinu.png`,
    basketball: `${base}/courts/court_17_zalgiris.png`,
    padel:      `${base}/courts/padel/padel_court_indoor_1.jpg`,
    football:   `${base}/courts/football/football_futsal_court_2.jpg`,
    badminton:  `${base}/courts/badminton/badminton_court_indoor_1.jpg`,
    squash:     `${base}/courts/squash/squash_court_1.jpg`,
    total:      `${base}/courts/court_1_seb_arena.png`,
  };

  const { data: stats, isLoading: statsLoading } = useGetStatsSummary({
    query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 },
  });
  const { data: popularCourts, isLoading: popularLoading } = useGetPopularCourts({
    query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 },
  });
  const { data: courts, isLoading: courtsLoading } = useListCourts(undefined, {
    query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 },
  });

  const filteredCourts = searchName.trim().length >= 2
    ? (courts ?? [])
        .filter(c => c.name.toLowerCase().includes(searchName.trim().toLowerCase()))
        .slice(0, 7)
    : [];

  const uniqueCities = [...new Set((courts ?? []).map(c => c.city).filter(Boolean))].sort();

  // City combobox helpers
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

  const heroLines = t("home.hero.title").split("\n");

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-zinc-950 text-white pt-24 pb-32">
        {/* Slideshow background */}
        <div className="absolute inset-0 z-0">
          {HERO_IMAGES.map((img, i) => (
            <img
              key={img}
              src={`${base}/${img}`}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: i === heroIdx ? 1 : 0,
                transition: "opacity 1.6s ease-in-out",
                zIndex: i === heroIdx ? 1 : 0,
              }}
              aria-hidden
            />
          ))}
          {/* Dark overlay — keeps text readable without being too heavy */}
          <div className="absolute inset-0 bg-zinc-950/65 z-10" />
        </div>
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent z-[1]"></div>
        <div className="container px-4 mx-auto relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance">
              {(() => {
                const [line1, line2] = heroLines;
                const isEnglishTop = line1?.toLowerCase().includes("find your court");
                const top = isEnglishTop ? line2 : line1;
                const bottom = isEnglishTop ? line1 : line2;
                return (
                  <>
                    {top}
                    <br />
                    <span className="text-primary">{bottom}</span>
                  </>
                );
              })()}
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-xl">
              {t("home.hero.subtitle")}
            </p>

            {/* Multi-row search widget */}
            <div className="w-full max-w-2xl space-y-2" ref={searchRef}>

              {/* Row 1: Court name with autocomplete */}
              <div className="relative max-w-md">
                <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md border rounded-xl px-4 py-3 transition-all"
                  style={{ borderColor: dropdownOpen || searchName ? accentColor : "rgba(255,255,255,0.4)" }}
                >
                  <Search className="h-4 w-4 shrink-0" style={{ color: dropdownOpen || searchName ? accentColor : "rgba(255,255,255,0.75)" }} />
                  <input
                    type="text"
                    placeholder="Ieškoti aikštelės pagal pavadinimą..."
                    value={searchName}
                    onChange={e => { setSearchName(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="bg-transparent flex-1 text-white placeholder:text-white/65 outline-none text-sm"
                  />
                  {searchName && (
                    <button onClick={() => setSearchName("")} className="text-white/40 hover:text-white/70 text-lg leading-none">×</button>
                  )}
                </div>
                {/* Autocomplete dropdown */}
                {dropdownOpen && filteredCourts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 backdrop-blur border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                    {filteredCourts.map(court => (
                      <Link
                        key={court.id}
                        href={`/courts/${court.id}`}
                        onClick={() => { setSearchName(""); setDropdownOpen(false); }}
                      >
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors cursor-pointer border-b border-white/5 last:border-b-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${sportColor[court.type] ?? "#84cc16"}22` }}>
                            <SportIcon sport={court.type} size={14} strokeWidth={2} style={{ color: sportColor[court.type] ?? "#84cc16" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{court.name}</p>
                            <p className="text-xs text-white/45">{court.city}</p>
                          </div>
                          {court.rating != null && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-yellow-400 text-xs">★</span>
                              <span className="text-xs text-white/60 font-medium">{Number(court.rating).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 2: Sport type pills */}
              <div className="flex gap-2 flex-wrap">
                {ALL_SPORTS.map(sport => {
                  const color = sportColor[sport] ?? "#84cc16";
                  const active = searchSport === sport;
                  return (
                    <button
                      key={sport}
                      onClick={() => setSearchSport(active ? "" : sport)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={active
                        ? { background: color, borderColor: color, color: "#000" }
                        : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }
                      }
                    >
                      <SportIcon sport={sport} size={11} strokeWidth={2} />
                      {sportLithuanian[sport]}
                    </button>
                  );
                })}
              </div>

              {/* Row 3: City + Date + Time + Search */}
              <div className="flex gap-2 flex-wrap items-center">

                {/* City combobox */}
                <div className="relative w-44 shrink-0" ref={cityRef}>
                  <div
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-md border rounded-xl px-3 py-2.5 cursor-text transition-all"
                    style={{ borderColor: cityDropdownOpen || searchCity ? accentColor : "rgba(255,255,255,0.4)" }}
                    onClick={() => setCityDropdownOpen(true)}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: cityDropdownOpen || searchCity ? accentColor : "rgba(255,255,255,0.75)" }} />
                    <input
                      type="text"
                      value={searchCity ? searchCity : cityInput}
                      placeholder="Miestas"
                      onFocus={() => { setCityDropdownOpen(true); if (searchCity) { setCityInput(""); } }}
                      onChange={e => {
                        setCityInput(e.target.value);
                        setSearchCity("");
                        setCityDropdownOpen(true);
                      }}
                      className="bg-transparent text-sm text-white placeholder:text-white/65 outline-none flex-1 w-full min-w-0"
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
                      {/* All cities option */}
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setSearchCity(""); setCityInput(""); setCityDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 flex items-center gap-2"
                        style={{ color: !searchCity && !cityInput ? accentColor : "rgba(255,255,255,0.6)", fontWeight: !searchCity && !cityInput ? "600" : "400" }}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        Visi miestai
                      </button>

                      {/* Popular cities */}
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

                      {/* Other cities — collapsed behind "More" button when not typing */}
                      {filteredOther.length > 0 && (
                        <>
                          {(showMoreCities || cityInput.length > 0) ? (
                            <>
                              <div className="px-4 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest border-t border-white/5">
                                Kiti miestai
                              </div>
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
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-md border rounded-xl px-3 py-2.5 transition-colors whitespace-nowrap"
                    style={{ borderColor: dateDropdownOpen ? accentColor : "rgba(255,255,255,0.4)" }}
                  >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: dateDropdownOpen || searchDateObj ? accentColor : "rgba(255,255,255,0.75)" }} />
                    <span className="text-sm text-white">
                      {searchDateObj ? format(searchDateObj, "d MMM", { locale: locale === "lt" ? ltLocale : locale === "ru" ? ruLocale : enUS }) : "Data"}
                    </span>
                    {searchDateObj && (
                      <span
                        onClick={e => { e.stopPropagation(); setSearchDateObj(undefined); setSearchDate(""); }}
                        className="text-white/40 hover:text-white/70 text-lg leading-none ml-1"
                      >×</span>
                    )}
                  </button>

                  {dateDropdownOpen && (() => {
                    const dnLocale = locale === "lt" ? ltLocale : locale === "ru" ? ruLocale : enUS;
                    const today = new Date(); today.setHours(0,0,0,0);
                    const monthStart = startOfMonth(calMonth);
                    const monthEnd = endOfMonth(calMonth);
                    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
                    // 7 short weekday names starting Monday
                    const refMon = new Date(2024, 3, 1);
                    const dayLabels = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(refMon); d.setDate(d.getDate() + i);
                      return format(d, "EEEEE", { locale: dnLocale });
                    });
                    return (
                      <>
                        {/* Mobile backdrop */}
                        <div
                          className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                          onClick={() => setDateDropdownOpen(false)}
                        />
                        <div className="
                          fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(280px,calc(100vw-1.5rem))]
                          sm:absolute sm:top-full sm:left-0 sm:translate-x-0 sm:translate-y-0 sm:mt-1 sm:w-[252px]
                          bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden
                        ">
                        {/* Month header */}
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8">
                          <button onMouseDown={e => e.preventDefault()} onClick={() => setCalMonth(m => subMonths(m, 1))} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-semibold text-white capitalize tracking-wide">
                            {format(calMonth, "LLLL yyyy", { locale: dnLocale })}
                          </span>
                          <button onMouseDown={e => e.preventDefault()} onClick={() => setCalMonth(m => addMonths(m, 1))} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="p-2">
                          {/* Day-of-week header */}
                          <div className="grid grid-cols-7 mb-1">
                            {dayLabels.map((label, i) => (
                              <div key={i} className="text-center text-[10px] font-semibold py-1"
                                style={{ color: i >= 5 ? accentColor + "88" : "rgba(255,255,255,0.3)" }}>
                                {label}
                              </div>
                            ))}
                          </div>

                          {/* Day grid */}
                          <div className="grid grid-cols-7 gap-y-0.5">
                            {days.map(day => {
                              const inMonth = isSameMonth(day, calMonth);
                              const isPast = isBefore(day, today);
                              const isSelected = searchDateObj ? isSameDay(day, searchDateObj) : false;
                              const isTodayDay = isToday(day);
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                              return (
                                <button
                                  key={day.toISOString()}
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    if (isPast) return;
                                    setSearchDateObj(day);
                                    setSearchDate(format(day, "yyyy-MM-dd"));
                                    setDateDropdownOpen(false);
                                  }}
                                  disabled={isPast}
                                  className={[
                                    "relative h-8 w-full rounded-lg text-xs font-medium transition-all duration-100 flex items-center justify-center",
                                    !inMonth ? "text-white/15" :
                                    isSelected ? "font-bold shadow-md" :
                                    isPast ? "text-white/18 cursor-not-allowed" :
                                    isTodayDay ? "bg-white/12 text-white ring-1 ring-white/20 hover:bg-white/20" :
                                    "hover:bg-white/10",
                                  ].join(" ")}
                                  style={
                                    isSelected ? { background: accentColor, color: accentFg } :
                                    (!isPast && !isTodayDay && inMonth && isWeekend) ? { color: accentColor + "bb" } :
                                    (!isPast && !isTodayDay && inMonth) ? { color: "rgba(255,255,255,0.8)" } :
                                    undefined
                                  }
                                >
                                  {format(day, "d")}
                                  {isTodayDay && !isSelected && (
                                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: accentColor }} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      </>
                    );
                  })()}
                </div>

                {/* Time slider popover */}
                <div className="relative" ref={timeRef}>
                  <button
                    onClick={() => setTimeDropdownOpen(v => !v)}
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-md border rounded-xl px-3 py-2.5 transition-colors whitespace-nowrap"
                    style={{ borderColor: timeDropdownOpen ? accentColor : "rgba(255,255,255,0.4)" }}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: timeDropdownOpen || timeSlider !== null ? accentColor : "rgba(255,255,255,0.75)" }} />
                    <span className="text-sm text-white">
                      {timeSlider !== null ? `${String(timeSlider).padStart(2, "0")}:00` : "Laikas"}
                    </span>
                    {timeSlider !== null && (
                      <span
                        onClick={e => { e.stopPropagation(); setTimeSlider(null); setSearchTime(""); }}
                        className="text-white/40 hover:text-white/70 text-lg leading-none ml-1"
                      >×</span>
                    )}
                  </button>

                  {timeDropdownOpen && (
                    <>
                      {/* Mobile backdrop */}
                      <div
                        className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setTimeDropdownOpen(false)}
                      />
                      <div className="
                        fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(280px,calc(100vw-1.5rem))]
                        sm:absolute sm:top-full sm:right-0 sm:left-auto sm:translate-x-0 sm:translate-y-0 sm:mt-1 sm:w-56
                        bg-zinc-900/96 backdrop-blur border border-white/10 rounded-xl p-3 shadow-2xl
                      ">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Pradžios laikas</span>
                        {timeSlider !== null && (
                          <button onClick={() => { setTimeSlider(null); setSearchTime(""); }} className="text-[10px] hover:underline" style={{ color: accentColor }}>Išvalyti</button>
                        )}
                      </div>

                      <div className="text-center mb-2">
                        <span className="text-2xl font-bold text-white tabular-nums">
                          {timeSlider !== null ? `${String(timeSlider).padStart(2, "0")}:00` : "--:--"}
                        </span>
                      </div>

                      <div className="relative px-0.5">
                        <input
                          type="range" min={6} max={23} step={1} value={timeSlider ?? 9}
                          onChange={e => { const h = Number(e.target.value); setTimeSlider(h); setSearchTime(`${String(h).padStart(2, "0")}:00`); }}
                          onMouseDown={() => { if (timeSlider === null) setTimeSlider(9); }}
                          className="time-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ background: timeSlider !== null ? `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${(((timeSlider - 6) / 17) * 100).toFixed(1)}%, rgba(255,255,255,0.15) ${(((timeSlider - 6) / 17) * 100).toFixed(1)}%, rgba(255,255,255,0.15) 100%)` : "rgba(255,255,255,0.15)" }}
                        />
                        <div className="flex justify-between mt-1.5">
                          {[6, 10, 14, 18, 22].map(h => (
                            <button key={h} onClick={() => { setTimeSlider(h); setSearchTime(`${String(h).padStart(2, "0")}:00`); }}
                              className="text-[9px] tabular-nums transition-colors"
                              style={{ color: timeSlider === h ? accentColor : "rgba(255,255,255,0.3)", fontWeight: timeSlider === h ? "700" : "400" }}
                            >{h}:00</button>
                          ))}
                        </div>
                      </div>

                      <button onClick={() => setTimeDropdownOpen(false)} className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: accentColor, color: accentFg }}>
                        Patvirtinti
                      </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleSearch}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0"
                  style={{ background: accentColor, color: accentFg, boxShadow: `0 0 16px ${accentColor}55` }}
                >
                  <Search className="h-4 w-4" />
                  Ieškoti
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 text-center divide-x divide-border/50">
            {statsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : stats ? (
              <>
                {[
                  { count: stats.totalCourts,                                                                                                              label: t("home.stats.courtsAvailable"), sport: null,           href: "/courts" },
                  { count: stats.tennisCourts,                                                                                                             label: t("sports.tennis"),             sport: "tennis",       href: "/courts?type=tennis" },
                  { count: stats.basketballCourts ?? 0,                                                                                                    label: t("sports.basketball"),         sport: "basketball",   href: "/courts?type=basketball" },
                  { count: stats.padelCourts ?? 0,                                                                                                         label: t("sports.padel"),              sport: "padel",        href: "/courts?type=padel" },
                  { count: stats.totalCourts - stats.tennisCourts - (stats.basketballCourts ?? 0) - (stats.padelCourts ?? 0),                              label: t("home.stats.otherSports"),    sport: "multi",        href: "/courts" },
                ].sort((a, b) => {
                  if (a.sport === "multi") return 1;
                  if (b.sport === "multi") return -1;
                  return b.count - a.count;
                }).map(({ count, label, sport, href }) => {
                  const numColor = sport === null ? undefined : sport === "multi" ? sportColor["football"] : sportColor[sport];
                  const isHovered = hoveredStat === label;
                  const imgKey = sport === null ? "total" : sport === "multi" ? "football" : sport;
                  const bgImage = SPORT_IMAGES[imgKey];
                  return (
                  <Link key={label} href={href}
                    className="group relative overflow-hidden px-4 py-6 cursor-pointer transition-colors"
                    onMouseEnter={() => setHoveredStat(label)}
                    onMouseLeave={() => setHoveredStat(null)}
                    onTouchStart={() => setTappedStat(label)}
                  >
                    {/* Background content — fades out on hover */}
                    <div
                      className="transition-opacity duration-200 group-hover:opacity-20"
                      style={{ opacity: tappedStat === label ? 0.2 : undefined }}
                    >
                      <div className="text-3xl font-bold mb-2 transition-colors" style={{ color: isHovered ? numColor : undefined }}>{count}</div>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                        {sport === null ? (
                          <Landmark className="h-3.5 w-3.5 shrink-0" />
                        ) : sport === "multi" ? (
                          <div className="flex gap-0.5">
                            {(["football","badminton","squash"] as const).map(s => (
                              <SportIcon key={s} sport={s} size={12} strokeWidth={2} style={{ color: sportColor[s] }} />
                            ))}
                          </div>
                        ) : (
                          <SportIcon sport={sport} size={14} strokeWidth={2} style={{ color: sportColor[sport] }} />
                        )}
                        {label}
                      </div>
                    </div>
                    {/* Hover overlay with sport-specific court photo */}
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200 ${tappedStat === label ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      style={{
                        backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${bgImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <Search className="h-5 w-5" style={{ color: numColor ?? "#fff" }} />
                      <span className="text-sm font-semibold tracking-wide" style={{ color: numColor ?? "#fff" }}>Ieškoti</span>
                    </div>
                  </Link>
                  );
                })}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <section className="py-12 md:py-24 container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          <div className="w-full md:w-1/3 flex flex-col">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">{t("home.map.title")}</h2>
            <p className="text-muted-foreground mb-6">{t("home.map.description")}</p>

            {/* Sport filter */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Sporto šaka</span>
                <button
                  onClick={() => setActiveSports(allActive ? new Set() : new Set(ALL_SPORTS))}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  {allActive ? "Slėpti visus" : "Visi"}
                </button>
              </div>
              <div className="space-y-1">
                {ALL_SPORTS.map(sport => {
                  const active = activeSports.has(sport);
                  const color = sportColor[sport] ?? "#84cc16";
                  const count = (courts ?? []).filter(c => c.type === sport).length;
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleSport(sport)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left ${
                        active ? "bg-muted/50 hover:bg-muted" : "opacity-40 hover:opacity-60 hover:bg-muted/30"
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{ background: active ? color : "transparent", borderColor: color }}
                      >
                        <SportIcon sport={sport} size={10} strokeWidth={2} style={{ color: active ? "white" : color }} />
                      </div>
                      <span className={`flex-1 text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {sportLithuanian[sport]}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Link href="/courts" className="inline-flex items-center text-primary font-medium hover:underline mt-auto">
              {t("home.map.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="w-full md:w-2/3 h-[300px] md:h-[500px] bg-muted/20 rounded-xl">
            {courtsLoading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : courts ? (
              <CourtMap courts={courts} activeSports={activeSports} />
            ) : null}
          </div>
        </div>
      </section>

      {/* Favorite Courts — only shown when signed in and has favorites */}
      {isSignedIn && (favLoading || favorites.length > 0) && (
        <section className="py-16 border-t border-border/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Mėgstamiausios aikštelės</h2>
                <p className="text-sm text-muted-foreground">Jūsų išsaugotos aikštelės</p>
              </div>
              <Link href="/courts" className="ml-auto">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                  Visos aikštelės <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {favLoading ? (
              <DragScrollRow>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="shrink-0 snap-start w-[280px] sm:w-[300px]">
                    <Skeleton className="h-[340px] w-full rounded-xl" />
                  </div>
                ))}
              </DragScrollRow>
            ) : favorites.length > 0 ? (
              <DragScrollRow>
                {favorites.map(court => (
                  <div key={court.id} className="shrink-0 snap-start w-[280px] sm:w-[300px]">
                    <CourtCard court={court} />
                  </div>
                ))}
              </DragScrollRow>
            ) : null}
          </div>
        </section>
      )}

      {/* Popular Courts */}
      <section className="py-12 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 md:mb-12 tracking-tight">{t("home.popular.title")}</h2>
          <DragScrollRow>
            {popularLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shrink-0 snap-start w-[280px] sm:w-[300px]">
                  <Skeleton className="h-[320px] w-full rounded-xl" />
                </div>
              ))
            ) : Array.isArray(popularCourts) ? (
              [...popularCourts]
                .sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0))
                .map(court => (
                  <div key={court.id} className="shrink-0 snap-start w-[280px] sm:w-[300px]">
                    <PopularCourtCard court={court} />
                  </div>
                ))
            ) : null}
          </DragScrollRow>
        </div>
      </section>

      {/* Featured Tournaments Section */}
      <FeaturedTournamentsSection />

      {/* Become a Partner Section */}
      <section className="py-20 bg-zinc-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,_rgba(132,204,22,0.08)_0%,_transparent_60%)] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: pitch */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest mb-6">
                <Building2 className="h-3.5 w-3.5" />
                Tapkite partneriu
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-5">
                Turite sportinę aikštelę?
                <br />
                <span className="text-primary">Uždirbkite daugiau.</span>
              </h2>
              <p className="text-zinc-400 text-base mb-8 leading-relaxed">
                Prisijunkite prie korts.lt partnerių tinklo. Mūsų skydelis rodo viską — nuo rezervacijų su klientų vardais iki „Stripe" mokėjimų ir biudžeto analizės.
              </p>

              {/* Feature list */}
              <ul className="space-y-3.5 mb-9">
                {[
                  { icon: CalendarDays, text: "Rezervacijų tvarkaraštis su klientų vardais realiuoju laiku" },
                  { icon: CreditCard, text: "Stripe mokėjimai — transakcijų istorija ir automatiniai išmokėjimai" },
                  { icon: BarChart3, text: "Biudžeto ir pajamų valdymas su augimu po mėnesio" },
                  { icon: Bell, text: "Momentiniai pranešimai apie naują rezervaciją ar atšaukimą" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="text-sm text-zinc-300 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/list-your-court" className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
                  Registruoti aikštelę <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="mailto:info@korts.lt" className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors">
                  <Mail className="h-4 w-4" /> Susisiekti su mumis
                </a>
              </div>
            </div>

            {/* Right: mock dashboard cards */}
            <div className="flex flex-col gap-3 lg:pl-4">

              {/* Booking schedule card */}
              <div className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-white">Šiandienės rezervacijos</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">2025-04-14</span>
                </div>
                <div className="divide-y divide-white/5">
                  {[
                    { time: "09:00–10:00", name: "Tomas K.", done: true },
                    { time: "11:00–13:00", name: "Laura M.", done: true },
                    { time: "14:00–15:00", name: "Andrius P.", done: true },
                    { time: "17:00–19:00", name: "Viktorija S.", done: false, highlight: true },
                    { time: "19:00–21:00", name: "Mindaugas J.", done: false },
                  ].map(({ time, name, done, highlight }) => (
                    <div key={time} className={`flex items-center gap-3 px-4 py-2.5 ${highlight ? "bg-primary/8" : ""}`}>
                      <span className={`text-xs tabular-nums font-mono w-24 shrink-0 ${highlight ? "text-primary font-semibold" : "text-zinc-400"}`}>{time}</span>
                      <span className={`text-sm flex-1 ${highlight ? "text-white font-medium" : "text-zinc-300"}`}>{name}</span>
                      {done
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        : <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${highlight ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-400"}`}>{highlight ? "Dabar" : "Laukia"}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom two cards */}
              <div className="grid grid-cols-2 gap-3">

                {/* Stripe transactions */}
                <div className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/8">
                    <CreditCard className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-xs font-semibold text-white">Stripe mokėjimai</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {[
                      { name: "Viktorija S.", amount: "€36.00", pending: true },
                      { name: "Tomas K.", amount: "€18.00", pending: false },
                      { name: "Laura M.", amount: "€36.00", pending: false },
                      { name: "Andrius P.", amount: "€18.00", pending: false },
                    ].map(({ name, amount, pending }) => (
                      <div key={name} className="flex items-center justify-between px-3.5 py-2">
                        <span className="text-[11px] text-zinc-400 truncate">{name}</span>
                        <span className={`text-[11px] font-semibold tabular-nums ml-2 shrink-0 ${pending ? "text-amber-400" : "text-emerald-400"}`}>{amount}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-3.5 py-2.5 border-t border-white/8 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Iš viso šiandien</span>
                    <span className="text-sm font-bold text-white">€108.00</span>
                  </div>
                </div>

                {/* Revenue / budget card */}
                <div className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/8">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-white">Biudžetas</span>
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="text-2xl font-bold text-white tabular-nums leading-none">€1 842</p>
                    <div className="flex items-center gap-1 mt-1 mb-3">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-semibold">+23%</span>
                      <span className="text-[10px] text-zinc-500 ml-0.5">vs. praėjęs mėn.</span>
                    </div>
                    {/* Mini bar chart */}
                    <div className="flex items-end gap-1 h-10">
                      {[45, 62, 38, 70, 55, 80, 74].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "#84cc16" : "rgba(255,255,255,0.12)" }} />
                      ))}
                    </div>
                    <div className="flex justify-between mt-1">
                      {["P","A","T","K","Pn","Š","S"].map((d, i) => (
                        <span key={i} className="flex-1 text-center text-[8px] text-zinc-600">{d}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/8">
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">47</p>
                        <p className="text-[9px] text-zinc-500">Rezervacijos</p>
                      </div>
                      <div className="w-px h-6 bg-white/10" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">3.2h</p>
                        <p className="text-[9px] text-zinc-500">Vid. trukmė</p>
                      </div>
                      <div className="w-px h-6 bg-white/10" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-primary">74%</p>
                        <p className="text-[9px] text-zinc-500">Užimtumas</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

    </Layout>
  );
}
