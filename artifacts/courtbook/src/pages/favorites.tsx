import { useState } from "react";
import { Link } from "wouter";
import { EmptyState } from "@/components/empty-state";
import { Heart, Building2, GraduationCap, MapPin, Star } from "lucide-react";
import { Layout } from "@/components/layout";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { centsToEuroString } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SportIcon, getSportColor } from "@/components/sport-icon";
import { useT } from "@/lib/i18n";

export default function FavoritesPage() {
  const t = useT();
  const { favorites, loading: favoritesLoading, coachFavorites, loadingCoachFav } = useFavoritesContext();
  const [activeTab, setActiveTab] = useState<"courts" | "coaches">("courts");

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mano mėgstami</h1>
            <p className="text-sm text-muted-foreground">
              {favorites.length + coachFavorites.length === 0
                ? "Dar nėra išsaugotų"
                : `${favorites.length + coachFavorites.length} išsaugota iš viso`}
            </p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-0 border-b">
          <button
            onClick={() => setActiveTab("courts")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "courts"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Aikštelės
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "courts" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {favorites.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("coaches")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "coaches"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Treneriai
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "coaches" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {coachFavorites.length}
            </span>
          </button>
        </div>

        {/* Courts */}
        {activeTab === "courts" && (
          favoritesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
            </div>
          ) : favorites.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-12 h-12" />}
              title={t("profile.noFavorites")}
              description="Paspauskite ❤ ant aikštelės, kad ją išsaugotumėte"
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/explore">{t("bookings.browseCourts")}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((court) => {
                const color = getSportColor(court.type);
                return (
                  <Link key={court.id} href={`/courts/${court.id}`}>
                    <div className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                      <div
                        className="h-32 bg-muted relative overflow-hidden"
                        style={court.imageUrl ? { backgroundImage: `url(${court.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute top-2.5 left-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: color }}>
                            <SportIcon sport={court.type} size={14} strokeWidth={2} className="text-white" />
                          </div>
                        </div>
                        {court.rating && (
                          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {court.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <div className="p-3.5">
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{court.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />{court.city}
                        </p>
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-sm font-bold" style={{ color }}>
                            {court.pricePerHour}€<span className="text-xs font-normal text-muted-foreground">/val</span>
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {court.isIndoor ? t("card.indoor") : t("card.outdoor")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* Coaches */}
        {activeTab === "coaches" && (
          loadingCoachFav ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
            </div>
          ) : coachFavorites.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="w-12 h-12" />}
              title="Nėra mėgstamų trenerių"
              description="Paspauskite ❤ ant trenerio, kad jį išsaugotumėte"
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/coaches">Naršyti trenerius</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coachFavorites.map((coach) => (
                <Link key={coach.id} href={`/coaches/${coach.id}`}>
                  <div className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="h-32 bg-muted relative overflow-hidden">
                      {coach.photoUrl ? (
                        <img src={coach.photoUrl} alt={coach.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/5">
                          <GraduationCap className="w-12 h-12 text-primary/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                    <div className="p-3.5">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{coach.name}</p>
                      {coach.sports.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{coach.sports.join(", ")}</p>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        {coach.pricePerHour != null ? (
                          <span className="text-sm font-bold text-primary">
                            {centsToEuroString(coach.pricePerHour)}€<span className="text-xs font-normal text-muted-foreground">/val</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Kaina derinama</span>
                        )}
                        <Badge variant="outline" className="text-xs gap-1">
                          <GraduationCap className="w-3 h-3" /> Treneris
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
