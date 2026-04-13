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
import { useT } from "@/lib/i18n";

const sportEmoji: Record<string, string> = {
  tennis: "🎾", basketball: "🏀", padel: "🏓", football: "⚽", badminton: "🏸", squash: "🎯",
};

export default function Home() {
  const t = useT();
  const { data: stats, isLoading: statsLoading } = useGetStatsSummary();
  const { data: popularCourts, isLoading: popularLoading } = useGetPopularCourts();
  const { data: courts, isLoading: courtsLoading } = useListCourts();

  const heroLines = t("home.hero.title").split("\n");

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-950 text-white pt-24 pb-32">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/40 via-background to-background"></div>
        <div className="container px-4 mx-auto relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance">
              {heroLines[0]?.includes("court") || heroLines[0]?.includes("корт") || heroLines[0]?.includes("kortą") ? (
                <>
                  {heroLines[0]} <br />
                  <span className="text-primary">{heroLines[1]}</span>
                </>
              ) : (
                <>
                  {heroLines[0]}<br />
                  <span className="text-primary">{heroLines[1]}</span>
                </>
              )}
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-xl">
              {t("home.hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/courts" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2">
                {t("home.hero.browse")}
              </Link>
              <Link href="/owner" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-zinc-800 hover:text-white h-12 px-8 py-2">
                {t("home.hero.list")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 text-center divide-x divide-border/50">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : stats ? (
              <>
                {[
                  { count: stats.totalCourts, label: t("home.stats.courtsAvailable"), emoji: "🏟", href: "/courts" },
                  { count: stats.tennisCourts, label: t("sports.tennis"), emoji: "🎾", href: "/courts?type=tennis" },
                  { count: stats.basketballCourts ?? 0, label: t("sports.basketball"), emoji: "🏀", href: "/courts?type=basketball" },
                  { count: stats.totalCourts - stats.tennisCourts - (stats.basketballCourts ?? 0), label: t("home.stats.otherSports"), emoji: "🏓⚽🏸🎯", href: "/courts" },
                ].map(({ count, label, emoji, href }) => (
                  <Link key={label} href={href} className="group px-4 py-6 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div className="text-3xl font-bold mb-1 transition-colors group-hover:text-green-500">{count}</div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider">
                      {emoji} {label}
                    </div>
                  </Link>
                ))}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <section className="py-24 container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-1/3">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">{t("home.map.title")}</h2>
            <p className="text-muted-foreground mb-6">{t("home.map.description")}</p>
            <Link href="/courts" className="inline-flex items-center text-primary font-medium hover:underline">
              {t("home.map.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
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
          <h2 className="text-3xl font-bold mb-12 tracking-tight">{t("home.popular.title")}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {popularLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[320px] w-full rounded-xl" />)
            ) : popularCourts ? (
              popularCourts.map(court => {
                const imgSrc = resolveCourtImage(court.imageUrl);
                const emoji = sportEmoji[court.type as string] ?? "🏟";
                const sportLabel = t(`sports.${court.type as string}` as never) || court.type;
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
                            {emoji}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute top-2 left-2">
                          <Badge variant="default" className="capitalize text-xs">
                            {emoji} {sportLabel}
                          </Badge>
                        </div>
                        <div className="absolute top-2 right-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                            {court.bookingCount} {t("home.popular.bookings")}
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
                              {court.pricePerHour}€<span className="font-normal text-muted-foreground">{t("card.perHour")}</span>
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {t("home.popular.bookNow")}
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
