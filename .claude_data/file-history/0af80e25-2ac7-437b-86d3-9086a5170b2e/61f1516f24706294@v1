import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Court } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Star, Heart, ShieldCheck, Eye } from "lucide-react";
import { getAmenityMeta } from "@/lib/amenities";
import { Button } from "@/components/ui/button";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useT } from "@/lib/i18n";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useUser } from "@clerk/react";
import { SportIcon, SportPill, getSportColor } from "@/components/sport-icon";

function StarRating({ rating }: { rating?: number }) {
  const t = useT();
  if (!rating) {
    return (
      <span className="text-[10px] text-muted-foreground italic">{t("detail.noReviews")}</span>
    );
  }
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalf && <Star key="half" className="h-3 w-3 fill-yellow-200 text-yellow-400" />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e${i}`} className="h-3 w-3 text-muted-foreground/30" />
        ))}
      </div>
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function CourtCard({ court }: { court: Court }) {
  const t = useT();
  const { isSignedIn } = useUser();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const sport = { color: getSportColor(court.type) };
  const sportLabel = t(`sports.${court.type}` as never) || court.type;
  const surfaceLabel = court.surface ? (t(`surfaces.${court.surface}` as never) || court.surface) : null;
  const favorited = isFavorite(court.id);

  // Build gallery: main imageUrl + up to 3 extra photos from the owner, de-duplicated.
  const gallery = useMemo(() => {
    const list: string[] = [];
    const main = resolveCourtImage(court.imageUrl, court.type);
    if (main) list.push(main);
    const extras = ((court as any).photos as string[] | undefined) ?? [];
    for (const p of extras) {
      if (!p) continue;
      const resolved = resolveCourtImage(p) ?? "";
      if (resolved && !list.includes(resolved)) list.push(resolved);
      if (list.length >= 3) break;
    }
    return list;
  }, [court.imageUrl, court.type, (court as any).photos]);

  const currentImage = gallery[photoIdx] ?? gallery[0];
  const cycle = (e: React.MouseEvent) => {
    if (gallery.length <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx(i => (i + 1) % gallery.length);
  };

  return (
    <Card
      className="h-full flex flex-col transition-colors duration-200 group overflow-hidden"
      style={{
        borderColor: hovered ? sport.color : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {currentImage ? (
        <div
          className="w-full h-48 overflow-hidden bg-muted relative select-none"
          onClick={cycle}
          style={{ cursor: gallery.length > 1 ? "pointer" : undefined }}
          role={gallery.length > 1 ? "button" : undefined}
          aria-label={gallery.length > 1 ? `${photoIdx + 1} / ${gallery.length}` : undefined}
        >
          {gallery.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={court.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
              style={{ opacity: i === photoIdx ? 1 : 0 }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(court.name)}&background=random&size=400`;
              }}
            />
          ))}
          <div className="absolute top-2 right-2 flex gap-1 items-center z-10">
            {court.isIndoor !== undefined && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                {court.isIndoor ? t("card.indoor") : t("card.outdoor")}
              </span>
            )}
            {surfaceLabel && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                {surfaceLabel}
              </span>
            )}
            {isSignedIn && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(court.id); }}
                aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${favorited ? "fill-red-500 text-red-500" : "text-white"}`} />
              </button>
            )}
          </div>

          {/* Photo bubble indicators */}
          {gallery.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm z-10">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPhotoIdx(i); }}
                  aria-label={`Nuotrauka ${i + 1}`}
                  className="transition-all duration-200 rounded-full"
                  style={{
                    width: i === photoIdx ? 18 : 6,
                    height: 6,
                    background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-4xl relative">
          <SportIcon sport={court.type} size={42} strokeWidth={1.5} className="opacity-60" />
          {isSignedIn && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(court.id); }}
              aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${favorited ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            <SportPill sport={court.type} variant="solid" className="transition-all duration-200" />
            <StarRating rating={court.rating} />
            {(court as any).facilityVerified && (
              <Badge className="gap-1 text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30">
                <ShieldCheck className="w-2.5 h-2.5" /> Patvirtinta
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-0.5 shrink-0">
            <span className="text-xs text-muted-foreground">{t("card.from")}</span>
            <span className="text-lg font-bold text-foreground">
              {Math.round(court.minDisplayPrice ?? court.pricePerHour)}€
            </span>
            <span className="text-xs text-muted-foreground">{t("card.perHour")}</span>
          </div>
        </div>
        <CardTitle
          className="transition-colors duration-200 line-clamp-1 text-base"
          style={{ color: hovered ? sport.color : undefined }}
        >
          <Link href={`/courts/${court.id}`} className="hover:underline">
            {court.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center text-xs">
          <MapPin className="h-3 w-3 mr-1 shrink-0" />
          <span className="truncate">{court.city} — {court.address}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-4 flex-1">
        <div className="flex gap-3 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{t("card.maxPlayers", { n: court.maxPlayers })}</span>
          </div>
        </div>
        {court.amenities && court.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {court.amenities.slice(0, 3).map((amenity, i) => {
              const { label, icon: Icon } = getAmenityMeta(amenity);
              return (
                <Badge key={i} variant="outline" className="text-[10px] font-normal px-1.5 py-0 gap-1">
                  <Icon className="w-2.5 h-2.5 shrink-0" />
                  {label}
                </Badge>
              );
            })}
            {court.amenities.length > 3 && (
              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                +{court.amenities.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 gap-2">
        <Link href={`/courts/${court.id}`} aria-label={t("card.view")}>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 transition-all duration-200 active:scale-[0.98]"
            title={t("card.view")}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </Link>
        <Link href={`/courts/${court.id}#reserve`} className="flex-1"
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
        >
          <Button
            className="w-full transition-all duration-200 active:scale-[0.98] font-semibold"
            style={{ backgroundColor: sport.color, borderColor: sport.color, color: "#fff", ...(btnHovered ? { boxShadow: `0 4px 14px ${sport.color}55` } : {}) }}
          >
            {t("card.reserve")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
