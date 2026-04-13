import { Link } from "wouter";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const surfaceLabels: Record<string, string> = {
  clay: "Gruntas",
  hard: "Kieta danga",
  carpet: "Kilimas",
  synthetic_grass: "Sint. žolė",
  parquet: "Parketas",
  rubber: "Guma",
};

const conditionStyles: Record<string, { label: string; className: string }> = {
  excellent: { label: "Puiki", className: "bg-green-100 text-green-700 border-green-200" },
  good: { label: "Gera", className: "bg-orange-100 text-orange-700 border-orange-200" },
  fair: { label: "Patenkinama", className: "bg-red-100 text-red-700 border-red-200" },
};

export function CourtCard({ court }: { court: Court }) {
  const condStyle = conditionStyles[court.condition] ?? conditionStyles.good;

  return (
    <Card className="h-full flex flex-col hover:border-primary/50 transition-colors group overflow-hidden">
      {court.imageUrl ? (
        <div className="w-full h-48 overflow-hidden bg-muted relative">
          <img
            src={court.imageUrl}
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
          <div className="flex gap-1.5 flex-wrap">
            <Badge variant={court.type === "tennis" ? "default" : "secondary"} className="capitalize text-xs">
              {court.type === "tennis" ? "🎾 Tenisas" : "🏀 Krepšinis"}
            </Badge>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${condStyle.className}`}>
              {condStyle.label}
            </span>
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
          {court.rating && (
            <div className="flex items-center gap-1">
              <span>⭐</span>
              <span>{court.rating.toFixed(1)}</span>
            </div>
          )}
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
