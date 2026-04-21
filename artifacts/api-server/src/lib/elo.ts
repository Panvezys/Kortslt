/**
 * ELO rating calculations — K-factor 32, standard formula
 */

export const ELO_K = 32;
export const ELO_DEFAULT = 1200;

/**
 * Probability of player A winning against player B
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ELO for two individual players.
 * score: 1 = A won, 0 = A lost, 0.5 = draw
 */
export function calculateElo(
  ratingA: number,
  ratingB: number,
  score: 1 | 0 | 0.5,
): { newA: number; newB: number; deltaA: number; deltaB: number } {
  const eA = expectedScore(ratingA, ratingB);
  const eB = expectedScore(ratingB, ratingA);
  const actualA = score;
  const actualB = 1 - score;
  const deltaA = Math.round(ELO_K * (actualA - eA));
  const deltaB = Math.round(ELO_K * (actualB - eB));
  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}

/**
 * Calculate ELO changes for team-based games.
 * Uses average ELO of each team, then distributes delta equally among members.
 * winner: 'A' | 'B' | 'draw'
 */
export function calculateTeamElo(
  teamA: { userId: string; elo: number }[],
  teamB: { userId: string; elo: number }[],
  winner: "A" | "B" | "draw",
): { userId: string; oldElo: number; newElo: number; delta: number }[] {
  if (teamA.length === 0 || teamB.length === 0) return [];

  const avgA = teamA.reduce((s, p) => s + p.elo, 0) / teamA.length;
  const avgB = teamB.reduce((s, p) => s + p.elo, 0) / teamB.length;

  const score: 1 | 0 | 0.5 = winner === "A" ? 1 : winner === "B" ? 0 : 0.5;
  const { deltaA, deltaB } = calculateElo(avgA, avgB, score);

  const result: { userId: string; oldElo: number; newElo: number; delta: number }[] = [];

  for (const p of teamA) {
    result.push({ userId: p.userId, oldElo: p.elo, newElo: p.elo + deltaA, delta: deltaA });
  }
  for (const p of teamB) {
    result.push({ userId: p.userId, oldElo: p.elo, newElo: p.elo + deltaB, delta: deltaB });
  }

  return result;
}

/**
 * Tier name from ELO
 */
export function eloTier(elo: number): { name: string; color: string; min: number; max: number } {
  if (elo >= 1600) return { name: "Diamond", color: "#67e8f9", min: 1600, max: Infinity };
  if (elo >= 1400) return { name: "Gold", color: "#fbbf24", min: 1400, max: 1599 };
  if (elo >= 1200) return { name: "Silver", color: "#94a3b8", min: 1200, max: 1399 };
  return { name: "Bronze", color: "#cd7f32", min: 0, max: 1199 };
}
