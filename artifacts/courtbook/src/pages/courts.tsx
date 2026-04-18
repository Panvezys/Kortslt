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
import { Search, Map, List, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ListCourtsType } from "@workspace/api-client-react";
import { useT } from "@/lib/i18n";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { useFavoritesContext } from "@/lib/FavoritesContext";

type ViewMode = "list" | "map";

const PAGE_SIZE = 12;

const surfaceKeys = ["clay", "hard", "carpet", "synthetic_grass", "artificial_grass", "natural_grass", "parquet", "rubber"] as const;

const HERO_IMAGES = [
  "courts/court_2_bernardinu.png",
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

  // Sort cities by court count descending
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
    return matchesSearch && matchesCity;
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
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedCities(new Set());
    setSurface("all");
    setIsIndoorFilter("all");
    setMaxPrice(100);
    setSearch("");
    setSortBy("default");
    setActiveSports(new Set(ALL_SPORTS));
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
      {/* Sport filter (icon buttons) */}
      {sportFilterControls}

      {/* City — multi-select, sorted by court count */}
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

      {/* Search */}
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

      {/* Indoor / Outdoor */}
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

      {/* Surface */}
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

      {/* Max Price */}
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
      {/* Hero banner with rotating court photos */}
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-white drop-shadow-md">
            {t("courts.title")}
          </h1>
          <p className="text-white/80 max-w-2xl text-sm md:text-base leading-relaxed drop-shadow">
            {t("courts.subtitle")}
          </p>
        </div>
      </div>

      {/* Mobile top bar: filters button + view toggle */}
      <div className="md:hidden sticky top-16 z-30 border-b bg-background/95 backdrop-blur px-4 py-2.5 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 flex-1"
          onClick={() => setMobileFiltersOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("courts.filters.title")}
          {activeFilterCount > 0 && (
            <Badge className="h-5 px-1.5 text-xs ml-1">{activeFilterCount}</Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground px-2" onClick={resetFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="flex gap-1 rounded-md border p-0.5 ml-auto">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
          >
            <Map className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl flex flex-col">
          <SheetHeader className="mb-4 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t("courts.filters.title")}
              {activeFilterCount > 0 && (
                <Badge className="h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
              )}
            </SheetTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={resetFilters}>
                <X className="h-3 w-3 mr-1" /> {t("courts.filters.reset")}
              </Button>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-1">{filterControls}</div>
          <div className="shrink-0 border-t pt-4 pb-2">
            <SheetClose asChild>
              <Button className="w-full" size="lg">
                {t("courts.found", { n: sortedCourts?.length ?? 0 })}
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Filters Sidebar — desktop only */}
          <aside className="hidden md:block w-64 shrink-0 space-y-6 sticky top-24 overflow-y-auto max-h-[calc(100vh-7rem)] pr-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <SlidersHorizontal className="h-4 w-4" />
                {t("courts.filters.title")}
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
                )}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={resetFilters}>
                  <X className="h-3 w-3 mr-1" /> {t("courts.filters.reset")}
                </Button>
              )}
            </div>
            {filterControls}
          </aside>

          {/* Main Content */}
          <main className="flex-1 w-full min-w-0">
            {/* Desktop view toggle + count */}
            <div className="hidden md:flex mb-6 justify-between items-center gap-3">
              <h2 className="text-base font-semibold text-muted-foreground shrink-0">
                {isLoading ? "..." : viewMode === "list" && totalPages > 1
                  ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCourts)} / ${totalCourts}`
                  : t("courts.found", { n: totalCourts })}
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                <Select value={sortBy} onValueChange={(v: "default" | "price_asc" | "price_desc" | "rating_desc" | "favorites_first") => setSortBy(v)}>
                  <SelectTrigger className="h-8 text-xs w-48 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t("courts.filters.sortDefault")}</SelectItem>
                    <SelectItem value="rating_desc">{t("courts.filters.sortRating")}</SelectItem>
                    <SelectItem value="favorites_first">{t("courts.filters.sortFavorites")}</SelectItem>
                    <SelectItem value="price_asc">{t("courts.filters.sortPriceAsc")}</SelectItem>
                    <SelectItem value="price_desc">{t("courts.filters.sortPriceDesc")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 rounded-md border p-0.5">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <List className="h-3.5 w-3.5" /> {t("courts.listView")}
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <Map className="h-3.5 w-3.5" /> {t("courts.mapView")}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile result count */}
            <div className="md:hidden mb-4 text-sm font-medium text-muted-foreground">
              {isLoading ? "..." : viewMode === "list" && totalPages > 1
                ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCourts)} / ${totalCourts}`
                : t("courts.found", { n: totalCourts })}
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
                <Skeleton className="h-[400px] md:h-[600px] w-full rounded-xl" />
              )
            ) : viewMode === "map" ? (
              <div className="h-[400px] md:h-[600px]">
                <CourtMap courts={sortedCourts ?? []} activeSports={activeSports} />
              </div>
            ) : pagedCourts && pagedCourts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {pagedCourts.map(court => (
                    <CourtCard key={court.id} court={court} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
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
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "…" ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
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
                      variant="outline"
                      size="sm"
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
                <div className="text-4xl mb-4">🎾</div>
                <h3 className="text-xl font-bold mb-2">{t("courts.noResults").split(".")[0]}</h3>
                <p className="text-muted-foreground mb-4 px-4">{t("courts.noResults").split(".").slice(1).join(".").trim()}</p>
                <Button variant="outline" onClick={resetFilters}>{t("courts.filters.reset")}</Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
