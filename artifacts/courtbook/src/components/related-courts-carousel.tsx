import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Star, MapPin, Euro, ArrowRight } from "lucide-react";
import { resolveCourtImage } from "@/lib/imageUrl";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface RelatedCourt {
  id: number;
  name: string;
  type: string;
  surface?: string | null;
  pricePerHour: string;
  imageUrl?: string | null;
  isIndoor: boolean;
  rating?: number | null;
  address?: string | null;
  city?: string | null;
}

interface Props {
  currentCourtId: number;
}

export function RelatedCourtsCarousel({ currentCourtId }: Props) {
  const [, navigate] = useLocation();

  const { data } = useQuery<RelatedCourt[]>({
    queryKey: ["related-courts", currentCourtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${currentCourtId}/related`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!currentCourtId,
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          🏟️ Kitos aikštelės šiame komplekse
        </h2>
        <button
          onClick={() => navigate("/courts")}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Visos aikštelės
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted"
        style={{ scrollbarWidth: "thin" }}
      >
        {data.map((court) => {
          const price = parseFloat(court.pricePerHour);
          const img = resolveCourtImage(court.imageUrl ?? undefined);
          return (
            <button
              key={court.id}
              type="button"
              onClick={() => navigate(`/courts/${court.id}`)}
              className="snap-start shrink-0 w-52 rounded-xl border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all text-left group"
            >
              <div className="relative h-32 overflow-hidden bg-muted">
                <img
                  src={img ?? ""}
                  alt={court.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {court.isIndoor && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold bg-background/90 px-1.5 py-0.5 rounded-full border">
                    Patalpose
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm leading-tight truncate">{court.name}</p>
                {court.city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {court.city}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="flex items-center gap-0.5 text-sm font-bold text-primary">
                    <Euro className="w-3 h-3" />
                    {price.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground">/30min</span>
                  </span>
                  {court.rating && (
                    <span className="flex items-center gap-1 text-xs text-yellow-500 font-semibold">
                      <Star className="w-3 h-3 fill-yellow-400" />
                      {court.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
