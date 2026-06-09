import { useState, useMemo } from "react";
import { Link } from "wouter";
import { MapPin, ChevronRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SportPill, SportCourtIcon } from "@/components/sport-icon";
import { useSportIconConfig } from "@/lib/sport-icons";
import { resolveCourtImage } from "@/lib/imageUrl";
import type { SearchGroupResult } from "@/lib/search-groups-types";

interface FacilitySportCardProps {
  group: SearchGroupResult;
  href: string;
}

export function FacilitySportCard({ group, href }: FacilitySportCardProps) {
  // Cyclable gallery of the group's photos (falls back to a sport placeholder).
  const gallery = useMemo(() => {
    const list: string[] = [];
    for (const p of group.photos ?? []) {
      const r = resolveCourtImage(p, group.sport);
      if (r && !list.includes(r)) list.push(r);
      if (list.length >= 5) break;
    }
    if (list.length === 0) {
      const fb = resolveCourtImage(null, group.sport);
      if (fb) list.push(fb);
    }
    return list;
  }, [group.photos, group.sport]);

  const [photoIdx, setPhotoIdx] = useState(0);
  const iconCfg = useSportIconConfig(group.sport);
  const showIndoor  = group.isIndoorAvailable;
  const showOutdoor = group.isOutdoorAvailable;

  return (
    <Link href={href}>
      <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col">
        <div
          className="relative h-44 overflow-hidden bg-muted shrink-0"
          onClick={gallery.length > 1 ? (e) => { e.preventDefault(); e.stopPropagation(); setPhotoIdx(i => (i + 1) % gallery.length); } : undefined}
          style={{ cursor: gallery.length > 1 ? "pointer" : undefined }}
          role={gallery.length > 1 ? "button" : undefined}
          aria-label={gallery.length > 1 ? `${photoIdx + 1} / ${gallery.length}` : undefined}
        >
          {gallery.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={group.facilityName}
              className="absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
              style={{ opacity: i === photoIdx ? 1 : 0 }}
            />
          ))}
          {group.isPromoted && (
            <span className="absolute top-2 left-2 z-10 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2 py-0.5 rounded-full">
              Reklamuojama
            </span>
          )}
          {(showIndoor || showOutdoor) && (
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
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
          {gallery.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPhotoIdx(i); }}
                  aria-label={`Nuotrauka ${i + 1}`}
                  className="rounded-full transition-all duration-200"
                  style={{ width: i === photoIdx ? 18 : 6, height: 6, background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.5)" }}
                />
              ))}
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
              {group.groupRating != null && (
                <span className="flex items-center justify-end gap-0.5 text-xs font-medium text-foreground">
                  <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                  {group.groupRating.toFixed(1)}
                </span>
              )}
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
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 gap-1"
                title={`${group.courtCount} aikštelės`}
                aria-label={`${group.courtCount} aikštelės`}
              >
                <SportCourtIcon
                  sport={iconCfg.iconKey}
                  size={13}
                  strokeWidth={2}
                  style={{ color: iconCfg.color }}
                  className="shrink-0"
                  aria-hidden="true"
                />
                {group.courtCount}
              </Badge>
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
