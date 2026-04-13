import { Link } from "wouter";
import { useGetStatsSummary, useGetPopularCourts, useListCourts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { CourtMap } from "@/components/court-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ArrowRight } from "lucide-react";
import { resolveCourtImage } from "@/lib/imageUrl";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStatsSummary();
  const { data: popularCourts, isLoading: popularLoading } = useGetPopularCourts();
  const { data: courts, isLoading: courtsLoading } = useListCourts();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-950 text-white pt-24 pb-32">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/40 via-background to-background"></div>
        <div className="container px-4 mx-auto relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance">
              Find your <span className="text-primary">court.</span><br />
              Play your game.
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-xl">
              Book premium tennis and basketball courts instantly. No phone calls, no waiting. Just pick a time and show up.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/courts" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2">
                Browse Courts
              </Link>
              <Link href="/owner" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-zinc-800 hover:text-white h-12 px-8 py-2">
                List a Court
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/50">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : stats ? (
              <>
                <div className="px-4">
                  <div className="text-3xl font-bold mb-1">{stats.totalCourts}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Courts Available</div>
                </div>
                <div className="px-4">
                  <div className="text-3xl font-bold mb-1">{stats.totalBookings}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Total Bookings</div>
                </div>
                <div className="px-4">
                  <div className="text-3xl font-bold mb-1">{stats.tennisCourts}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Tennis</div>
                </div>
                <div className="px-4">
                  <div className="text-3xl font-bold mb-1">{stats.basketballCourts}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">Basketball</div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <section className="py-24 container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-1/3">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Kortai visoje Lietuvoje</h2>
            <p className="text-muted-foreground mb-6">
              Tyrinėkite interaktyvų žemėlapį ir raskite kortus visoje Lietuvoje — Vilniuje, Kaune, Klaipėdoje ir kituose miestuose. Žalia spalva — teniso kortai, oranžinė — krepšinis.
            </p>
            <Link href="/courts" className="inline-flex items-center text-primary font-medium hover:underline">
              View all courts <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="w-full md:w-2/3 h-[500px] bg-muted/20 rounded-xl">
            {courtsLoading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : courts ? (
              <CourtMap courts={courts} />
            ) : null}
          </div>
        </div>
      </section>

      {/* Popular Courts */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 tracking-tight">Most Popular</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {popularLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[320px] w-full rounded-xl" />)
            ) : popularCourts ? (
              popularCourts.map(court => {
                const imgSrc = resolveCourtImage(court.imageUrl);
                return (
                  <Link key={court.id} href={`/courts/${court.id}`}>
                    <Card className="h-full hover:border-primary/50 transition-all group cursor-pointer overflow-hidden hover:shadow-lg">
                      <div className="w-full h-44 overflow-hidden bg-muted relative">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={court.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(court.name)}&background=random&size=400`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl bg-muted">
                            {court.type === "tennis" ? "🎾" : "🏀"}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute top-2 left-2">
                          <Badge variant={court.type === "tennis" ? "default" : "secondary"} className="capitalize text-xs">
                            {court.type === "tennis" ? "🎾 Tennis" : "🏀 Basketball"}
                          </Badge>
                        </div>
                        <div className="absolute top-2 right-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                            {court.bookingCount} bookings
                          </span>
                        </div>
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="group-hover:text-primary transition-colors text-base line-clamp-1">{court.name}</CardTitle>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate">{court.city}</span>
                          {court.pricePerHour && (
                            <span className="ml-auto font-semibold text-foreground">
                              {court.pricePerHour}€<span className="font-normal text-muted-foreground">/hr</span>
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          Book Now
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : null}
          </div>
        </div>
      </section>
    </Layout>
  );
}
