import { Link } from "wouter";
import { Court } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CourtCard({ court }: { court: Court }) {
  return (
    <Card className="h-full flex flex-col hover:border-primary/50 transition-colors group overflow-hidden">
      {court.imageUrl ? (
        <div className="w-full h-48 overflow-hidden bg-muted">
          <img 
            src={court.imageUrl} 
            alt={court.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(court.name)}&background=random&size=400`;
            }}
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-muted/80 transition-colors">
          <span className="font-medium text-lg opacity-50">{court.name.charAt(0)}</span>
        </div>
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2 gap-2">
          <Badge variant={court.type === "tennis" ? "default" : "secondary"} className="capitalize">
            {court.type}
          </Badge>
          <span className="font-semibold text-lg text-primary">${court.pricePerHour}/hr</span>
        </div>
        <CardTitle className="group-hover:text-primary transition-colors line-clamp-1">{court.name}</CardTitle>
        <CardDescription className="flex items-center text-sm">
          <MapPin className="h-3 w-3 mr-1 shrink-0" />
          <span className="truncate">{court.address}, {court.city}</span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-4 flex-1">
        <div className="flex gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center" title="Max Players">
            <Users className="h-3.5 w-3.5 mr-1" />
            {court.maxPlayers}
          </div>
          <div className="flex items-center">
            <Info className="h-3.5 w-3.5 mr-1" />
            {court.isIndoor ? "Indoor" : "Outdoor"}
          </div>
        </div>
        {court.amenities && court.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
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
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
