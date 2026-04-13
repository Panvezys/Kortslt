import { Link } from "wouter";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveCourtImage } from "@/lib/imageUrl";

const surfaceLabels: Record<string, string> = {
  clay: "Gruntas",
  hard: "Kieta danga",
  carpet: "Kilimas",
  synthetic_grass: "Sint. žolė",
  artificial_grass: "Dirbt. žolė",
  natural_grass: "Natūr. žolė",
  parquet: "Parketas",
  rubber: "Guma",
};

const sportConfig: Record<string, { emoji: string; label: string; color: string }> = {
  tennis:     { emoji: "🎾", label: "Tenisas",     color: "#84cc16" },
  basketball: { emoji: "🏀", label: "Krepšinis",   color: "#f97316" },
  padel:      { emoji: "🏓", label: "Padelis",     color: "#3b82f6" },
  football:   { emoji: "⚽", label: "Futbolas",    color: "#22c55e" },
  badminton:  { emoji: "🏸", label: "Badmintonas", color: "#a855f7" },
  squash:     { emoji: "🎯", label: "Squash",      color: "#06b6d4" },
};

function StarRating({ rating, size = "sm" }: { rating?: number; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  if (!rating) {
    return (
      <span className="text-[10px] text-muted-foreground italic">Nėra įvertinimų</span>
    );
  }
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f${i}`} className={`${iconSize} fill-yellow-400 text-yellow-400`} />
        ))}
        {hasHalf && (
          <Star key="half" className={`${iconSize} fill-yellow-200 text-yellow-400`} />
        )}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e${i}`} className={`${iconSize} text-muted-foreground/30`} />
        ))}
      </div>
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

export function CourtCard({ court }: { court: Court }) {
  const imageSrc = resolveCourtImage(court.imageUrl);

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
            {court.isIndoor && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">Vidaus</span>
            )}
            {court.surface && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                {surfaceLabels[court.surface] ?? court.surface}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-4xl">
          {court.type === "tennis" ? "🎾" : "🏀"}
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            {(() => {
              const s = sportConfig[court.type] ?? sportConfig.tennis;
              return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: s.color }}>
                  {s.emoji} {s.label}
                </span>
              );
            })()}
            <StarRating rating={court.rating} />
          </div>
          <span className="font-bold text-lg text-primary shrink-0">{court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">/val</span></span>
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
            <span>iki {court.maxPlayers} žaidėjų</span>
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
            Peržiūrėti ir rezervuoti
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
