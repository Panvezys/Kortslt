import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Trophy, TrendingUp } from "lucide-react";
import { SPORT_LABELS, SportIcon } from "@/components/sport-icon";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API = `${BASE}/api`;

interface UserRating {
  id: number;
  userId: string;
  sportSlug: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  tier: { name: string; color: string };
}

const TIER_CONFIG: Record<string, { gradient: string; textColor: string; bgColor: string; borderColor: string; label: string }> = {
  Diamond: {
    gradient: "linear-gradient(135deg, #22d3ee, #06b6d4)",
    textColor: "#06b6d4",
    bgColor: "rgba(34,211,238,0.1)",
    borderColor: "rgba(34,211,238,0.3)",
    label: "Deimantas",
  },
  Gold: {
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    textColor: "#f59e0b",
    bgColor: "rgba(251,191,36,0.1)",
    borderColor: "rgba(251,191,36,0.3)",
    label: "Auksas",
  },
  Silver: {
    gradient: "linear-gradient(135deg, #94a3b8, #64748b)",
    textColor: "#64748b",
    bgColor: "rgba(148,163,184,0.1)",
    borderColor: "rgba(148,163,184,0.3)",
    label: "Sidabras",
  },
  Bronze: {
    gradient: "linear-gradient(135deg, #cd7f32, #b45309)",
    textColor: "#b45309",
    bgColor: "rgba(205,127,50,0.1)",
    borderColor: "rgba(205,127,50,0.3)",
    label: "Bronza",
  },
};

function EloBar({ elo }: { elo: number }) {
  const pct = Math.min(100, Math.max(0, ((elo - 800) / (2000 - 800)) * 100));
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, #C5E041, #22d3ee)" }}
      />
    </div>
  );
}

function SportRatingItem({ r }: { r: UserRating }) {
  const tier = TIER_CONFIG[r.tier.name] ?? TIER_CONFIG.Bronze;
  const total = r.wins + r.losses + r.draws;
  const winRate = total > 0 ? Math.round((r.wins / total) * 100) : 0;

  return (
    <div
      className="rounded-xl p-3 border transition-all hover:shadow-md"
      style={{ borderColor: tier.borderColor, background: tier.bgColor }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SportIcon sport={r.sportSlug} size={18} style={{ color: tier.textColor }} />
          <div>
            <div className="text-sm font-semibold leading-tight">{SPORT_LABELS[r.sportSlug] ?? r.sportSlug}</div>
            <div className="text-xs" style={{ color: tier.textColor }}>{tier.label}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: tier.textColor }}>{r.elo}</div>
          <div className="text-xs text-muted-foreground">ELO</div>
        </div>
      </div>
      <EloBar elo={r.elo} />
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="text-green-500 font-semibold">{r.wins}V</span>
        <span className="text-red-400 font-semibold">{r.losses}P</span>
        <span className="text-slate-400 font-semibold">{r.draws}L</span>
        {total > 0 && <span className="ml-auto">{winRate}% laimėjimų</span>}
      </div>
    </div>
  );
}

interface SkillCardProps {
  userId: string;
  className?: string;
}

export function SkillCard({ userId, className }: SkillCardProps) {
  const { data: ratings, isLoading } = useQuery<UserRating[]>({
    queryKey: ["user-ratings", userId],
    queryFn: () => customFetch<UserRating[]>(`${API}/user-ratings/${userId}`),
    staleTime: 60_000,
  });

  const sorted = [...(ratings ?? [])].sort((a, b) => b.elo - a.elo);
  const totalGames = sorted.reduce((s, r) => s + r.wins + r.losses + r.draws, 0);
  const topTier = sorted[0]?.tier.name ?? "Bronze";
  const topConfig = TIER_CONFIG[topTier] ?? TIER_CONFIG.Bronze;

  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden ${className ?? ""}`}>
      {/* Header */}
      <div className="p-5 pb-4" style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold text-white">Įgūdžių kortelė</h3>
        </div>

        {sorted.length > 0 ? (
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: topConfig.borderColor, background: topConfig.bgColor }}
            >
              <SportIcon sport={sorted[0].sportSlug} size={28} style={{ color: topConfig.textColor }} />
            </div>
            <div>
              <div className="text-white font-bold text-lg">{sorted[0].elo} ELO</div>
              <div className="text-xs" style={{ color: topConfig.textColor }}>{topConfig.label} · {SPORT_LABELS[sorted[0].sportSlug] ?? sorted[0].sportSlug}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-white/60 text-xs">{totalGames} žaidimų</div>
              <div className="text-white/60 text-xs">{sorted.length} sport{sorted.length === 1 ? "o" : "ų"}</div>
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm">Dar nedalyvavo reitinginiuose žaidimuose.</p>
        )}
      </div>

      {/* Ratings grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Dalyvaukite reitinginiuose žaidimuose, kad užsitarnautumėte ELO taškus.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(r => <SportRatingItem key={r.sportSlug} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
