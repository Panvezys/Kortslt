import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { useListCourts, useListCities } from "@workspace/api-client-react";
import { CourtCard } from "@/components/court-card";
import { CourtMap } from "@/components/court-map";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Search, Map, List, SlidersHorizontal, X, ChevronLeft, ChevronRight, MapPin, Navigation } from "lucide-react";
import { ListCourtsType } from "@workspace/api-client-react";
import { useT } from "@/lib/i18n";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { useFavoritesContext } from "@/lib/FavoritesContext";

type ViewMode = "list" | "map";

const PAGE_SIZE = 12;

const NEARBY_KM = 30;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const surfaceKeys = ["clay", "hard", "carpet", "synthetic_grass", "artificial_grass", "natural_grass", "parquet", "rubber"] as const;

const HERO_IMAGES = [
  "courts/court_2_bernardinu_small.webp",
  "courts/padel/padel_court_indoor_1.jpg",
  "courts/court_17_zalgiris.png",
  "courts/football/football_futsal_court_2.jpg",
  "courts/badminton/badminton_court_indoor_1.jpg",
  "courts/squash/squash_court_1.jpg",
  "courts/court_4_verkiai.png",
  "courts/padel/padel_court_indoor_3.jpg",
  "courts/court_3_lsc_vingis.png",
  "courts/court_1_seb_arena.png",
];

export default function Courts() {
  const t = useT();
  const searchStr = useSearch();
  const _qp = new URLSearchParams(searchStr.replace(/^\?/, ""));
  const initialType = (_qp.get("type") as ListCourtsType | null) ?? null;
  const initialName = _qp.get("name") ?? "";
  const initialCity = _qp.get("city") ?? "";

  const ALL_SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];
  const sportLT: Record<string, string> = {
    tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
    table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
    football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  };

  const [search, setSearch] = useState(initialName);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(initialCity ? new Set([initialCity]) : new Set());
  const [surface, setSurface] = useState<string>("all");
  const [isIndoorFilter, setIsIndoorFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc" | "rating_desc" | "favorites_first">("default");
  const { favoriteIds } = useFavoritesContext();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [bgIdx, setBgIdx] = useState(0);
  const [cityExpanded, setCityExpanded] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleNearbyList = () => {
    if (nearbyMode) {
      setNearbyMode(false);
      setUserLocation(null);
      setNearbyError(null);
      return;
    }
    if (!navigator.geolocation) {
      setNearbyError("Jūsų naršyklė nepalaiko geolokacijos.");
      return;
    }
    setNearbyLoading(true);
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearbyMode(true);
        setNearbyLoading(false);
      },
      (err) => {
        setNearbyLoading(false);
        setNearbyError(err.code === 1 ? "Leiskite prieigą prie vietos." : "Nepavyko nustatyti vietos.");
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    const id = setInterval(() => setBgIdx(i => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [page, setPage] = useState(1);
  const [activeSports, setActiveSports] = useState<Set<string>>(
    initialType && ALL_SPORTS.includes(initialType) ? new Set([initialType]) : new Set(ALL_SPORTS)
  );

  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
      } else {
        next.add(sport);
      }
      return next;
    });
  };
  const allSportsActive = activeSports.size === ALL_SPORTS.length;

  const toggleCity = (c: string) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  useEffect(() => {
    setPage(1);
  }, [search, selectedCities, surface, isIndoorFilter, maxPrice, sortBy, activeSports]);

  const { data: cities } = useListCities();

  const querySurface = surface === "all" ? undefined : surface;
  const queryIsIndoor = isIndoorFilter === "all" ? undefined : isIndoorFilter === "indoor";

  const { data: courts, isLoading } = useListCourts({
    surface: querySurface,
    isIndoor: queryIsIndoor,
    maxPrice,
  });

  const cityCounts = (courts ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.city] = (acc[c.city] ?? 0) + 1;
    return acc;
  }, {});
  const sortedCities = (cities ?? []).slice().sort((a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0));

  const filteredCourts = courts?.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase());
    const matchesCity = selectedCities.size === 0 || selectedCities.has(c.city);
    const matchesNearby = !nearbyMode || !userLocation || haversineKm(userLocation.lat, userLocation.lng, c.latitude, c.longitude) <= NEARBY_KM;
    return matchesSearch && matchesCity && matchesNearby;
  });

  const sortedCourts = filteredCourts ? [...filteredCourts]
    .filter(c => activeSports.has(c.type))
    .sort((a, b) => {
      if (sortBy === "favorites_first") {
        const aFav = favoriteIds.has(a.id) ? 0 : 1;
        const bFav = favoriteIds.has(b.id) ? 0 : 1;
        return aFav - bFav;
      }
      if (sortBy === "rating_desc") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "price_asc") return a.pricePerHour - b.pricePerHour;
      if (sortBy === "price_desc") return b.pricePerHour - a.pricePerHour;
      return 0;
    }) : filteredCourts;

  const totalCourts = sortedCourts?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCourts / PAGE_SIZE));
  const pagedCourts = sortedCourts?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [
    selectedCities.size > 0,
    surface !== "all",
    isIndoorFilter !== "all",
    maxPrice < 100,
    activeSports.size < ALL_SPORTS.length,
    nearbyMode,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedCities(new Set());
    setSurface("all");
    setIsIndoorFilter("all");
    setMaxPrice(100);
    setSearch("");
    setSortBy("default");
    setActiveSports(new Set(ALL_SPORTS));
    setNearbyMode(false);
    setUserLocation(null);
    setNearbyError(null);
  };

  const sportFilterControls = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sporto šakos</Label>
        <button
          onClick={() => setActiveSports(allSportsActive ? new Set() : new Set(ALL_SPORTS))}
          className="text-[10px] font-medium text-primary hover:underline"
        >
          {allSportsActive ? "Slėpti viską" : "Rodyti viską"}
        </button>
      </div>
      <div className="space-y-1">
        {ALL_SPORTS.map(sport => {
          const active = activeSports.has(sport);
          const color = sportColor[sport];
          const count = (courts ?? []).filter(c => c.type === sport).length;
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
  );

  const filterControls = (
    <div className="space-y-6">
      <div>
        <button
          onClick={handleNearbyList}
          disabled={nearbyLoading}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            nearbyMode
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border bg-muted/40 hover:bg-muted text-foreground"
          } disabled:opacity-60`}
        >
          {nearbyLoading ? (
            <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round"/>
            </svg>
          ) : (
            <Navigation className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1 text-left">
            {nearbyMode ? `Netoliese (${NEARBY_KM} km) ✕` : "Ieškoti netoliese"}
          </span>
        </button>
        {nearbyError && (
          <p className="mt-1.5 text-xs text-destructive">{nearbyError}</p>
        )}
      </div>

      {sportFilterControls}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.city")}</Label>
          {selectedCities.size > 0 && (
            <button
              onClick={() => setSelectedCities(new Set())}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Valyti ({selectedCities.size})
            </button>
          )}
        </div>
        <div className="space-y-1">
          {(cityExpanded ? sortedCities : sortedCities.filter((c, i) => i < 5 || selectedCities.has(c))).map(c => {
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
        {sortedCities.length > 5 && (
          <button
            onClick={() => setCityExpanded(v => !v)}
            className="mt-1 text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
          >
            {cityExpanded
              ? "Rodyti mažiau ↑"
              : `Rodyti daugiau (${sortedCities.length - 5}) ↓`}
          </button>
        )}
      </div>

      <div>
        <Label htmlFor="search" className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.search")}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder={t("courts.filters.searchPlaceholder")}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.location")}</Label>
        <div className="flex rounded-md border overflow-hidden">
          {(["all", "indoor", "outdoor"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setIsIndoorFilter(opt)}
              className={`flex-1 text-xs py-2.5 font-medium transition-colors ${isIndoorFilter === opt ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted text-muted-foreground"}`}
            >
              {opt === "all" ? t("courts.filters.all") : opt === "indoor" ? t("courts.filters.indoor") : t("courts.filters.outdoor")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.surface")}</Label>
        <Select value={surface} onValueChange={setSurface}>
          <SelectTrigger>
            <SelectValue placeholder={t("courts.filters.allSurfaces")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("courts.filters.allSurfaces")}</SelectItem>
            {surfaceKeys.map(key => (
              <SelectItem key={key} value={key}>{t(`surfaces.${key}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>{t("courts.filters.maxPrice")}</span>
          <span className="text-primary font-bold normal-case text-sm">{maxPrice}€</span>
        </Label>
        <Slider
          value={[maxPrice]}
          onValueChange={(v) => setMaxPrice(v[0])}
          max={100}
          step={5}
          className="my-3"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0€</span>
          <span>100€+</span>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="relative overflow-hidden border-b" style={{ minHeight: "180px" }}>
        {HERO_IMAGES.map((img, i) => (
          <div
            key={img}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${base}/${img})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === bgIdx ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />
        <div className="relative z-10 container mx-auto px-4 py-10 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 drop-shadow-md text-[#C5E041] bg-[transparent]">
            {t("courts.title")}
          </h1>
          <p className="text-white/80 max-w-2xl text-sm md:text-base leading-relaxed drop-shadow">
            {t("courts.subtitle")}
          </p>
        </div>
      </div>
      {/* rest of file unchanged */}
    </Layout>
  );
}
