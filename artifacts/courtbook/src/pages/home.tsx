import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarDays, ChevronDown, ChevronUp, Heart, Landmark, Mail, Search, Trophy, BarChart3, CheckCircle2, CreditCard, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import { useGetStatsSummary, useGetPopularCourts, useListCourts, useGetFavorites, useGetFavoriteCourts, useGetTournaments } from "@/lib/api";
import { Layout } from "@/components/layout";
import { CourtMap } from "@/components/court-map";
import { DragScrollRow } from "@/components/drag-scroll-row";
import { CourtCard } from "@/components/court-card";
import { FeaturedTournamentsSection } from "@/components/featured-tournaments-section";
import { resolveCourtImage } from "@/lib/imageUrl";

const HERO_IMAGES = [
  "courts/court_2_bernardinu",
  "courts/padel/padel_court_indoor_1",
  "courts/court_1_seb_arena",
  "courts/football/football_futsal_court_2",
  "courts/court_4_verkiai",
];

type PopularCourt = { id: number; name: string; type: string; city: string; address?: string | null; imageUrl?: string | null; isIndoor?: boolean | null; rating?: number | null; pricePerHour?: number | string | null };

function PopularCourtCard({ court }: { court: PopularCourt }) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const imgSrc = resolveCourtImage(court.imageUrl, court.type);
  const sportLabel = t(`sports.${court.type}` as never) || court.type;
  const color = sportColor[court.type] ?? "#84cc16";

  return (
    <Card
      className="h-full flex flex-col transition-colors duration-200 group overflow-hidden"
      style={{ borderColor: hovered ? color : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {imgSrc ? (
        <div className="w-full h-48 overflow-hidden bg-muted relative">
          <img
            src={imgSrc}
            alt={court.name}
            loading="lazy"
            decoding="async"
            width={300}
            height={192}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(court.name)}&background=random&size=400`;
            }}
          />
          {court.isIndoor !== undefined && court.isIndoor !== null && (
            <div className="absolute top-2 right-2 flex gap-1 items-center">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                {court.isIndoor ? t("card.indoor") : t("card.outdoor")}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center">
          <SportIcon sport={court.type} size={40} style={{ color }} />
        </div>
      )}
    </Card>
  );
}

export default function Home() {
  const t = useT();
  const [heroIdx, setHeroIdx] = useState(0);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [tappedStat, setTappedStat] = useState<string | null>(null);
  const accentColor = "#84cc16";
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Stat-card backgrounds are small (~200px wide); use the 480w variants.
  const SPORT_IMAGES: Record<string, string> = {
    tennis: `${base}/courts/court_2_bernardinu-480.webp`,
    basketball: `${base}/courts/court_17_zalgiris-480.webp`,
    padel: `${base}/courts/padel/padel_court_indoor_1-480.webp`,
    football: `${base}/courts/football/football_futsal_court_2-480.webp`,
    badminton: `${base}/courts/badminton/badminton_court_indoor_1-480.webp`,
    squash: `${base}/courts/squash/squash_court_1-480.webp`,
    total: `${base}/courts/court_1_seb_arena-480.webp`,
  };

  const { data: stats, isLoading: statsLoading } = useGetStatsSummary({
    query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 },
  });
  const { data: popularCourts, isLoading: popularLoading } = useGetPopularCourts({
    query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 },
  });
  const { data: courts, isLoading: courtsLoading } = useListCourts(undefined, {
    query: { refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 },
  });
  const { data: favorites, isLoading: favLoading } = useGetFavoriteCourts();
  const { data: tournaments } = useGetTournaments();
  const allActive = true;
  const activeSports = new Set<string>();

  useEffect(() => {
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Layout>
      <section className="relative bg-zinc-950 text-white" style={{ minHeight: 280 }}>
        {HERO_IMAGES.map((img, i) => (
          <img
            key={img}
            src={`${base}/${img}.webp`}
            srcSet={`${base}/${img}-480.webp 480w, ${base}/${img}-800.webp 800w, ${base}/${img}.webp 1200w`}
            sizes="100vw"
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-zinc-950/70 z-[1]" />
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent z-[2]" />
        <div className="relative z-10 container mx-auto px-4 pt-12 pb-14">
          <div className="absolute bottom-6 right-6 z-20 flex gap-1.5 pointer-events-none">
            {HERO_IMAGES.map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                style={{ background: i === heroIdx ? accentColor : "rgba(255,255,255,0.35)", transform: i === heroIdx ? "scale(1.4)" : "scale(1)" }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
