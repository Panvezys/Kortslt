import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useGetStatsSummary, useGetPopularCourts, useListCourts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { CourtMap } from "@/components/court-map";
import { CourtCard } from "@/components/court-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ArrowRight, Heart, Landmark, Search, Plus, Mail, Phone, Instagram, Facebook, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useUser } from "@clerk/react";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { sportLithuanian } from "@/components/court-map";

const HERO_IMAGES = [
  "courts/court_2_bernardinu.png",
  "courts/padel/padel_court_indoor_1.jpg",
  "courts/court_1_seb_arena.png",
  "courts/football/football_futsal_court_2.jpg",
  "courts/court_4_verkiai.png",
  "courts/badminton/badminton_court_indoor_1.jpg",
  "courts/court_17_zalgiris.png",
  "courts/squash/squash_court_1.jpg",
  "courts/padel/padel_court_indoor_3.jpg",
  "courts/court_3_lsc_vingis.png",
];

type PopularCourt = { id: number; name: string; type: string; city: string; imageUrl?: string | null; rating?: number | null; pricePerHour?: number | string | null };

function PopularCourtCard({ court }: { court: PopularCourt }) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const imgSrc = court.imageUrl
    ? court.imageUrl.startsWith("http") ? court.imageUrl : `${base}/${court.imageUrl}`
    : null;
  const sportLabel = t(`sports.${court.type}` as never) || court.type;
  const color = sportColor[court.type] ?? "#84cc16";

  return (
    <Link href={`/courts/${court.id}`}>
      <Card
        className="h-full transition-all duration-200 group cursor-pointer overflow-hidden hover:shadow-lg"
        style={{ borderColor: hovered ? color : undefined }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
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
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <SportIcon sport={court.type} size={40} style={{ color }} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white capitalize" style={{ background: color }}>
              <SportIcon sport={court.type} size={10} strokeWidth={2.2} />
              {sportLabel}
            </span>
          </div>
          {court.rating ? (
            <div className="absolute top-2 right-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                {court.rating.toFixed(1)}
              </span>
            </div>
          ) : null}
        </div>
        <CardHeader className="pb-2">
          <CardTitle
            className="transition-colors duration-200 text-base line-clamp-1"
            style={{ color: hovered ? color : undefined }}
          >
            {court.name}
          </CardTitle>
          <div className="flex items-center text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 mr-1 shrink-0" />
            <span className="truncate">{court.city}</span>
            {court.pricePerHour && (
              <span
                className="ml-auto font-semibold transition-colors duration-200"
                style={{ color: hovered ? color : undefined }}
              >
                {court.pricePerHour}€<span className="font-normal text-muted-foreground">{t("card.perHour")}</span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full transition-colors duration-200"
            style={hovered ? { backgroundColor: color, borderColor: color, color: "#fff" } : undefined}
          >
            {t("home.popular.bookNow")}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Home() {
  const t = useT();
  const { isSignedIn } = useUser();
  const { favorites, loading: favLoading } = useFavoritesContext();
  const [heroIdx, setHeroIdx] = useState(0);
  const ALL_SPORTS = Object.keys(sportLithuanian);
  const [activeSports, setActiveSports] = useState<Set<string>>(new Set(ALL_SPORTS));

  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) { next.delete(sport); } else { next.add(sport); }
      return next;
    });
  };
  const allActive = activeSports.size === ALL_SPORTS.length;
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: stats, isLoading: statsLoading } = useGetStatsSummary();
  const { data: popularCourts, isLoading: popularLoading } = useGetPopularCourts();
  const { data: courts, isLoading: courtsLoading } = useListCourts();

  const heroLines = t("home.hero.title").split("\n");

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-950 text-white pt-24 pb-32">
        {/* Slideshow background */}
        <div className="absolute inset-0 z-0">
          {HERO_IMAGES.map((img, i) => (
            <img
              key={img}
              src={`${base}/${img}`}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: i === heroIdx ? 1 : 0,
                transition: "opacity 1.6s ease-in-out",
                zIndex: i === heroIdx ? 1 : 0,
              }}
              aria-hidden
            />
          ))}
          {/* Dark overlay — keeps text readable without being too heavy */}
          <div className="absolute inset-0 bg-zinc-950/68 z-10" />
          {/* Left-side vignette for extra text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/75 via-zinc-950/20 to-transparent z-10" />
        </div>
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent z-[1]"></div>
        <div className="container px-4 mx-auto relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance">
              {(() => {
                const [line1, line2] = heroLines;
                const isEnglishTop = line1?.toLowerCase().includes("find your court");
                const top = isEnglishTop ? line2 : line1;
                const bottom = isEnglishTop ? line1 : line2;
                return (
                  <>
                    {top}
                    <br />
                    <span className="text-primary">{bottom}</span>
                  </>
                );
              })()}
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-xl">
              {t("home.hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/courts" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2">
                <Search className="h-4 w-4" />
                {t("home.hero.browse")}
              </Link>
              <Link href="/owner" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-zinc-800 hover:text-white h-12 px-8 py-2">
                <Plus className="h-4 w-4" />
                {t("home.hero.list")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 text-center divide-x divide-border/50">
            {statsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : stats ? (
              <>
                {[
                  { count: stats.totalCourts,                                                                                                              label: t("home.stats.courtsAvailable"), sport: null,           href: "/courts" },
                  { count: stats.tennisCourts,                                                                                                             label: t("sports.tennis"),             sport: "tennis",       href: "/courts?type=tennis" },
                  { count: stats.basketballCourts ?? 0,                                                                                                    label: t("sports.basketball"),         sport: "basketball",   href: "/courts?type=basketball" },
                  { count: stats.padelCourts ?? 0,                                                                                                         label: t("sports.padel"),              sport: "padel",        href: "/courts?type=padel" },
                  { count: stats.totalCourts - stats.tennisCourts - (stats.basketballCourts ?? 0) - (stats.padelCourts ?? 0),                              label: t("home.stats.otherSports"),    sport: "multi",        href: "/courts" },
                ].sort((a, b) => b.count - a.count).map(({ count, label, sport, href }) => {
                  const numColor = sport === null ? undefined : sport === "multi" ? sportColor["football"] : sportColor[sport];
                  const isHovered = hoveredStat === label;
                  return (
                  <Link key={label} href={href}
                    className="group relative overflow-hidden px-4 py-6 cursor-pointer transition-colors"
                    onMouseEnter={() => setHoveredStat(label)}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    {/* Background content — fades out on hover */}
                    <div className="transition-opacity duration-200 group-hover:opacity-20">
                      <div className="text-3xl font-bold mb-2 transition-colors" style={{ color: isHovered ? numColor : undefined }}>{count}</div>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                        {sport === null ? (
                          <Landmark className="h-3.5 w-3.5 shrink-0" />
                        ) : sport === "multi" ? (
                          <div className="flex gap-0.5">
                            {(["football","badminton","squash"] as const).map(s => (
                              <SportIcon key={s} sport={s} size={12} strokeWidth={2} style={{ color: sportColor[s] }} />
                            ))}
                          </div>
                        ) : (
                          <SportIcon sport={sport} size={14} strokeWidth={2} style={{ color: sportColor[sport] }} />
                        )}
                        {label}
                      </div>
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-muted/60 backdrop-blur-sm">
                      <Search className="h-5 w-5" style={{ color: numColor ?? "currentColor" }} />
                      <span className="text-sm font-semibold tracking-wide" style={{ color: numColor ?? "currentColor" }}>Ieškoti</span>
                    </div>
                  </Link>
                  );
                })}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Map Section */}
      <section className="py-12 md:py-24 container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          <div className="w-full md:w-1/3 flex flex-col">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">{t("home.map.title")}</h2>
            <p className="text-muted-foreground mb-6">{t("home.map.description")}</p>

            {/* Sport filter */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Sporto šaka</span>
                <button
                  onClick={() => setActiveSports(allActive ? new Set() : new Set(ALL_SPORTS))}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  {allActive ? "Slėpti visus" : "Visi"}
                </button>
              </div>
              <div className="space-y-1">
                {ALL_SPORTS.map(sport => {
                  const active = activeSports.has(sport);
                  const color = sportColor[sport] ?? "#84cc16";
                  const count = (courts ?? []).filter(c => c.type === sport).length;
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleSport(sport)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left ${
                        active ? "bg-muted/50 hover:bg-muted" : "opacity-40 hover:opacity-60 hover:bg-muted/30"
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{ background: active ? color : "transparent", borderColor: color }}
                      >
                        <SportIcon sport={sport} size={10} strokeWidth={2} style={{ color: active ? "white" : color }} />
                      </div>
                      <span className={`flex-1 text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {sportLithuanian[sport]}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Link href="/courts" className="inline-flex items-center text-primary font-medium hover:underline mt-auto">
              {t("home.map.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="w-full md:w-2/3 h-[300px] md:h-[500px] bg-muted/20 rounded-xl">
            {courtsLoading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : courts ? (
              <CourtMap courts={courts} activeSports={activeSports} />
            ) : null}
          </div>
        </div>
      </section>

      {/* Favorite Courts — only shown when signed in and has favorites */}
      {isSignedIn && (favLoading || favorites.length > 0) && (
        <section className="py-16 border-t border-border/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Mėgstamiausi kortai</h2>
                <p className="text-sm text-muted-foreground">Jūsų išsaugoti kortai</p>
              </div>
              <Link href="/courts" className="ml-auto">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                  Visi kortai <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {favLoading ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[340px] w-full rounded-xl" />
                ))}
              </div>
            ) : favorites.length > 0 ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {favorites.map(court => (
                  <CourtCard key={court.id} court={court} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* Popular Courts */}
      <section className="py-12 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 md:mb-12 tracking-tight">{t("home.popular.title")}</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {popularLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[320px] w-full rounded-xl" />)
            ) : Array.isArray(popularCourts) ? (
              popularCourts.map(court => (
                <PopularCourtCard key={court.id} court={court} />
              ))
            ) : null}
          </div>
        </div>
      </section>

      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold mb-3">korts.lt</h3>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 text-muted-foreground">Contact</h4>
              <div className="space-y-2 text-sm">
                <a className="flex items-center gap-2 hover:text-primary transition-colors" href="mailto:hello@korts.lt">
                  <Mail className="h-4 w-4" />
                  hello@korts.lt
                </a>
                <a className="flex items-center gap-2 hover:text-primary transition-colors" href="tel:+37060000000">
                  <Phone className="h-4 w-4" />
                  +370 600 00000
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 text-muted-foreground">Social</h4>
              <div className="space-y-2 text-sm">
                <a className="flex items-center gap-2 hover:text-primary transition-colors" href="https://instagram.com/korts.lt" target="_blank" rel="noreferrer">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
                <a className="flex items-center gap-2 hover:text-primary transition-colors" href="https://facebook.com/korts.lt" target="_blank" rel="noreferrer">
                  <Facebook className="h-4 w-4" />
                  Facebook
                </a>
                <a className="flex items-center gap-2 hover:text-primary transition-colors" href="https://t.me/kortslt" target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
