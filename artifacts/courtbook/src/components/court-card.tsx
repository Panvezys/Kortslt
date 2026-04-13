import { Link } from "wouter";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useT } from "@/lib/i18n";

const sportConfig: Record<string, { emoji: string; color: string }> = {
  tennis:     { emoji: "🎾", color: "#84cc16" },
  basketball: { emoji: "🏀", color: "#f97316" },
  padel:      { emoji: "🏓", color: "#3b82f6" },
  football:   { emoji: "⚽", color: "#22c55e" },
  badminton:  { emoji: "🏸", color: "#a855f7" },
  squash:     { emoji: "🎯", color: "#06b6d4" },
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
  const imageSrc = resolveCourtImage(court.imageUrl);
  const sport = sportConfig[court.type] ?? sportConfig.tennis;
  const sportLabel = t(`sports.${court.type}` as never) || court.type;
  const surfaceLabel = court.surface ? (t(`surfaces.${court.surface}` as never) || court.surface) : null;

  return (
    <Card className="h-full flex flex-col hover:border-primary/50 transition-colors group overflow-hidden">
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
          <div className="absolute top-2 right-2 flex gap-1">
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
          </div>
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-4xl">
          {sport.emoji}
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: sport.color }}>
              {sport.emoji} {sportLabel}
            </span>
            <StarRating rating={court.rating} />
          </div>
          <span className="font-bold text-lg text-primary shrink-0">
            {court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">{t("card.perHour")}</span>
          </span>
        </div>
        <CardTitle className="group-hover:text-primary transition-colors line-clamp-1 text-base">{court.name}</CardTitle>
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
            {court.amenities.slice(0, 3).map((amenity, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                {amenity}
              </Badge>
            ))}
            {court.amenities.length > 3 && (
              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                +{court.amenities.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Link href={`/courts/${court.id}`} className="w-full">
          <Button variant="default" className="w-full">
            {t("card.viewBook")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
