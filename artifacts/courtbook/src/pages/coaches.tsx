import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { useListCourts, useListCities } from "@workspace/api-client-react";
import { CourtCard } from "@/components/court-card";
import { CourtMap } from "@/components/court-map";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Search, Map, List, SlidersHorizontal, X, ChevronLeft, ChevronRight, MapPin, Navigation } from "lucide-react";
import { ListCourtsType } from "@workspace/api-client-react";
import { useT } from "@/lib/i18n";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { useFavoritesContext } from "@/lib/FavoritesContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const HERO_IMAGES = [
  "coaches/coach_banner_1.png",
  "coaches/coach_banner_2_small.png",
  "coaches/coach_banner_3.png",
  "coaches/coach_banner_4.png",
  "coaches/coach_banner_5.png",
  "coaches/coach_banner_6.png",
];

const ALL_SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];
const sportLT: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
};

export default function Coaches() {
  const t = useT();
  const searchStr = useSearch();
  const _qp = new URLSearchParams(searchStr.replace(/^\?/, ""));
  const initialType = (_qp.get("type") as ListCourtsType | null) ?? null;
  const initialCity = _qp.get("city") ?? "";

  const [search, setSearch] = useState("");
  const [selectedCities, setSelectedCities] = useState<Set<string>>(initialCity ? new Set([initialCity]) : new Set());
  const [surface, setSurface] = useState<string>("all");
  const [isIndoorFilter, setIsIndoorFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc" | "rating_desc" | "favorites_first">("default");
  const { favoriteIds } = useFavoritesContext();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setBgIdx(i => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const [page, setPage] = useState(1);
  const [activeSports, setActiveSports] = useState<Set<string>>(
    initialType && ALL_SPORTS.includes(initialType) ? new Set([initialType]) : new Set(ALL_SPORTS)
  );

  const toggleSport = (sport: string) => {
    setActiveSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport); else next.add(sport);
      return next;
    });
  };

  const toggleCity = (c: string) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const allSportsActive = activeSports.size === ALL_SPORTS.length;

  const { data: cities } = useListCities();
  const querySurface = surface === "all" ? undefined : surface;
  const queryIsIndoor = isIndoorFilter === "all" ? undefined : isIndoorFilter === "indoor";
  const { data: courts, isLoading } = useListCourts({ surface: querySurface, isIndoor: queryIsIndoor, maxPrice });

  const cityCounts = (courts ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.city] = (acc[c.city] ?? 0) + 1;
    return acc;
  }, {});
  const sortedCities = (cities ?? []).slice().sort((a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0));

  const filteredCourts = courts?.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase());
    const matchesCity = selectedCities.size === 0 || selectedCities.has(c.city);
    return matchesSearch && matchesCity;
  });

  const sortedCourts = filteredCourts ? [...filteredCourts]
    .filter(c => activeSports.has(c.type))
    .sort((a, b) => {
      if (sortBy === "favorites_first") {
        const aFav = favoriteIds.has(a.id) ? 0 : 1;
        const bFav = favoriteIds.has(b.id) ? 0 : 1;
        return aFav - bFav;
      }
      if (sortBy === "rating_desc") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "price_asc") return a.pricePerHour - b.pricePerHour;
      if (sortBy === "price_desc") return b.pricePerHour - a.pricePerHour;
      return 0;
    }) : filteredCourts;

  const heroImages = HERO_IMAGES;

  return (
    <Layout>
      <div className="relative overflow-hidden border-b" style={{ minHeight: "180px" }}>
        {heroImages.map((img, i) => (
          <div
            key={img}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${BASE}/${img})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === bgIdx ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />
        <div className="relative z-10 container mx-auto px-4 py-10 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 drop-shadow-md text-[#C5E041] bg-[transparent]">{t("courts.title")}</h1>
          <p className="text-white/80 max-w-2xl text-sm md:text-base leading-relaxed drop-shadow">{t("courts.subtitle")}</p>
        </div>
      </div>
    </Layout>
  );
}
