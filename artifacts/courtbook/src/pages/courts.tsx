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
import { ListCourtsCondition, ListCourtsType } from "@workspace/api-client-react/src/generated/api.schemas";
import { useT } from "@/lib/i18n";
import { SportIcon, sportColor } from "@/components/sport-icon";

type ViewMode = "list" | "map";

const PAGE_SIZE = 12;

const surfaceKeys = [
  "clay", "hard", "carpet", "synthetic_grass", "artificial_grass", "natural_grass", "parquet", "rubber",
] as const;

const conditionKeys: ListCourtsCondition[] = ["excellent", "good", "fair"];

export default function Courts() {
  const t = useT();
  const searchStr = useSearch();
  const initialType = (new URLSearchParams(searchStr.replace(/^\?/, "")).get("type") as ListCourtsType | null) ?? "all";

  const [search, setSearch] = useState("");
  const [type, setType] = useState<ListCourtsType | "all">(initialType);
  const [city, setCity] = useState<string>("all");
  const [surface, setSurface] = useState<string>("all");
  const [condition, setCondition] = useState<ListCourtsCondition | "all">("all");
  const [isIndoorFilter, setIsIndoorFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc">("default");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, type, city, surface, condition, isIndoorFilter, maxPrice, sortBy]);

  const { data: cities } = useListCities();

  const queryType = type === "all" ? undefined : type;
  const queryCity = city === "all" ? undefined : city;
  const querySurface = surface === "all" ? undefined : surface;
  const queryCondition = condition === "all" ? undefined : condition;
  const queryIsIndoor = isIndoorFilter === "all" ? undefined : isIndoorFilter === "indoor";

  const { data: courts, isLoading } = useListCourts({
    type: queryType,
    city: queryCity,
    surface: querySurface,
    condition: queryCondition,
    isIndoor: queryIsIndoor,
    maxPrice,
  });

  const filteredCourts = courts?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.city.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  const sortedCourts = filteredCourts ? [...filteredCourts].sort((a, b) => {
    if (sortBy === "price_asc") return a.pricePerHour - b.pricePerHour;
    if (sortBy === "price_desc") return b.pricePerHour - a.pricePerHour;
    return 0;
  }) : filteredCourts;

  const totalCourts = sortedCourts?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCourts / PAGE_SIZE));
  const pagedCourts = sortedCourts?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [
    type !== "all",
    city !== "all",
    surface !== "all",
    condition !== "all",
    isIndoorFilter !== "all",
    maxPrice < 100,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setType("all");
    setCity("all");
    setSurface("all");
    setCondition("all");
    setIsIndoorFilter("all");
    setMaxPrice(100);
    setSearch("");
    setSortBy("default");
  };

  const sportItems = [
    { value: "tennis" },
    { value: "basketball" },
    { value: "padel" },
    { value: "football" },
    { value: "badminton" },
    { value: "squash" },
  ] as const;

  const filterControls = (
    <div className="space-y-6">
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

      {/* Sort */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.sort")}</Label>
        <Select value={sortBy} onValueChange={(v: "default" | "price_asc" | "price_desc") => setSortBy(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("courts.filters.sortDefault")}</SelectItem>
            <SelectItem value="price_asc">{t("courts.filters.sortPriceAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("courts.filters.sortPriceDesc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sport Type */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.sportType")}</Label>
        <Select value={type} onValueChange={(v: ListCourtsType | "all") => setType(v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("courts.filters.allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("courts.filters.allTypes")}</SelectItem>
            {sportItems.map(s => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  <SportIcon sport={s.value} size={14} strokeWidth={1.8} style={{ color: sportColor[s.value] }} />
                  {t(`sports.${s.value}`)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.city")}</Label>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger>
            <SelectValue placeholder={t("courts.filters.allCities")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("courts.filters.allCities")}</SelectItem>
            {cities?.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Condition */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("courts.filters.condition")}</Label>
        <Select value={condition} onValueChange={(v: ListCourtsCondition | "all") => setCondition(v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("courts.filters.anyCondition")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("courts.filters.anyCondition")}</SelectItem>
            {conditionKeys.map(key => (
              <SelectItem key={key} value={key}>{t(`conditions.${key}`)}</SelectItem>
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
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{t("courts.title")}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base">{t("courts.subtitle")}</p>
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
        <SheetContent side="bottom" className="h-[85dvh] overflow-y-auto rounded-t-2xl pb-safe">
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
          {filterControls}
          <div className="mt-6 pt-4 border-t">
            <SheetClose asChild>
              <Button className="w-full" size="lg">
                {t("courts.found", { n: filteredCourts?.length ?? 0 })}
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
            <div className="hidden md:flex mb-6 justify-between items-center">
              <h2 className="text-base font-semibold text-muted-foreground">
                {isLoading ? "..." : viewMode === "list" && totalPages > 1
                  ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCourts)} / ${totalCourts}`
                  : t("courts.found", { n: totalCourts })}
              </h2>
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
                <CourtMap courts={sortedCourts ?? []} />
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
