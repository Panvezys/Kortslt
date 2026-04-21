export type TierName = "Bronze" | "Silver" | "Gold" | "Diamond";

export interface TierInfo {
  name: TierName;
  cls: string;
  bgCls: string;
  emoji: string;
  minElo: number;
}

export const TIERS: TierInfo[] = [
  { name: "Diamond", cls: "text-cyan-400 border-cyan-400/30", bgCls: "bg-cyan-500/15", emoji: "💎", minElo: 1600 },
  { name: "Gold",    cls: "text-yellow-500 border-yellow-400/30", bgCls: "bg-yellow-500/15", emoji: "🥇", minElo: 1400 },
  { name: "Silver",  cls: "text-slate-400 border-slate-300/30", bgCls: "bg-slate-400/15", emoji: "🥈", minElo: 1200 },
  { name: "Bronze",  cls: "text-orange-600 border-orange-500/30", bgCls: "bg-orange-700/15", emoji: "🥉", minElo: 0 },
];

export const SPORT_EMOJIS: Record<string, string> = {
  tennis: "🎾", basketball: "🏀", padel: "🏸", football: "⚽",
  badminton: "🏸", squash: "🎾", table_tennis: "🏓", "table-tennis": "🏓",
  golf: "⛳", snooker: "🎱", bowling: "🎳", volleyball: "🏐",
  hockey: "🏒", futsal: "⚽", floorball: "🏑", "beach-volleyball": "🏐",
  pickleball: "🏸",
};

export function getTier(elo: number): TierInfo {
  return TIERS.find(t => elo >= t.minElo) ?? TIERS[TIERS.length - 1];
}

export function getSportEmoji(sport: string): string {
  return SPORT_EMOJIS[sport] ?? "🏅";
}

export function getRankLabel(sport: string, elo: number): string {
  const tier = getTier(elo);
  const emoji = getSportEmoji(sport);
  return `${emoji} ${tier.name} ${elo}`;
}
