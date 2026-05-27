import { Link } from "wouter";
import { MapPin, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SportPill } from "@/components/sport-icon";
import { resolveCourtImage } from "@/lib/imageUrl";
import type { SearchGroupResult } from "@/lib/search-groups-types";

interface FacilitySportCardProps {
  group: SearchGroupResult;
  href: string;
}

export function FacilitySportCard({ group, href }: FacilitySportCardProps) {
  const heroPhoto = resolveCourtImage(
    group.photos.length > 0 ? group.photos[0] : null,
    group.sport,
  );

  return (
    <Link href={href}>
      <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        <div className="relative h-44 overflow-hidden bg-muted">
          {heroPhoto && (
            <img
              src={heroPhoto}
              alt={group.facilityName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
          {group.isPromoted && (
            <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2 py-0.5 rounded-full">
              Reklamuojama
            </span>
          )}
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{group.facilityName}</p>
              <div className="mt-0.5">
                <SportPill sport={group.sport} />
              </div>
            </div>
            <div className="text-right shrink-0">
              {group.startingPrice != null && (
                <p className="text-sm font-semibold text-foreground">
                  Nuo {group.startingPrice.toFixed(0)} €<span className="font-normal text-muted-foreground">/val</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {group.city ?? ""}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {group.courtCount} aikšt.
              </Badge>
              {group.instantBookable && (
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <Zap className="w-3 h-3" />
                  Momentinis
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
