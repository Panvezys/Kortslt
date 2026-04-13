import { useState } from "react";
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

type ViewMode = "list" | "map";

const surfaceOptions = [
  { value: "clay", label: "Gruntas" },
  { value: "hard", label: "Kieta danga" },
  { value: "carpet", label: "Kilimas" },
  { value: "synthetic_grass", label: "Sintetinė žolė" },
  { value: "artificial_grass", label: "Dirbtinė žolė" },
  { value: "natural_grass", label: "Natūrali žolė" },
  { value: "parquet", label: "Parketas" },
  { value: "rubber", label: "Guma" },
];

const conditionOptions: { value: ListCourtsCondition; label: string }[] = [
  { value: "excellent", label: "Puiki" },
  { value: "good", label: "Gera" },
  { value: "fair", label: "Patenkinama" },
];

export default function Courts() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ListCourtsType | "all">("all");
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

  return (
    <Layout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Rasti kortą</h1>
          <p className="text-muted-foreground max-w-2xl">
            Visi teniso ir krepšinio kortai Lietuvoje. Filtruokite pagal miestą, dangos tipą, buklę ir kainą.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Filters Sidebar */}
          <aside className="w-full md:w-64 shrink-0 space-y-6 sticky top-24">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <SlidersHorizontal className="h-4 w-4" />
                Filtrai
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
                )}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={resetFilters}>
                  <X className="h-3 w-3 mr-1" /> Išvalyti
                </Button>
              )}
            </div>

            {/* Search */}
            <div>
              <Label htmlFor="search" className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Paieška</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Korto pavadinimas ar miestas..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Sport Type */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Sporto šaka</Label>
              <Select value={type} onValueChange={(v: ListCourtsType | "all") => setType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Visi tipai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi tipai</SelectItem>
                  <SelectItem value="tennis">🎾 Tenisas</SelectItem>
                  <SelectItem value="basketball">🏀 Krepšinis</SelectItem>
                  <SelectItem value="padel">🏓 Padelis</SelectItem>
                  <SelectItem value="football">⚽ Futbolas</SelectItem>
                  <SelectItem value="badminton">🏸 Badmintonas</SelectItem>
                  <SelectItem value="squash">🎯 Squash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* City */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Miestas</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Visi miestai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi miestai</SelectItem>
                  {cities?.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Indoor / Outdoor */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Vieta</Label>
              <div className="flex rounded-md border overflow-hidden">
                {(["all", "indoor", "outdoor"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setIsIndoorFilter(opt)}
                    className={`flex-1 text-xs py-2 font-medium transition-colors ${isIndoorFilter === opt ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted text-muted-foreground"}`}
                  >
                    {opt === "all" ? "Visi" : opt === "indoor" ? "Vidaus" : "Lauko"}
                  </button>
                ))}
              </div>
            </div>

            {/* Surface */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Dangos tipas</Label>
              <Select value={surface} onValueChange={setSurface}>
                <SelectTrigger>
                  <SelectValue placeholder="Visos dangos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos dangos</SelectItem>
                  {surfaceOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Korto bukle</Label>
              <Select value={condition} onValueChange={(v: ListCourtsCondition | "all") => setCondition(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Bet kokia bukle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bet kokia bukle</SelectItem>
                  {conditionOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Price */}
            <div>
              <Label className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Maks. kaina / val.</span>
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
                {isLoading ? "Kraunama..." : `Rasta ${filteredCourts?.length ?? 0} kortų`}
              </h2>
              <div className="flex gap-1 rounded-md border p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <List className="h-3.5 w-3.5" /> Sarašas
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <Map className="h-3.5 w-3.5" /> Zemelapis
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
                <h3 className="text-xl font-bold mb-2">Kortų nerasta</h3>
                <p className="text-muted-foreground mb-4">
                  Pabandykite pakeisti filtrus arba ieskokite kitame mieste.
                </p>
                <Button variant="outline" onClick={resetFilters}>Išvalyti filtrus</Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
