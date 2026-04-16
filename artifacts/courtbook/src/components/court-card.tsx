import { useState } from "react";
import { Link } from "wouter";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Star, Heart, ShieldCheck } from "lucide-react";
import { getAmenityMeta } from "@/lib/amenities";
import { Button } from "@/components/ui/button";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useT } from "@/lib/i18n";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useUser } from "@clerk/react";
import { SportIcon, sportColor } from "@/components/sport-icon";

const sportConfig: Record<string, { color: string }> = {
  tennis:       { color: sportColor.tennis },
  basketball:   { color: sportColor.basketball },
  padel:        { color: sportColor.padel },
  football:     { color: sportColor.football },
  badminton:    { color: sportColor.badminton },
  squash:       { color: sportColor.squash },
  table_tennis: { color: sportColor.table_tennis },
  golf:         { color: sportColor.golf },
  snooker:      { color: sportColor.snooker },
  bowling:      { color: sportColor.bowling },
};

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

export function CourtCard({ court }: { court: Court }) {
  const t = useT();
  const { isSignedIn } = useUser();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const imageSrc = resolveCourtImage(court.imageUrl, court.type);
  const sport = sportConfig[court.type] ?? { color: "#84cc16" };
  const sportLabel = t(`sports.${court.type}` as never) || court.type;
  const surfaceLabel = court.surface ? (t(`surfaces.${court.surface}` as never) || court.surface) : null;
  const favorited = isFavorite(court.id);

  return (
    <Card
      className="h-full flex flex-col transition-colors duration-200 group overflow-hidden"
      style={{
        borderColor: hovered ? sport.color : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {imageSrc ? (
        <div className="w-full h-48 overflow-hidden bg-muted relative">
          <img
            src={imageSrc}
            alt={court.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(court.name)}&background=random&size=400`;
            }}
          />
          <div className="absolute top-2 right-2 flex gap-1 items-center">
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
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-4xl relative">
          {sport.emoji}
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
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all duration-200 ${hovered ? "text-white" : "bg-muted text-muted-foreground"}`}
              style={hovered ? { background: sport.color } : undefined}
            >
              <SportIcon sport={court.type} size={11} strokeWidth={2} className="shrink-0" />
              {sportLabel}
            </span>
            <StarRating rating={court.rating} />
            {(court as any).facilityVerified && (
              <Badge className="gap-1 text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30">
                <ShieldCheck className="w-2.5 h-2.5" /> Patvirtinta
              </Badge>
            )}
          </div>
          <span
            className="font-bold text-lg shrink-0 transition-colors duration-200"
            style={{ color: hovered ? sport.color : undefined }}
          >
            <span className="text-xs font-normal text-muted-foreground mr-0.5">{t("card.from")}</span>{court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">{t("card.perHour")}</span>
          </span>
        </div>
        <CardTitle
          className="transition-colors duration-200 line-clamp-1 text-base"
          style={{ color: hovered ? sport.color : undefined }}
        >
          {court.name}
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

      <CardFooter className="pt-0">
        <Link href={`/courts/${court.id}`} className="w-full"
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
        >
          <Button
            variant="outline"
            className="w-full transition-all duration-200 active:scale-[0.98]"
            style={btnHovered ? { backgroundColor: sport.color, borderColor: sport.color, color: "#fff", boxShadow: `0 4px 14px ${sport.color}55` } : undefined}
          >
            {t("card.viewBook")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
