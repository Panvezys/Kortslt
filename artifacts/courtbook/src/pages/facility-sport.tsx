import { useEffect, useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapPin, Star, Phone, Mail, AlertCircle, Instagram, Facebook, ChevronLeft, ChevronRight, Share2, Clock, ChevronDown, Navigation, X, Images, Loader2, Trophy, Users, Euro, Dumbbell } from "lucide-react";
import { SportPill, getSportLabel, SportCourtIcon } from "@/components/sport-icon";
import { useSportIconConfig } from "@/lib/sport-icons";
import { resolveCourtImage } from "@/lib/imageUrl";
import type { GroupDetailResult } from "@/lib/search-groups-types";
import { customFetch } from "@workspace/api-client-react";
import { GroupBookingWidget } from "@/components/group-booking-widget";
import { GroupMembershipSection } from "@/components/group-membership-section";
import { SurfaceSpecs } from "@/components/surface-specs";
import { useToast } from "@/hooks/use-toast";
import { format as formatDate } from "date-fns";
import { safeUrl } from "@/lib/validators";

// ── Local helpers ─────────────────────────────────────────────────────────────

const WH_DAYS = [
  { dow: 1, label: "Pirmadienis" },
  { dow: 2, label: "Antradienis" },
  { dow: 3, label: "Trečiadienis" },
  { dow: 4, label: "Ketvirtadienis" },
  { dow: 5, label: "Penktadienis" },
  { dow: 6, label: "Šeštadienis" },
  { dow: 0, label: "Sekmadienis" },
];

function WorkingHoursAccordion({ json }: { json: string }) {
  const [open, setOpen] = useState(false);
  let wh: Record<string, { open: string; close: string; closed: boolean }>;
  try { wh = JSON.parse(json); } catch { return null; }
  const todayDow = new Date().getDay();
  const todayCfg = wh[String(todayDow)];
  const hhmm = new Date().toTimeString().slice(0, 5);
  const isOpenNow = !!(todayCfg && !todayCfg.closed && hhmm >= todayCfg.open && hhmm < todayCfg.close);
  const todayHours = todayCfg?.closed ? "Nedirbama" : `${todayCfg?.open ?? "08:00"} – ${todayCfg?.close ?? "22:00"}`;
  return (
    <div className="flex gap-3 p-4 bg-muted/30 rounded-xl border">
      <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground font-medium">Darbo laikas</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isOpenNow ? "bg-green-500/10 text-green-600 border-green-400/30" : "bg-red-500/10 text-red-600 border-red-400/30"}`}>
            {isOpenNow ? "Atidaryta" : "Uždaryta"}
          </span>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between text-left focus:outline-none">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Šiandien: </span>
                <span className={`text-sm font-semibold ${todayCfg?.closed ? "text-muted-foreground font-normal" : "text-foreground"}`}>{todayHours}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 ml-2 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2">
              {WH_DAYS.map(({ dow, label }) => {
                const cfg = wh[String(dow)];
                const isToday = dow === todayDow;
                return (
                  <div key={dow} className={`flex items-center justify-between py-1 text-xs border-t border-border/50 first:border-t-0 ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    <span>{label}</span>
                    {cfg?.closed
                      ? <span className="font-normal text-muted-foreground">Nedirbama</span>
                      : <span className="tabular-nums">{cfg?.open ?? "08:00"} – {cfg?.close ?? "22:00"}</span>}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/** Lithuanian plural for "atsiliepimas" (review): 1 → atsiliepimas, 2–9 → atsiliepimai, else → atsiliepimų. */
function reviewsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "atsiliepimas";
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) return "atsiliepimai";
  return "atsiliepimų";
}

function StarDisplay({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => <Star key={`f${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}
      {hasHalf && <Star key="half" className="h-3 w-3 fill-yellow-200 text-yellow-400" />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} className="h-3 w-3 text-muted-foreground/30" />)}
    </div>
  );
}

// ── Data fetching ─────────────────────────────────────────────────────────────

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
  return customFetch<GroupDetailResult>(`/api/search/groups/${facilityId}/${sport}${qs ? `?${qs}` : ""}`, { responseType: "json" });
}

async function fetchAvailableSports(facilityId: string): Promise<string[]> {
  try {
    const data = await customFetch<{ courts: { type: string }[] }>(`/api/facilities/${facilityId}/public`, { responseType: "json" });
    return [...new Set((data.courts ?? []).map(c => c.type.replace(/-/g, "_")))];
  } catch {
    return [];
  }
}

interface Coach {
  id: number;
  userId: string;
  name: string;
  bio?: string;
  photoUrl?: string;
  pricePerHour?: number;
  sports: string[];
  availabilityDescription?: string;
}

interface ReviewItem {
  id: number;
  rating: number;
  comment: string | null;
  reviewerName: string;
  ownerReplyText: string | null;
  ownerReplyCreatedAt: string | null;
  createdAt: string;
}

interface ReviewsPage {
  averageRating: number | null;
  reviewCount: number;
  items: ReviewItem[];
  hasMore: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const REVIEWS_LIMIT = 10;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FacilitySportPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const rawSearch = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const p = new URLSearchParams(rawSearch);

  const sportParam   = p.get("sport")     ?? undefined;
  const isIndoorStr  = p.get("isIndoor");
  const surfaceParam = p.get("surface")   ?? undefined;
  const condParam    = p.get("condition") ?? undefined;
  const dateParam    = p.get("date");     // carried over from /explore search
  // Upgrade flow: casual game being linked to this booking (from game-detail via /explore)
  const linkGameIdRaw = parseInt(p.get("linkGameId") ?? "", 10);
  const linkGameId = Number.isInteger(linkGameIdRaw) && linkGameIdRaw > 0 ? linkGameIdRaw : null;

  const isIndoor = isIndoorStr === "true" ? true : isIndoorStr === "false" ? false : undefined;

  const iconCfg = useSportIconConfig(sportParam);

  const [redirecting, setRedirecting] = useState(!sportParam);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("auto");
  const [showReserveBar, setShowReserveBar] = useState(false);

  useEffect(() => { setActivePhotoIdx(0); setSelectedCourtId("auto"); }, [facilityId, sportParam]);

  // Mobile: show a sticky "Rezervuoti" bar until the booking widget scrolls into view,
  // so the booking CTA is reachable without scrolling past reviews/coaches/contact.
  useEffect(() => {
    const el = document.getElementById("reserve");
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setShowReserveBar(!entry.isIntersecting), { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [facilityId, sportParam, redirecting]);

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

  // Upgrade flow: fetch the casual game so the widget can preset split size.
  const { data: linkedGame } = useQuery<{ id: number; playersNeeded?: number | null }>({
    queryKey: ["game-for-link", linkGameId],
    queryFn: () => customFetch<{ id: number; playersNeeded?: number | null }>(`/api/games/${linkGameId}`, { responseType: "json" }),
    enabled: !!linkGameId,
    staleTime: 60_000,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["group-detail", facilityId, sportParam, isIndoor, surfaceParam, condParam],
    queryFn: () => fetchGroupDetail(facilityId!, sportParam!, filters),
    enabled: !!facilityId && !!sportParam,
  });

  const reviewsQ = useInfiniteQuery({
    queryKey: ["group-reviews", facilityId, sportParam],
    initialPageParam: 1 as number,
    queryFn: async ({ pageParam }): Promise<ReviewsPage> => {
      try {
        return await customFetch<ReviewsPage>(
          `/api/search/groups/${facilityId}/${sportParam}/reviews?page=${pageParam}&limit=${REVIEWS_LIMIT}`,
          { responseType: "json" }
        );
      } catch {
        return { averageRating: null, reviewCount: 0, items: [], hasMore: false };
      }
    },
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    enabled: !!facilityId && !!sportParam,
  });

  const reviews = reviewsQ.data?.pages.flatMap(p => p.items) ?? [];
  const reviewMeta = reviewsQ.data?.pages[0] ?? null;

  const { data: groupCoaches = [] } = useQuery<Coach[]>({
    queryKey: ["group-coaches", facilityId, sportParam],
    queryFn: async () => {
      if (!data?.courts?.length) return [];
      const results = await Promise.allSettled(
        data.courts.map(c =>
          customFetch<Coach[]>(`/api/courts/${c.id}/coaches`, { responseType: "json" })
        )
      );
      const seen = new Set<number>();
      const coaches: Coach[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const coach of Array.isArray(r.value) ? r.value : []) {
            if (!seen.has(coach.id)) { seen.add(coach.id); coaches.push(coach); }
          }
        }
      }
      return coaches;
    },
    enabled: !!data?.courts?.length,
    staleTime: 60_000,
  });

  async function handleShare(name: string) {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: name, url }); return; }
      await navigator.clipboard.writeText(url);
      toast({ title: "Nuoroda nukopijuota" });
    } catch {
      try { await navigator.clipboard.writeText(url); toast({ title: "Nuoroda nukopijuota" }); } catch { /* ignore */ }
    }
  }

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
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-72 w-full rounded-xl" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-96" />
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <BackButton label="Atgal" historyBack fallbackTo="/explore" />
          <EmptyState icon={<AlertCircle className="w-8 h-8" />} title="Nerasta" description="Šios aikštelės grupės nerasta." />
        </div>
      </Layout>
    );
  }

  const { facility, sport, mergedPhotos, mergedAmenities,
          surfacesAvailable, isIndoorAvailable, isOutdoorAvailable,
          availableSports, courtCount, startingPrice, groupRating,
          memberships, lastBookedAt, openGames } = data;

  const allPhotos = mergedPhotos;
  const sportFallback = resolveCourtImage(null, sport);

  return (
    <Layout>
      {/* ── Full-screen lightbox ── */}
      {galleryOpen && (
        <div className="fixed inset-0 z-[100] bg-black/97 flex flex-col" onClick={() => setGalleryOpen(false)}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-white/60 text-sm tabular-nums">{activePhotoIdx + 1} / {allPhotos.length}</span>
            <span className="text-white font-semibold text-sm truncate flex-1 text-center px-4">{facility.name}</span>
            <button onClick={() => setGalleryOpen(false)} className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 relative flex items-center justify-center min-h-0 px-12" onClick={e => e.stopPropagation()}>
            <img key={activePhotoIdx} src={resolveCourtImage(allPhotos[activePhotoIdx]) ?? ""} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
            {allPhotos.length > 1 && (
              <>
                <button onClick={() => setActivePhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-all hover:scale-105">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setActivePhotoIdx(i => (i + 1) % allPhotos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-all hover:scale-105">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          <div className="shrink-0 py-3 px-4 overflow-x-auto" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 w-max mx-auto">
              {allPhotos.map((url, i) => (
                <button key={i} onClick={() => setActivePhotoIdx(i)}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === activePhotoIdx ? "border-white scale-105" : "border-white/20 hover:border-white/50"}`}>
                  <img src={resolveCourtImage(url) ?? ""} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        <BackButton label="Atgal" historyBack fallbackTo="/explore" />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-5 min-w-0">

            {/* Adaptive photo gallery */}
            {allPhotos.length === 0 ? (
              sportFallback ? (
                <div className="rounded-2xl overflow-hidden h-64 sm:h-80 bg-muted">
                  <img src={sportFallback} alt={facility.name} className="w-full h-full object-cover" />
                </div>
              ) : null
            ) : (
              <div className="rounded-2xl overflow-hidden bg-zinc-900 relative h-64 sm:h-80">
                {allPhotos.length === 1 ? (
                  <div className="w-full h-full cursor-pointer overflow-hidden group" onClick={() => { setActivePhotoIdx(0); setGalleryOpen(true); }}>
                    <img src={resolveCourtImage(allPhotos[0]) ?? ""} alt={facility.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : allPhotos.length === 2 ? (
                  <div className="grid grid-cols-2 h-full gap-0.5">
                    {allPhotos.slice(0, 2).map((url, i) => (
                      <div key={i} className="relative cursor-pointer overflow-hidden group" onClick={() => { setActivePhotoIdx(i); setGalleryOpen(true); }}>
                        <img src={resolveCourtImage(url) ?? ""} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-[3fr_2fr] grid-rows-2 h-full gap-0.5">
                    <div className="row-span-2 relative cursor-pointer overflow-hidden group" onClick={() => { setActivePhotoIdx(0); setGalleryOpen(true); }}>
                      <img src={resolveCourtImage(allPhotos[0]) ?? ""} alt={facility.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="relative cursor-pointer overflow-hidden group" onClick={() => { setActivePhotoIdx(1); setGalleryOpen(true); }}>
                      <img src={resolveCourtImage(allPhotos[1]) ?? ""} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="relative cursor-pointer overflow-hidden group" onClick={() => { setActivePhotoIdx(2); setGalleryOpen(true); }}>
                      <img src={resolveCourtImage(allPhotos[2]) ?? ""} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {allPhotos.length > 3 && (
                        <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white gap-1 group-hover:bg-black/65 transition-colors">
                          <Images className="w-5 h-5" />
                          <span className="font-bold text-lg">+{allPhotos.length - 3}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Title & meta */}
            <div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-foreground">{facility.name}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <SportPill sport={sport} />
                    {facility.city && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{facility.city}
                      </span>
                    )}
                    {groupRating != null && (
                      <span className="text-sm flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                        {groupRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                    <SportCourtIcon
                      sport={iconCfg.iconKey}
                      size={14}
                      strokeWidth={2}
                      style={{ color: iconCfg.color }}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    {courtCount} aikštelė{courtCount === 1 ? "" : courtCount < 10 ? "s" : "ių"}
                    {startingPrice != null && (
                      <> · nuo <span className="font-semibold text-foreground">{startingPrice.toFixed(0)} €/val</span></>
                    )}
                  </p>
                </div>
                {/* Header actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleShare(facility.name)}
                    className="flex items-center justify-center w-9 h-9 rounded-full border bg-background hover:bg-muted transition-colors"
                    aria-label="Dalintis"
                  >
                    <Share2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sport tabs */}
            {availableSports.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {availableSports.map(s => (
                  <Button key={s} variant={s === sport ? "default" : "outline"} size="sm" onClick={() => navigateToSport(s)}>
                    {getSportLabel(s)}
                  </Button>
                ))}
              </div>
            )}

            {/* Indoor/outdoor + surface filters */}
            {(surfacesAvailable.length > 1 || (isIndoorAvailable && isOutdoorAvailable)) && (
              <div className="flex gap-2 flex-wrap">
                {isIndoorAvailable && isOutdoorAvailable && (
                  <Select value={isIndoor === true ? "true" : isIndoor === false ? "false" : "_all_"} onValueChange={v => updateFilter("isIndoor", v === "_all_" ? undefined : v)}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Vidus/Lauk." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">Visi</SelectItem>
                      <SelectItem value="true">Vidaus</SelectItem>
                      <SelectItem value="false">Lauko</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {surfacesAvailable.length > 1 && (
                  <Select value={surfaceParam ?? "_all_"} onValueChange={v => updateFilter("surface", v === "_all_" ? undefined : v)}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Danga" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">Visos dangos</SelectItem>
                      {surfacesAvailable.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Amenities */}
            {mergedAmenities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Patogumai</p>
                <div className="flex flex-wrap gap-1.5">
                  {mergedAmenities.map(a => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}
                </div>
              </div>
            )}

            {/* Individual court cards */}
            {data.courts.length > 0 && (
              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-border after:ml-2">
                  Aikštelės
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.courts.map(court => (
                    <div key={court.id} className="border border-border rounded-xl p-4 bg-card space-y-2.5 hover:border-primary/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-tight">{court.name}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {court.surface && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{court.surface}</span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {court.isIndoor ? "Vidaus" : "Lauko"}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />{court.maxPlayers} žaid.
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-0.5">
                          <Euro className="w-3.5 h-3.5 text-muted-foreground" />
                          {court.effectiveHourlyPrice % 1 === 0 ? court.effectiveHourlyPrice.toFixed(0) : court.effectiveHourlyPrice.toFixed(2)}/val
                        </span>
                        {court.rating != null && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                            {court.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {court.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {court.amenities.slice(0, 4).map(a => (
                            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{a}</span>
                          ))}
                          {court.amenities.length > 4 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">+{court.amenities.length - 4}</span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          const id = String(court.id);
                          setSelectedCourtId(prev => prev === id ? "auto" : id);
                          document.getElementById("reserve")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`w-full text-center text-xs font-medium py-1 rounded-lg transition-colors pt-1 ${
                          selectedCourtId === String(court.id)
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : "text-primary hover:bg-primary/5"
                        }`}
                      >
                        {selectedCourtId === String(court.id) ? "✓ Pasirinkta — pakeisti?" : "Pasirinkti šią aikštelę"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Surface specs */}
            {surfacesAvailable.length > 0 && (
              <SurfaceSpecs sport={sport} surface={surfacesAvailable[0]} />
            )}

            {/* Equipment */}
            {facility.equipment?.length > 0 && (
              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-border after:ml-2">
                  <Dumbbell className="w-4 h-4 text-primary" />Įranga
                </h2>
                <div className="flex flex-wrap gap-2">
                  {facility.equipment.map(item => (
                    <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Memberships */}
            <GroupMembershipSection
              facilityId={Number(facilityId)}
              sport={sport}
              memberships={memberships}
            />

            {/* Coaches */}
            {groupCoaches.length > 0 && (
              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-border after:ml-2">
                  <Trophy className="w-4 h-4 text-primary" />Treneriai
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {groupCoaches.map(coach => (
                    <a key={coach.id} href={`/coach/${coach.id}`}
                      className="flex gap-3 p-4 bg-card border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group">
                      {coach.photoUrl ? (
                        <img src={coach.photoUrl} alt={coach.name} className="w-12 h-12 rounded-full object-cover border-2 border-muted shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Trophy className="w-6 h-6 text-primary/50" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{coach.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {coach.pricePerHour != null && (
                            <span className="font-semibold text-foreground flex items-center gap-0.5">
                              <Euro className="w-3 h-3" />{coach.pricePerHour}/val
                            </span>
                          )}
                          {coach.availabilityDescription && <span>{coach.availabilityDescription}</span>}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Working hours */}
            {facility.businessHours && <WorkingHoursAccordion json={facility.businessHours} />}

            {/* Contact / facility details */}
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
              {safeUrl(facility.socialInstagram) && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Instagram className="w-4 h-4 shrink-0" />
                  <a href={safeUrl(facility.socialInstagram)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground truncate">{facility.socialInstagram!.replace(/^https?:\/\/(www\.)?/, "")}</a>
                </p>
              )}
              {safeUrl(facility.socialFacebook) && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Facebook className="w-4 h-4 shrink-0" />
                  <a href={safeUrl(facility.socialFacebook)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground truncate">{facility.socialFacebook!.replace(/^https?:\/\/(www\.)?/, "")}</a>
                </p>
              )}
            </div>

            {/* Map */}
            {facility.address && (
              <div className="rounded-xl overflow-hidden border h-56 w-full relative group">
                <iframe
                  title="Aikštelės vieta"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${facility.address}, ${facility.city ?? ""}, Lietuva`)}&hl=lt&z=16&output=embed`}
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${facility.address}, ${facility.city ?? ""}, Lietuva`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 bg-white text-zinc-900 text-xs font-semibold px-3 py-2 rounded-lg shadow-md flex items-center gap-1.5 hover:bg-primary hover:text-white transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Gauti kryptis
                </a>
              </div>
            )}

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 after:flex-1 after:h-px after:bg-border after:ml-3">
                  <Star className="w-5 h-5 text-primary" />
                  Atsiliepimai
                </h2>
                {reviewMeta?.averageRating != null && reviewMeta.reviewCount > 0 && (
                  <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
                    <span className="text-xl font-bold">{reviewMeta.averageRating.toFixed(1)}</span>
                    <div>
                      <StarDisplay rating={reviewMeta.averageRating} />
                      <p className="text-[10px] text-muted-foreground">{reviewMeta.reviewCount} {reviewsLabel(reviewMeta.reviewCount)}</p>
                    </div>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="flex items-center gap-3 py-3 px-4 bg-muted/30 rounded-xl border border-dashed text-muted-foreground text-sm">
                  <Star className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                  <span>Dar nėra atsiliepimų.</span>
                  <a href="/bookings" className="text-primary hover:underline ml-auto shrink-0 text-xs">Vertinti rezervaciją</a>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {reviews.map(review => (
                      <div key={review.id} className="bg-card border rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{review.reviewerName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(new Date(review.createdAt), "yyyy-MM-dd")}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <StarDisplay rating={review.rating} />
                            <span className="text-xs font-bold">{review.rating}.0</span>
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{review.comment}</p>
                        )}
                        {review.ownerReplyText && (
                          <div className="mt-3 ml-3 pl-3 border-l-2 border-primary/40 bg-muted/30 rounded-r-lg py-2 pr-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11px] font-semibold text-primary">Objekto atsakymas</span>
                              {review.ownerReplyCreatedAt && (
                                <span className="text-[10px] text-muted-foreground">{formatDate(new Date(review.ownerReplyCreatedAt), "yyyy-MM-dd")}</span>
                              )}
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{review.ownerReplyText}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {reviewsQ.hasNextPage && (
                    <div className="mt-4 flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => reviewsQ.fetchNextPage()} disabled={reviewsQ.isFetchingNextPage}>
                        {reviewsQ.isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        Rodyti daugiau
                      </Button>
                    </div>
                  )}
                </>
              )}

              {reviews.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Norite palikti atsiliepimą? Eikite į{" "}
                  <a href="/bookings" className="text-primary hover:underline">Mano rezervacijos</a>{" "}
                  ir šalia patvirtintos rezervacijos spustelėkite „Vertinti".
                </p>
              )}
            </div>

          </div>

          {/* ── Right column: booking widget ── */}
          <div className="lg:col-span-1" id="reserve">
            <div className="lg:sticky lg:top-20">
              <div className="border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b">
                  <h3 className="font-bold text-lg text-foreground">Rezervuoti laiką</h3>
                  {startingPrice != null && (
                    <p className="text-sm text-muted-foreground">Nuo {startingPrice.toFixed(0)} €/val</p>
                  )}
                </div>
                <GroupBookingWidget
                  facilityId={Number(facilityId)}
                  sport={sport}
                  selectedCourtId={selectedCourtId}
                  onCourtIdChange={setSelectedCourtId}
                  latitude={facility.latitude}
                  longitude={facility.longitude}
                  isOutdoor={isOutdoorAvailable}
                  lastBookedAt={lastBookedAt}
                  openGames={openGames}
                  initialDate={dateParam}
                  linkGame={linkGameId ? { id: linkGameId, playersNeeded: linkedGame?.playersNeeded ?? null } : null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky reserve bar — jumps to the booking widget */}
      {showReserveBar && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-background/95 backdrop-blur-md border-t shadow-2xl px-4 pr-20 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-0.5 truncate">
                {getSportLabel(sport)}{facility.city ? ` · ${facility.city}` : ""}
              </p>
              <p className="font-bold text-lg leading-tight">
                {startingPrice != null
                  ? <>Nuo {startingPrice.toFixed(0)} €<span className="text-xs font-normal text-muted-foreground">/val</span></>
                  : "Rezervuoti laiką"}
              </p>
            </div>
            <Button
              className="h-11 px-6 font-semibold shrink-0"
              onClick={() => document.getElementById("reserve")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Rezervuoti
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
