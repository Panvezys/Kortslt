import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Building2, Loader2, Star, Users } from "lucide-react";
import { resolveCourtImage } from "@/lib/imageUrl";
import { SportPill, getSportColor } from "@/components/sport-icon";
import { useT } from "@/lib/i18n";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface FacilityCourt {
  id: number;
  name: string;
  type: string;
  pricePerHour: number;
  imageUrl?: string;
  isIndoor?: boolean;
  rating?: number;
  maxPlayers?: number;
  amenities?: string[];
  surface?: string;
  photos: string[];
}

interface FacilityDetail {
  id: number;
  name: string;
  city?: string;
  address?: string;
  description?: string;
  courts: FacilityCourt[];
}

function CourtPhoto({ court }: { court: FacilityCourt }) {
  const allUrls = [
    resolveCourtImage(court.imageUrl, court.type),
    ...court.photos.map(p => resolveCourtImage(p)),
  ].filter(Boolean) as string[];

  const src = allUrls[0];
  if (!src) {
    return (
      <div className="w-full h-44 bg-muted flex items-center justify-center text-muted-foreground/40">
        <Building2 className="w-10 h-10" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={court.name}
      className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}

export default function FacilityPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const t = useT();
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/facilities/${id}/public`)
      .then(r => {
        if (!r.ok) throw new Error("Objektas nerastas");
        return r.json();
      })
      .then(setFacility)
      .catch(err => setError(err.message ?? "Klaida"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !facility) {
    return (
      <Layout>
        <div className="container flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-lg font-medium text-destructive">{error ?? "Objektas nerastas"}</p>
          <BackButton to="/explore" label="Grįžti į aikšteles" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <BackButton to="/explore" label="Visos aikštelės" />

        {/* Facility header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{facility.name}</h1>
          </div>
          {(facility.address || facility.city) && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([facility.address, facility.city, "Lietuva"].filter(Boolean).join(", "))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              {[facility.address, facility.city].filter(Boolean).join(", ")}
            </a>
          )}
          {facility.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {facility.description}
            </p>
          )}
        </div>

        {/* Courts grid */}
        {facility.courts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-10 h-10" />}
            title="Nėra aktyvių aikštelių"
            description="Šiam objektui šiuo metu nėra viešai prieinamų aikštelių."
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {facility.courts.length} {facility.courts.length === 1 ? "aikštelė" : facility.courts.length < 10 ? "aikštelės" : "aikštelių"}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {facility.courts.map(court => {
                const sportColor = getSportColor(court.type);
                return (
                  <div
                    key={court.id}
                    className="rounded-xl border bg-card overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                    onClick={() => setLocation(`/facility/${facility.id}?sport=${court.type.replace(/-/g, "_")}`)}
                  >
                    <div className="overflow-hidden relative">
                      <CourtPhoto court={court} />
                      {court.isIndoor !== undefined && (
                        <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                          {court.isIndoor ? t("detail.indoor") : t("detail.outdoor")}
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                          {court.name}
                        </p>
                        <span className="text-sm font-bold shrink-0" style={{ color: sportColor }}>
                          {Math.round(court.pricePerHour)}€<span className="text-xs font-normal text-muted-foreground">/val</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <SportPill sport={court.type} variant="solid" />
                        {court.rating && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {court.rating.toFixed(1)}
                          </span>
                        )}
                        {court.maxPlayers && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            {court.maxPlayers}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-1 text-xs font-semibold"
                        style={{ backgroundColor: sportColor, borderColor: sportColor, color: "#fff" }}
                        onClick={e => { e.stopPropagation(); setLocation(`/facility/${facility.id}?sport=${court.type.replace(/-/g, "_")}#reserve`); }}
                      >
                        Rezervuoti
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
