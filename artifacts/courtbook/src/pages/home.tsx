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
import { MapPin, ArrowRight, Heart, Landmark, Search, Building2, Mail, Phone, Instagram, Facebook, MessageCircle, CalendarDays, Clock, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, CreditCard, Users, BarChart3, CheckCircle2, Euro, Bell, Trophy, Flame, Eye, X } from "lucide-react";
import { useT, useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useUser } from "@clerk/react";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { sportLithuanian } from "@/components/court-map";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { resolveCourtImage } from "@/lib/imageUrl";
import { format } from "date-fns";
import { DateCalendar } from "@/components/ui/date-calendar";
import { lt as ltLocale, enUS, ru as ruLocale } from "date-fns/locale";

const HERO_IMAGES = [
  "courts/court_2_bernardinu_small.png",
  "courts/padel/padel_court_indoor_1.jpg",
  "courts/court_1_seb_arena_small.png",
  "courts/football/football_futsal_court_2.jpg",
  "courts/court_4_verkiai_small.png",
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
                  <img src={resolveCourtImage(t.coverPhotoUrl)} alt={t.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
      {/* Left arrow only — no fade gradient */}
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

      {/* Right arrow only — no fade gradient */}
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
            loading="lazy"
            decoding="async"
            width={300}
            height={192}
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
  const isMobile = useIsMobile();
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
  const dateRef = useRef<HTMLDivElement>(null);
  const [showMoreCities, setShowMoreCities] = useState(false);
  const { locale } = useI18n();

  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const tick = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const TIME_PALETTES: { label: string; color: string; fg: string }[] = [
    { label: "dawn",      color: "#38bdf8", fg: "#000" },
    { label: "morning",   color: "#84cc16", fg: "#000" },
    { label: "afternoon", color: "#f59e0b", fg: "#000" },
    { label: "evening",   color: "#f97316", fg: "#000" },
    { label: "night",     color: "#8b5cf6", fg: "#fff" },
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
    tennis:     `${base}/courts/court_2_bernardinu.webp`,
    basketball: `${base}/courts/court_17_zalgiris.webp`,
    padel:      `${base}/courts/padel/padel_court_indoor_1.webp`,
    football:   `${base}/courts/football/football_futsal_court_2.webp`,
    badminton:  `${base}/courts/badminton/badminton_court_indoor_1.webp`,
    squash:     `${base}/courts/squash/squash_court_1.webp`,
    total:      `${base}/courts/court_1_seb_arena.webp`,
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
      {/* Hero Section — split layout */}
      <section className="bg-background text-foreground">
        <div className="flex">
          <div className="relative z-10 w-full md:w-[400px] lg:w-[440px] xl:w-[480px] flex-shrink-0 flex flex-col justify-start px-5 sm:px-6 lg:px-10 pt-6 pb-6 lg:pt-12 lg:pb-14">
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/50 via-transparent to-transparent" />
              <div className="w-full space-y-2.5 sm:space-y-2" ref={searchRef}>
              <div className="relative w-full max-w-sm">
                  <div className="flex items-center gap-3 bg-muted/70 dark:bg-white/20 dark:backdrop-blur-md border border-border rounded-xl px-4 py-3 transition-all text-foreground"
                  style={{ borderColor: (dropdownOpen || searchName) ? accentColor : undefined }}
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground dark:text-white/75" style={{ color: (dropdownOpen || searchName) ? accentColor : undefined }} />
                  <input
                    type="text"
                    placeholder="Ieškoti aikštelės pagal pavadinimą..."
                    value={searchName}
                    onChange={e => { setSearchName(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="bg-transparent flex-1 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/65 outline-none text-sm"
                  />
                  {searchName && (
                    <button onClick={() => setSearchName("")} className="text-muted-foreground/60 hover:text-muted-foreground dark:text-white/40 dark:hover:text-white/70 text-lg leading-none">×</button>
                  )}
                </div>
                {dropdownOpen && filteredCourts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card dark:bg-zinc-900/95 backdrop-blur border border-border dark:border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                    {filteredCourts.map(court => (
                      <Link
                        key={court.id}
                        href={`/courts/${court.id}`}
                        onClick={() => { setSearchName(""); setDropdownOpen(false); }}
                      >
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted dark:hover:bg-white/10 transition-colors cursor-pointer border-b border-border dark:border-white/5 last:border-b-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${sportColor[court.type] ?? "#84cc16"}22` }}>
