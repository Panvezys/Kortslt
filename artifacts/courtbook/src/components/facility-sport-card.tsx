import { Link } from "wouter";
import { MapPin, Zap, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const showIndoor  = group.isIndoorAvailable;
  const showOutdoor = group.isOutdoorAvailable;

  return (
    <Link href={href}>
      <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col">
        <div className="relative h-44 overflow-hidden bg-muted shrink-0">
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
          {(showIndoor || showOutdoor) && (
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
              {showIndoor && (
                <span className="bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Vidaus
                </span>
              )}
              {showOutdoor && (
                <span className="bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Lauko
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-3 space-y-2 flex flex-col flex-1">
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

          <div className="pt-1 mt-auto">
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              Žiūrėti laikus
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
