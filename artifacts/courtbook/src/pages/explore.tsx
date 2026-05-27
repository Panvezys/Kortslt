import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { FacilitySportCard } from "@/components/facility-sport-card";
import { buildDetailHref, type SearchGroupResult, type SearchGroupFilters } from "@/lib/search-groups-types";
import { SPORT_LABELS } from "@/components/sport-icon";
import { customFetch } from "@workspace/api-client-react";

async function fetchGroups(filters: SearchGroupFilters): Promise<SearchGroupResult[]> {
  const p = new URLSearchParams();
  if (filters.sport)     p.set("sport",     filters.sport);
  if (filters.city)      p.set("city",      filters.city);
  if (filters.surface)   p.set("surface",   filters.surface);
  if (filters.condition) p.set("condition", filters.condition);
  if (filters.isIndoor !== undefined) p.set("isIndoor", String(filters.isIndoor));
  if (filters.minPrice != null) p.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) p.set("maxPrice", String(filters.maxPrice));
  const qs = p.toString();
  return customFetch<SearchGroupResult[]>(`/api/search/groups${qs ? `?${qs}` : ""}`);
}

// Build sport options from SPORT_LABELS — skip alias keys that contain "-"
const SPORT_OPTIONS = Object.entries(SPORT_LABELS)
  .filter(([key]) => !key.includes("-"))
  .map(([key, label]) => ({ value: key, label }));

export default function ExplorePage() {
  const search = useSearch();
  const sp = new URLSearchParams(search);

  const [sport,    setSport]    = useState<string>(sp.get("sport")    ?? "");
  const [city,     setCity]     = useState<string>(sp.get("city")     ?? "");
  const [surface,  setSurface]  = useState<string>(sp.get("surface")  ?? "");
  const [isIndoor, setIsIndoor] = useState<string>(sp.get("isIndoor") ?? "");
  const [nameQ,    setNameQ]    = useState<string>("");

  // Sync filter dropdowns when URL changes (e.g. back-navigation to /explore?sport=X)
  useEffect(() => {
    const p = new URLSearchParams(search);
    setSport(p.get("sport")    ?? "");
    setCity(p.get("city")      ?? "");
    setSurface(p.get("surface") ?? "");
    setIsIndoor(p.get("isIndoor") ?? "");
  }, [search]);

  const filters: SearchGroupFilters = useMemo(() => ({
    sport:    sport    || undefined,
    city:     city     || undefined,
    surface:  surface  || undefined,
    isIndoor: isIndoor === "true" ? true : isIndoor === "false" ? false : undefined,
  }), [sport, city, surface, isIndoor]);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["search-groups", filters],
    queryFn: () => fetchGroups(filters),
    staleTime: 60_000,
  });

  const displayed = useMemo(() =>
    nameQ.trim()
      ? groups.filter(g => g.facilityName.toLowerCase().includes(nameQ.toLowerCase()))
      : groups,
    [groups, nameQ]);

  const hasFilters = !!(sport || city || surface || isIndoor);

  function clearFilters() {
    setSport(""); setCity(""); setSurface(""); setIsIndoor("");
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rasti aikštelę</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {groups.length > 0 ? `${groups.length} grupės` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-48"
              placeholder="Ieškoti..."
              value={nameQ}
              onChange={e => setNameQ(e.target.value)}
            />
          </div>

          <Select value={sport || "_all_"} onValueChange={v => setSport(v === "_all_" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sportas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Visi sportai</SelectItem>
              {SPORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={isIndoor || "_all_"} onValueChange={v => setIsIndoor(v === "_all_" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Vidus/Lauk." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Visi</SelectItem>
              <SelectItem value="true">Vidaus</SelectItem>
              <SelectItem value="false">Lauko</SelectItem>
            </SelectContent>
          </Select>

          <Select value={surface || "_all_"} onValueChange={v => setSurface(v === "_all_" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Danga" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Visos dangos</SelectItem>
              <SelectItem value="clay">Molio</SelectItem>
              <SelectItem value="hard">Kieta</SelectItem>
              <SelectItem value="grass">Žolė</SelectItem>
              <SelectItem value="carpet">Kilimas</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="w-3 h-3" /> Išvalyti
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Nerasta aikštelių pagal pasirinktus filtrus.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map(group => (
              <FacilitySportCard
                key={`${group.facilityId}-${group.sport}`}
                group={group}
                href={buildDetailHref(group, filters)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
