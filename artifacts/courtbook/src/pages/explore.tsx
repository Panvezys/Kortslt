import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Search, SlidersHorizontal, X, ArrowUpDown, Map as MapIcon, List, Navigation } from "lucide-react";
import { FacilitySportCard } from "@/components/facility-sport-card";
import { CourtMap, type CourtHrefBuilder } from "@/components/court-map";
import { buildDetailHref, type SearchGroupResult, type SearchGroupFilters } from "@/lib/search-groups-types";
import { SPORT_LABELS, SportIcon, sportColor } from "@/components/sport-icon";
import { customFetch, type Court } from "@workspace/api-client-react";

type SortKey = "default" | "price_asc" | "price_desc" | "rating_desc";
type ViewMode = "list" | "map";

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

async function fetchGroups(filters: SearchGroupFilters): Promise<SearchGroupResult[]> {
  const p = new URLSearchParams();
  if (filters.surface)   p.set("surface",   filters.surface);
  if (filters.isIndoor !== undefined) p.set("isIndoor", String(filters.isIndoor));
  const qs = p.toString();
  const result = await customFetch<SearchGroupResult[]>(`/api/search/groups${qs ? `?${qs}` : ""}`, { responseType: "json" });
  return Array.isArray(result) ? result : [];
}

export default function ExplorePage() {
  const search = useSearch();
  const sp = new URLSearchParams(search);

  // Server-side filters (trigger re-fetch)
  const [surface,  setSurface]  = useState<string>(sp.get("surface")  ?? "");
  const [isIndoor, setIsIndoor] = useState<string>(sp.get("isIndoor") ?? "");

  // Client-side filters (instant, no re-fetch)
  const [activeSport, setActiveSport] = useState<string>(sp.get("sport") ?? "");
  const [city,        setCity]        = useState<string>(sp.get("city")  ?? "");
  const [nameQ,       setNameQ]       = useState<string>(sp.get("name")  ?? "");
  const [minPrice,    setMinPrice]    = useState<string>("");
  const [maxPrice,    setMaxPrice]    = useState<string>("");
  const [sortBy,      setSortBy]      = useState<SortKey>("default");
  const [viewMode,    setViewMode]    = useState<ViewMode>("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Nearby (geolocation) filter
  const [nearbyMode,    setNearbyMode]    = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError,   setNearbyError]   = useState<string | null>(null);
  const [userLocation,  setUserLocation]  = useState<{ lat: number; lng: number } | null>(null);

  function handleNearby() {
    if (nearbyMode) { setNearbyMode(false); setUserLocation(null); setNearbyError(null); return; }
    if (!navigator.geolocation) { setNearbyError("Jūsų naršyklė nepalaiko geolokacijos."); return; }
    setNearbyLoading(true);
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearbyMode(true); setNearbyLoading(false); },
      (err) => { setNearbyLoading(false); setNearbyError(err.code === 1 ? "Leiskite prieigą prie vietos." : "Nepavyko nustatyti vietos."); },
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    const p = new URLSearchParams(search);
    setSurface(p.get("surface") ?? "");
    setIsIndoor(p.get("isIndoor") ?? "");
    setActiveSport(p.get("sport") ?? "");
    setCity(p.get("city") ?? "");
    setNameQ(p.get("name") ?? "");
    setMinPrice("");
    setMaxPrice("");
  }, [search]);

  const apiFilters: SearchGroupFilters = useMemo(() => ({
    surface:  surface  || undefined,
    isIndoor: isIndoor === "true" ? true : isIndoor === "false" ? false : undefined,
  }), [surface, isIndoor]);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["search-groups", apiFilters],
    queryFn: () => fetchGroups(apiFilters),
    staleTime: 60_000,
  });

  // Sport list with per-sport group counts
  const groupsBySport = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of groups) map.set(g.sport, (map.get(g.sport) ?? 0) + 1);
    return map;
  }, [groups]);

  // City list derived from sport-filtered groups
  const sportFilteredGroups = useMemo(() =>
    activeSport ? groups.filter(g => g.sport === activeSport) : groups,
    [groups, activeSport]);

  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of sportFilteredGroups) {
      if (g.city) map.set(g.city, (map.get(g.city) ?? 0) + 1);
    }
    return map;
  }, [sportFilteredGroups]);

  const sortedCities = useMemo(() =>
    [...cityCounts.keys()].sort((a, b) => (cityCounts.get(b) ?? 0) - (cityCounts.get(a) ?? 0)),
    [cityCounts]);

  // Final list after all client-side filters
  const displayed = useMemo(() => {
    let result = groups;
    if (activeSport) result = result.filter(g => g.sport === activeSport);
    if (city)        result = result.filter(g => g.city === city);
    if (nameQ.trim()) result = result.filter(g => g.facilityName.toLowerCase().includes(nameQ.toLowerCase()));
    const min = minPrice !== "" ? Number(minPrice) : NaN;
    const max = maxPrice !== "" ? Number(maxPrice) : NaN;
    if (!isNaN(min)) result = result.filter(g => g.startingPrice == null || g.startingPrice >= min);
    if (!isNaN(max)) result = result.filter(g => g.startingPrice == null || g.startingPrice <= max);
    if (nearbyMode && userLocation) {
      result = result.filter(g => g.latitude != null && g.longitude != null &&
        haversineKm(userLocation.lat, userLocation.lng, g.latitude, g.longitude) <= NEARBY_KM);
    }

    if (sortBy !== "default") {
      result = [...result].sort((a, b) => {
        if (sortBy === "rating_desc") return (b.groupRating ?? 0) - (a.groupRating ?? 0);
        // price sorts: groups without a price sink to the bottom
        const ap = a.startingPrice ?? (sortBy === "price_asc" ? Infinity : -Infinity);
        const bp = b.startingPrice ?? (sortBy === "price_asc" ? Infinity : -Infinity);
        return sortBy === "price_asc" ? ap - bp : bp - ap;
      });
    }
    return result;
  }, [groups, activeSport, city, nameQ, minPrice, maxPrice, sortBy, nearbyMode, userLocation]);

  const activeFilterCount = [activeSport, city, surface, isIndoor, minPrice, maxPrice, nearbyMode].filter(Boolean).length;

  function clearFilters() {
    setActiveSport(""); setCity(""); setSurface(""); setIsIndoor("");
    setMinPrice(""); setMaxPrice("");
    setNearbyMode(false); setUserLocation(null); setNearbyError(null);
  }

  function toggleSport(sport: string) {
    setActiveSport(prev => {
      if (prev === sport) return "";
      setCity(""); // clear city when sport changes
      return sport;
    });
  }

  const filterControls = (
    <div className="space-y-6">
      {/* Nearby location */}
      <div>
        <button
          onClick={handleNearby}
          disabled={nearbyLoading}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-60 ${
            nearbyMode ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted/40 hover:bg-muted text-foreground"
          }`}
        >
          {nearbyLoading ? (
            <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
          ) : (
            <Navigation className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1 text-left">{nearbyMode ? `Netoliese (${NEARBY_KM} km) ✕` : "Ieškoti netoliese"}</span>
        </button>
        {nearbyError && <p className="mt-1.5 text-xs text-destructive">{nearbyError}</p>}
      </div>

      {/* Sport filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sporto šakos</Label>
          {activeSport && (
            <button onClick={() => setActiveSport("")} className="text-[10px] font-medium text-primary hover:underline">
              Visi
            </button>
          )}
        </div>
        <div className="space-y-1">
          {[...groupsBySport.keys()].sort().map(sport => {
            const isSelected = activeSport === sport;
            const isActive   = !activeSport || isSelected;
            const color      = sportColor[sport] ?? "#888";
            return (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left text-sm ${
                  isSelected
                    ? "bg-muted/60 hover:bg-muted"
                    : isActive
                      ? "hover:bg-muted/30"
                      : "opacity-40 hover:opacity-70 hover:bg-muted/30"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{ background: isSelected ? color : "transparent", borderColor: color }}
                >
                  <SportIcon sport={sport} size={11} strokeWidth={2} style={{ color: isSelected ? "white" : color }} />
                </div>
                <span className={`flex-1 font-medium transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {SPORT_LABELS[sport] ?? sport}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {groupsBySport.get(sport)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* City filter */}
      {sortedCities.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Miestas</Label>
            {city && (
              <button onClick={() => setCity("")} className="text-[10px] font-medium text-primary hover:underline">
                Valyti
              </button>
            )}
          </div>
          <div className="space-y-1">
            {sortedCities.map(c => {
              const active = city === c;
              return (
                <button
                  key={c}
                  onClick={() => setCity(prev => prev === c ? "" : c)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left text-sm ${
                    active ? "bg-primary/10 hover:bg-primary/15" : "opacity-60 hover:opacity-90 hover:bg-muted/40"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${active ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                    {active && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`flex-1 font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{c}</span>
                  <span className="text-xs tabular-nums text-muted-foreground/60">{cityCounts.get(c)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Indoor / Outdoor toggle */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Vieta</Label>
        <div className="flex rounded-md border overflow-hidden">
          {(["", "true", "false"] as const).map((val, i) => (
            <button
              key={val}
              onClick={() => setIsIndoor(val)}
              className={`flex-1 text-xs py-2.5 font-medium transition-colors ${
                isIndoor === val
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
            >
              {i === 0 ? "Visi" : i === 1 ? "Vidaus" : "Lauko"}
            </button>
          ))}
        </div>
      </div>

      {/* Surface */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Danga</Label>
        <Select value={surface || "_all_"} onValueChange={v => setSurface(v === "_all_" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Visos dangos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Visos dangos</SelectItem>
            <SelectItem value="clay">Molis</SelectItem>
            <SelectItem value="hard">Kieta</SelectItem>
            <SelectItem value="grass">Žolė</SelectItem>
            <SelectItem value="carpet">Kilimas</SelectItem>
            <SelectItem value="wood">Mediena</SelectItem>
            <SelectItem value="rubber">Guma</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price range */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kaina (€/val)</Label>
          {(minPrice || maxPrice) && (
            <button
              onClick={() => { setMinPrice(""); setMaxPrice(""); }}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Valyti
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Nuo"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="shrink-0 text-muted-foreground text-xs">–</span>
          <input
            type="number"
            min={0}
            placeholder="Iki"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );

  const detailFilters: SearchGroupFilters = {
    isIndoor: isIndoor === "true" ? true : isIndoor === "false" ? false : undefined,
    surface:  surface || undefined,
  };

  // Synthetic Court-shaped objects so the shared CourtMap can render venue pins.
  // `id` is a list index (unique within this map); the real facility id + sport
  // ride along on `_facilityId`/`_sport` for the info-window link builder below.
  const mapCourts = useMemo<Court[]>(() =>
    displayed
      .filter(g => g.latitude != null && g.longitude != null)
      .map((g, i) => ({
        id: i,
        name: g.facilityName,
        type: g.sport,
        city: g.city,
        address: g.address,
        latitude: g.latitude,
        longitude: g.longitude,
        pricePerHour: g.startingPrice ?? 0,
        minDisplayPrice: g.startingPrice ?? null,
        imageUrl: g.photos?.[0],
        isIndoor: g.isIndoorAvailable && !g.isOutdoorAvailable,
        rating: g.groupRating ?? undefined,
        isPromoted: g.isPromoted,
        maxPlayers: 0,
        condition: "good",
        status: "active",
        createdAt: "",
        _facilityId: g.facilityId,
        _sport: g.sport,
      } as unknown as Court)),
    [displayed]);

  const mapSports = useMemo(() => new Set(displayed.map(g => g.sport)), [displayed]);

  const mapHref: CourtHrefBuilder = (court) => {
    const fid = (court as unknown as { _facilityId: number })._facilityId;
    const sportSlug = (court as unknown as { _sport: string })._sport;
    const p = new URLSearchParams({ sport: sportSlug });
    if (detailFilters.isIndoor !== undefined) p.set("isIndoor", String(detailFilters.isIndoor));
    if (detailFilters.surface) p.set("surface", detailFilters.surface);
    const base = `/facility/${fid}?${p.toString()}`;
    return { detail: base, reserve: `${base}#reserve` };
  };

  const sortAndView = (
    <div className="flex items-center gap-2">
      <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
        <SelectTrigger className="h-9 w-auto gap-1.5 text-xs" aria-label="Rūšiuoti">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline"><SelectValue /></span>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="default">Rekomenduojama</SelectItem>
          <SelectItem value="rating_desc">Geriausiai vertinami</SelectItem>
          <SelectItem value="price_asc">Pigiausi</SelectItem>
          <SelectItem value="price_desc">Brangiausi</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-1 rounded-md border p-0.5">
        <button
          onClick={() => setViewMode("list")}
          aria-label="Sąrašas"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setViewMode("map")}
          aria-label="Žemėlapis"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
        >
          <MapIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      {/* Mobile: sticky top bar */}
      <div className="md:hidden sticky top-[7rem] z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 flex-1 min-w-0"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtrai
            {activeFilterCount > 0 && (
              <Badge className="h-5 px-1.5 text-xs ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground px-2" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
          {sortAndView}
        </div>
        {/* Row 2: scrollable sport chips for quick single-sport switching */}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            onClick={() => setActiveSport("")}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              !activeSport ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Visi
          </button>
          {[...groupsBySport.keys()].sort().map(sport => {
            const active = activeSport === sport;
            const color  = sportColor[sport] ?? "#888";
            return (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  active ? "border-transparent text-white" : "border-border text-muted-foreground hover:bg-muted"
                }`}
                style={active ? { backgroundColor: color } : {}}
              >
                <SportIcon sport={sport} size={11} strokeWidth={2} style={{ color: active ? "white" : color }} />
                {SPORT_LABELS[sport] ?? sport}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: filter sheet */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" className="w-80 flex flex-col gap-0 p-4">
          <SheetHeader className="flex-row items-center justify-between pb-3 border-b mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Filtrai
              {activeFilterCount > 0 && <Badge className="h-5 px-1.5 text-xs">{activeFilterCount}</Badge>}
            </SheetTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Išvalyti
              </Button>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-1">{filterControls}</div>
          <div className="shrink-0 border-t pt-4 pb-2">
            <SheetClose asChild>
              <Button className="w-full" size="lg">
                Rasta {displayed.length} grupių
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-64 shrink-0 flex-col sticky top-24 max-h-[calc(100vh-7rem)] pr-1">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtrai
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearFilters}
                  >
                    <X className="h-3 w-3 mr-1" /> Išvalyti
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-6 overflow-y-auto flex-1 pb-4">
              {filterControls}
            </div>
            <div className="shrink-0 border-t pt-3 bg-background/95 backdrop-blur-sm">
              <p className="text-center text-sm text-muted-foreground py-2">
                {isLoading ? "Kraunama…" : `Rasta ${displayed.length} grupių`}
              </p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h1 className="text-xl font-bold text-foreground shrink-0">
                Rasti aikštelę
                {!isLoading && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    ({displayed.length})
                  </span>
                )}
              </h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 w-full sm:w-52"
                    placeholder="Ieškoti pavadinimo..."
                    value={nameQ}
                    onChange={e => setNameQ(e.target.value)}
                  />
                </div>
                {/* Sort + view toggle (desktop only — mobile has it in the top bar) */}
                <div className="hidden md:block">{sortAndView}</div>
              </div>
            </div>

            {isLoading ? (
              viewMode === "map" ? (
                <Skeleton className="h-[400px] md:h-[600px] w-full rounded-xl" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-72 rounded-xl" />
                  ))}
                </div>
              )
            ) : viewMode === "map" ? (
              mapCourts.length === 0 ? (
                <div className="h-[400px] md:h-[600px] flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 text-center text-muted-foreground px-6">
                  <MapIcon className="h-8 w-8 opacity-40" />
                  <p className="text-sm">
                    {displayed.length === 0
                      ? "Nerasta aikštelių pagal pasirinktus filtrus."
                      : "Šių aikštelių žemėlapyje parodyti negalime (trūksta vietos koordinačių)."}
                  </p>
                </div>
              ) : (
                <div className="h-[400px] md:h-[600px]">
                  <CourtMap courts={mapCourts} activeSports={mapSports} getHref={mapHref} />
                </div>
              )
            ) : displayed.length === 0 ? (
              <div className="text-center py-16 border rounded-xl bg-muted/10 border-dashed">
                <div className="text-4xl mb-4">🎾</div>
                <h3 className="text-xl font-bold mb-2">Nerasta aikštelių</h3>
                <p className="text-muted-foreground mb-4 px-4">Pabandykite pakeisti arba išvalyti filtrus.</p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" /> Išvalyti filtrus
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayed.map(group => (
                  <FacilitySportCard
                    key={`${group.facilityId}-${group.sport}`}
                    group={group}
                    href={buildDetailHref(group, detailFilters)}
                  />
                ))}
              </div>
            )}
          </main>

        </div>
      </div>
    </Layout>
  );
}
