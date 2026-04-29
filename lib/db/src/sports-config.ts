/**
 * Sports configuration — single source of truth for scoring rules and team sizes.
 * Both API server and web client import this from `@workspace/db`.
 *
 * Adding a new sport: append one entry here and the entire UI + bracket engine adapts.
 */

export type ScoringType = "SET_BASED" | "POINT_BASED";

export interface SportConfig {
  /** Stable id used in DB rows (matches `tournaments.sport`, `games.sport`). */
  id: string;
  /** UI label (Lithuanian). */
  label: string;
  /** Scoring discipline. */
  scoringType: ScoringType;
  /** Default players per team. */
  teamSize: number;
  /** Default number of teams competing in a single match (almost always 2). */
  teamsPerMatch: number;
  /** SET_BASED: typical sets per match (best-of). POINT_BASED: ignored. */
  setsPerMatch?: number;
  /** SET_BASED: minimum points to win a set without tiebreak. */
  setTarget?: number;
  /** SET_BASED: maximum points in a tiebreak set (e.g. tennis 7-6). */
  setMaxWithTiebreak?: number;
  /** POINT_BASED: optional cap (e.g. badminton-to-21). */
  pointCap?: number;
}

export const SPORTS_CONFIG: Record<string, SportConfig> = {
  tennis: {
    id: "tennis",
    label: "Tenisas",
    scoringType: "SET_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
    setsPerMatch: 3,
    setTarget: 6,
    setMaxWithTiebreak: 7,
  },
  padel: {
    id: "padel",
    label: "Padelis",
    scoringType: "SET_BASED",
    teamSize: 2,
    teamsPerMatch: 2,
    setsPerMatch: 3,
    setTarget: 6,
    setMaxWithTiebreak: 7,
  },
  squash: {
    id: "squash",
    label: "Skvošas",
    scoringType: "SET_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
    setsPerMatch: 5,
    setTarget: 11,
  },
  table_tennis: {
    id: "table_tennis",
    label: "Stalo tenisas",
    scoringType: "SET_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
    setsPerMatch: 5,
    setTarget: 11,
  },
  badminton: {
    id: "badminton",
    label: "Badmintonas",
    scoringType: "SET_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
    setsPerMatch: 3,
    setTarget: 21,
  },
  basketball: {
    id: "basketball",
    label: "Krepšinis",
    scoringType: "POINT_BASED",
    teamSize: 5,
    teamsPerMatch: 2,
  },
  football: {
    id: "football",
    label: "Futbolas",
    scoringType: "POINT_BASED",
    teamSize: 5,
    teamsPerMatch: 2,
  },
  golf: {
    id: "golf",
    label: "Golfas",
    scoringType: "POINT_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
  },
  snooker: {
    id: "snooker",
    label: "Snukeris",
    scoringType: "POINT_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
  },
  bowling: {
    id: "bowling",
    label: "Boulingas",
    scoringType: "POINT_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
  },
};

export function getSportConfig(sport: string | null | undefined): SportConfig {
  if (sport && SPORTS_CONFIG[sport]) return SPORTS_CONFIG[sport];
  // Safe fallback: behave like a generic point-based sport.
  return {
    id: sport ?? "unknown",
    label: sport ?? "Sportas",
    scoringType: "POINT_BASED",
    teamSize: 1,
    teamsPerMatch: 2,
  };
}

// --- Score data shapes -----------------------------------------------------

export interface SetScore {
  /** Points won by side A in this set. */
  a: number;
  /** Points won by side B in this set. */
  b: number;
}

/** Discriminated union — what gets stored in JSONB and posted to the API. */
export type SportScore =
  | { type: "SET_BASED"; sets: SetScore[] }
  | { type: "POINT_BASED"; a: number; b: number };

export interface ScoreValidationError {
  field: string;
  message: string;
}

/** Validate a structured score against the sport rules. Returns [] if valid. */
export function validateScore(score: SportScore, cfg: SportConfig): ScoreValidationError[] {
  const errors: ScoreValidationError[] = [];
  if (cfg.scoringType === "SET_BASED") {
    if (score.type !== "SET_BASED") {
      return [{ field: "type", message: "Šiam sportui reikia rinkinių (sets) tipo rezultato." }];
    }
    const playedSets = score.sets.filter((s) => s.a > 0 || s.b > 0);
    if (playedSets.length === 0) {
      return [{ field: "sets", message: "Įveskite bent vieno seto rezultatą." }];
    }
    const target = cfg.setTarget ?? 6;
    const max = cfg.setMaxWithTiebreak ?? target + 1;
    playedSets.forEach((s, i) => {
      if (s.a < 0 || s.b < 0) {
        errors.push({ field: `set.${i}`, message: `Setas ${i + 1}: neigiamas rezultatas.` });
      }
      const high = Math.max(s.a, s.b);
      const low = Math.min(s.a, s.b);
      if (high < target) {
        errors.push({ field: `set.${i}`, message: `Setas ${i + 1}: laimėtojas turi pasiekti bent ${target}.` });
      }
      if (high > max) {
        errors.push({ field: `set.${i}`, message: `Setas ${i + 1}: maksimalus rezultatas ${max}.` });
      }
      if (high === low) {
        errors.push({ field: `set.${i}`, message: `Setas ${i + 1}: lygiosios negalimos.` });
      }
    });
  } else {
    if (score.type !== "POINT_BASED") {
      return [{ field: "type", message: "Šiam sportui reikia bendro taško tipo rezultato." }];
    }
    if (score.a < 0 || score.b < 0) errors.push({ field: "score", message: "Rezultatas negali būti neigiamas." });
    if (score.a === score.b) errors.push({ field: "score", message: "Lygiosios negalimos – nustatykite nugalėtoją." });
    if (cfg.pointCap && (score.a > cfg.pointCap || score.b > cfg.pointCap)) {
      errors.push({ field: "score", message: `Maksimalus taškas: ${cfg.pointCap}.` });
    }
  }
  return errors;
}

/** Determine winner side from a structured score. Returns "a" | "b" | null if unable. */
export function deriveWinner(score: SportScore, cfg: SportConfig): "a" | "b" | null {
  if (cfg.scoringType === "SET_BASED" && score.type === "SET_BASED") {
    let setsA = 0;
    let setsB = 0;
    for (const s of score.sets) {
      if (s.a > s.b) setsA++;
      else if (s.b > s.a) setsB++;
    }
    if (setsA === setsB) return null;
    return setsA > setsB ? "a" : "b";
  }
  if (cfg.scoringType === "POINT_BASED" && score.type === "POINT_BASED") {
    if (score.a === score.b) return null;
    return score.a > score.b ? "a" : "b";
  }
  return null;
}

/** Render a structured score as a compact human-readable string. */
export function formatScore(score: SportScore | null | undefined): string {
  if (!score) return "";
  if (score.type === "SET_BASED") {
    return score.sets
      .filter((s) => s.a > 0 || s.b > 0)
      .map((s) => `${s.a}-${s.b}`)
      .join(", ");
  }
  return `${score.a}-${score.b}`;
}

/** Total points won across a structured score (for standings). */
export function pointsWonFromScore(score: SportScore | null | undefined): { a: number; b: number } {
  if (!score) return { a: 0, b: 0 };
  if (score.type === "SET_BASED") {
    return score.sets.reduce(
      (acc, s) => ({ a: acc.a + s.a, b: acc.b + s.b }),
      { a: 0, b: 0 },
    );
  }
  return { a: score.a, b: score.b };
}

/** Sets won across a SET_BASED score. */
export function setsWonFromScore(score: SportScore | null | undefined): { a: number; b: number } {
  if (!score || score.type !== "SET_BASED") return { a: 0, b: 0 };
  let a = 0;
  let b = 0;
  for (const s of score.sets) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}
