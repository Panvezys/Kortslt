import { useEffect, useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Star, Phone, Mail, AlertCircle } from "lucide-react";
import { SportPill, getSportLabel } from "@/components/sport-icon";
import { resolveCourtImage } from "@/lib/imageUrl";
import { Link } from "wouter";
import type { GroupDetailResult } from "@/lib/search-groups-types";
import { customFetch } from "@workspace/api-client-react";

async function fetchGroupDetail(
  facilityId: string,
  sport: string,
  filters: { isIndoor?: boolean; surface?: string; condition?: string }
): Promise<GroupDetailResult> {
  const p = new URLSearchParams();
  if (filters.isIndoor !== undefined) p.set("isIndoor", String(filters.isIndoor));
  if (filters.surface)   p.set("surface",   filters.surface);
  if (filters.condition) p.set("condition", filters.condition);
  const qs = p.toString();
  return customFetch<GroupDetailResult>(`/api/search/groups/${facilityId}/${sport}${qs ? `?${qs}` : ""}`);
}

async function fetchAvailableSports(facilityId: string): Promise<string[]> {
  try {
    const data = await customFetch<{ courts: { type: string }[] }>(`/api/facilities/${facilityId}/public`);
    return [...new Set((data.courts ?? []).map(c => c.type.replace(/-/g, "_")))];
  } catch {
    return [];
  }
}

export default function FacilitySportPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const rawSearch = useSearch();
  const [, setLocation] = useLocation();
  const p = new URLSearchParams(rawSearch);

  const sportParam   = p.get("sport")     ?? undefined;
  const isIndoorStr  = p.get("isIndoor");
  const surfaceParam = p.get("surface")   ?? undefined;
  const condParam    = p.get("condition") ?? undefined;

  const isIndoor = isIndoorStr === "true" ? true : isIndoorStr === "false" ? false : undefined;

  const [redirecting, setRedirecting] = useState(!sportParam);
  useEffect(() => {
    if (!sportParam && facilityId) {
      fetchAvailableSports(facilityId)
        .then(sports => {
          if (sports.length > 0) {
            setLocation(`/facility/${facilityId}?sport=${sports[0]}`, { replace: true });
          } else {
            setRedirecting(false);
          }
        })
        .catch(() => setRedirecting(false));
    }
  }, [facilityId, sportParam, setLocation]);

  const filters = { isIndoor, surface: surfaceParam, condition: condParam };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["group-detail", facilityId, sportParam, isIndoor, surfaceParam, condParam],
    queryFn: () => fetchGroupDetail(facilityId!, sportParam!, filters),
    enabled: !!facilityId && !!sportParam,
  });

  function navigateToSport(sport: string) {
    const next = new URLSearchParams(p);
    next.set("sport", sport);
    setLocation(`/facility/${facilityId}?${next.toString()}`);
  }

  function updateFilter(key: string, value: string | undefined) {
    const next = new URLSearchParams(p);
    if (value) next.set(key, value); else next.delete(key);
    setLocation(`/facility/${facilityId}?${next.toString()}`);
  }

  if (redirecting || (isLoading && !data)) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <BackButton label="Atgal" historyBack fallbackTo="/explore" />
          <EmptyState icon={<AlertCircle className="w-8 h-8" />} title="Nerasta" description="Šios aikštelės grupės nerasta." />
        </div>
      </Layout>
    );
  }

  const { facility, sport, courts, mergedPhotos, mergedAmenities,
          surfacesAvailable, isIndoorAvailable, isOutdoorAvailable,
          availableSports, courtCount, startingPrice, groupRating } = data;

  const heroPhoto = resolveCourtImage(
    mergedPhotos[0] ?? null,
    sport,
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <BackButton label="Atgal" historyBack fallbackTo="/explore" />

        {heroPhoto && (
          <div className="rounded-xl overflow-hidden h-64 bg-muted">
            <img src={heroPhoto} alt={facility.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{facility.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <SportPill sport={sport} />
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{facility.city}
                </span>
                {groupRating != null && (
                  <span className="text-sm flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                    {groupRating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            {startingPrice != null && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Nuo</p>
                <p className="text-xl font-bold">{startingPrice.toFixed(0)} €<span className="text-base font-normal">/val</span></p>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{courtCount} aikštelė{courtCount === 1 ? "" : courtCount < 10 ? "s" : "ių"}</p>
        </div>

        {availableSports.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {availableSports.map(s => (
              <Button
                key={s}
                variant={s === sport ? "default" : "outline"}
                size="sm"
                onClick={() => navigateToSport(s)}
              >
                {getSportLabel(s)}
              </Button>
            ))}
          </div>
        )}

        {(surfacesAvailable.length > 1 || (isIndoorAvailable && isOutdoorAvailable)) && (
          <div className="flex gap-2 flex-wrap">
            {isIndoorAvailable && isOutdoorAvailable && (
              <Select
                value={isIndoor === true ? "true" : isIndoor === false ? "false" : "_all_"}
                onValueChange={v => updateFilter("isIndoor", v === "_all_" ? undefined : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Vidus/Lauk." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Visi</SelectItem>
                  <SelectItem value="true">Vidaus</SelectItem>
                  <SelectItem value="false">Lauko</SelectItem>
                </SelectContent>
              </Select>
            )}
            {surfacesAvailable.length > 1 && (
              <Select
                value={surfaceParam ?? "_all_"}
                onValueChange={v => updateFilter("surface", v === "_all_" ? undefined : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Pasirinkite dangą" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Visos dangos</SelectItem>
                  {surfacesAvailable.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {mergedAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mergedAmenities.map(a => (
              <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Aikštelės ({courts.length})</h2>
          {courts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nerasta aikštelių pagal filtrus.</p>
          ) : (
            courts.map(court => (
              <div key={court.id} className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium truncate">{court.name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                    {court.surface && <Badge variant="outline" className="text-xs">{court.surface}</Badge>}
                    <span>{court.isIndoor ? "Vidaus" : "Lauko"}</span>
                    {court.rating != null && (
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                        {court.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-semibold">{court.effectiveHourlyPrice.toFixed(0)} €/val</p>
                  <Link href={`/courts/${court.id}`}>
                    <Button size="sm">Rezervuoti</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border border-border rounded-xl p-4 space-y-2 text-sm">
          {facility.address && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              {facility.address}{facility.city ? `, ${facility.city}` : ""}
            </p>
          )}
          {facility.phone && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 shrink-0" />
              <a href={`tel:${facility.phone}`} className="hover:text-foreground">{facility.phone}</a>
            </p>
          )}
          {facility.email && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <a href={`mailto:${facility.email}`} className="hover:text-foreground">{facility.email}</a>
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
