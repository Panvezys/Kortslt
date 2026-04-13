import { useState } from "react";
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
import { Search, Map, List, SlidersHorizontal, X } from "lucide-react";
import { ListCourtsCondition, ListCourtsType } from "@workspace/api-client-react/src/generated/api.schemas";
import { useT } from "@/lib/i18n";

type ViewMode = "list" | "map";

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
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
  };

  const sportItems = [
    { value: "tennis", emoji: "🎾" },
    { value: "basketball", emoji: "🏀" },
    { value: "padel", emoji: "🏓" },
    { value: "football", emoji: "⚽" },
    { value: "badminton", emoji: "🏸" },
    { value: "squash", emoji: "🎯" },
  ] as const;

  return (
    <Layout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{t("courts.title")}</h1>
          <p className="text-muted-foreground max-w-2xl">{t("courts.subtitle")}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Filters Sidebar */}
          <aside className="w-full md:w-64 shrink-0 space-y-6 sticky top-24">
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
                      {s.emoji} {t(`sports.${s.value}`)}
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
                    className={`flex-1 text-xs py-2 font-medium transition-colors ${isIndoorFilter === opt ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted text-muted-foreground"}`}
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
          </aside>

          {/* Main Content */}
          <main className="flex-1 w-full min-w-0">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-base font-semibold text-muted-foreground">
                {isLoading ? "..." : t("courts.found", { n: filteredCourts?.length ?? 0 })}
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

            {isLoading ? (
              viewMode === "list" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col space-y-3">
                      <Skeleton className="h-[200px] w-full rounded-xl" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <Skeleton className="h-[600px] w-full rounded-xl" />
              )
            ) : viewMode === "map" ? (
              <div className="h-[600px]">
                <CourtMap courts={filteredCourts ?? []} />
              </div>
            ) : filteredCourts && filteredCourts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourts.map(court => (
                  <CourtCard key={court.id} court={court} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border rounded-xl bg-muted/10 border-dashed">
                <div className="text-4xl mb-4">🎾</div>
                <h3 className="text-xl font-bold mb-2">{t("courts.noResults").split(".")[0]}</h3>
                <p className="text-muted-foreground mb-4">{t("courts.noResults").split(".").slice(1).join(".").trim()}</p>
                <Button variant="outline" onClick={resetFilters}>{t("courts.filters.reset")}</Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
