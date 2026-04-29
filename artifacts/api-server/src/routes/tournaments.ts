import { Router, type IRouter, type Request } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  tournamentRegistrationsTable,
  courtsTable,
  facilitiesTable,
  courtBlockedSlotsTable,
} from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner, requireOwner, requireCreator } from "../lib/auth";
import { sendNotification } from "../lib/notify";
import {
  type SportScore,
  type SportConfig,
  getSportConfig,
  validateScore,
  deriveWinner,
  setsWonFromScore,
  pointsWonFromScore,
} from "@workspace/db";

const router: IRouter = Router();

type TournamentRow = typeof tournamentsTable.$inferSelect;

// --- Bracket type model ------------------------------------------------------

interface BracketPlayer { regId: number; name: string }
interface BracketMatch {
  matchId: string;
  round: number;
  /** Optional group id ("A", "B", ...) when the match is part of a round-robin/hybrid group. */
  groupId?: string;
  p1: BracketPlayer | null;
  p2: BracketPlayer | null;
  winner: BracketPlayer | null;
  /**
   * Structured sport-typed score (preferred). Legacy rows may have a plain string.
   * Reads must tolerate both shapes.
   */
  score: SportScore | string | null;
  /** Where to send the winner in a knockout. Null in round-robin matches and finals. */
  nextMatchId: string | null;
}

interface RoundRobinGroup {
  groupId: string;
  players: BracketPlayer[];
  matches: BracketMatch[];
}

interface SingleEliminationData {
  format: "single_elimination";
  generatedAt: string;
  rounds: Array<{ round: number; matches: BracketMatch[] }>;
}

interface RoundRobinData {
  format: "round_robin";
  generatedAt: string;
  groupSize: number;
  groups: RoundRobinGroup[];
}

interface HybridData {
  format: "hybrid";
  generatedAt: string;
  groupSize: number;
  groups: RoundRobinGroup[];
  /** Playoffs are auto-seeded once all group matches are completed. */
  playoffs: { rounds: Array<{ round: number; matches: BracketMatch[] }> } | null;
  /** Number of teams advancing per group to playoffs (default 2). */
  advancePerGroup: number;
}

type BracketData = SingleEliminationData | RoundRobinData | HybridData;

interface StandingsRow {
  regId: number;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsDiff: number;
  pointsDiff: number;
  /** Composite ranking points (3 per win, 1 per draw — draws disallowed currently). */
  rankPoints: number;
}

function formatTournament(t: TournamentRow, registrationCount?: number) {
  // Always expose the multi-court list (falls back to legacy single-court id)
  const courtIds =
    Array.isArray(t.courtIds) && t.courtIds.length > 0
      ? t.courtIds
      : t.courtId != null
        ? [t.courtId]
        : [];
  return {
    ...t,
    courtId: t.courtId ?? courtIds[0] ?? null,
    courtIds,
    organizerId: t.organizerId ?? t.ownerUserId,
    entryFee: t.entryFee != null ? Number(t.entryFee) : null,
    description: t.description ?? null,
    registrationDeadline: t.registrationDeadline ?? null,
    prizeInfo: t.prizeInfo ?? null,
    coverPhotoUrl: t.coverPhotoUrl ?? null,
    facilityId: t.facilityId ?? null,
    approvalStatus: t.approvalStatus ?? "approved",
    approvalMessage: t.approvalMessage ?? null,
    bracketData: (t.bracketData as BracketData | null) ?? null,
    featuredUntil: t.featuredUntil ? t.featuredUntil.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    registrationCount: registrationCount ?? 0,
  };
}

function formatReg(r: typeof tournamentRegistrationsTable.$inferSelect) {
  return {
    ...r,
    playerPhone: r.playerPhone ?? null,
    userId: r.userId ?? null,
    registeredAt: r.registeredAt.toISOString(),
  };
}

// --- Bracket helpers ---------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a "seeded" bracket slot order so that top seeds are spread across the bracket
 * (1 vs N, 2 vs N-1, top seeds in opposite halves). For N=4 → [1,4,2,3]; N=8 → [1,8,4,5,2,7,3,6].
 */
function seededBracketOrder(n: number): number[] {
  let order: number[] = [1, 2];
  while (order.length < n) {
    const doubled = order.length * 2;
    const expanded: number[] = [];
    for (const s of order) {
      expanded.push(s);
      expanded.push(doubled + 1 - s);
    }
    order = expanded;
  }
  return order;
}

function buildSingleElimRounds(padded: (BracketPlayer | null)[]): SingleEliminationData {
  const slots = padded.length;
  const totalRounds = Math.log2(slots);
  const rounds: SingleEliminationData["rounds"] = [];
  let perRound = slots / 2;
  for (let r = 1; r <= totalRounds; r++) {
    const matches: BracketMatch[] = [];
    for (let i = 0; i < perRound; i++) {
      matches.push({
        matchId: `r${r}-m${i + 1}`,
        round: r,
        p1: null,
        p2: null,
        winner: null,
        score: null,
        nextMatchId: r < totalRounds ? `r${r + 1}-m${Math.floor(i / 2) + 1}` : null,
      });
    }
    rounds.push({ round: r, matches });
    perRound = perRound / 2;
  }
  for (let i = 0; i < slots / 2; i++) {
    rounds[0].matches[i].p1 = padded[i * 2];
    rounds[0].matches[i].p2 = padded[i * 2 + 1];
  }
  // Cascade BYE auto-wins forward
  for (let r = 0; r < rounds.length; r++) {
    for (let i = 0; i < rounds[r].matches.length; i++) {
      const m = rounds[r].matches[i];
      if (m.p1 && !m.p2) m.winner = m.p1;
      else if (!m.p1 && m.p2) m.winner = m.p2;
      if (m.winner && m.nextMatchId) {
        const next = rounds[r + 1]?.matches.find((x) => x.matchId === m.nextMatchId);
        if (next) {
          if (i % 2 === 0) next.p1 = m.winner;
          else next.p2 = m.winner;
        }
      }
    }
  }
  return { format: "single_elimination", generatedAt: new Date().toISOString(), rounds };
}

/**
 * Build a deterministic seeded single-elim bracket. Players are interpreted as already ranked
 * (index 0 = top seed). BYEs (null padding) are placed against the highest seeds.
 */
function generateSeededSingleElim(seeds: BracketPlayer[]): SingleEliminationData | null {
  const valid = seeds.filter((p) => p && p.name);
  if (valid.length < 2) return null;
  const slotCount = Math.pow(2, Math.ceil(Math.log2(valid.length)));
  const order = seededBracketOrder(slotCount);
  const padded: (BracketPlayer | null)[] = order.map((rank) => valid[rank - 1] ?? null);
  return buildSingleElimRounds(padded);
}

function generateSingleEliminationBracket(players: BracketPlayer[]): SingleEliminationData | null {
  const valid = players.filter((p) => p && p.name);
  if (valid.length < 2) return null;

  const shuffled = shuffle(valid);
  const slots = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
  const padded: (BracketPlayer | null)[] = [...shuffled];
  while (padded.length < slots) padded.push(null);

  const totalRounds = Math.log2(slots);
  const rounds: SingleEliminationData["rounds"] = [];
  let perRound = slots / 2;
  for (let r = 1; r <= totalRounds; r++) {
    const matches: BracketMatch[] = [];
    for (let i = 0; i < perRound; i++) {
      matches.push({
        matchId: `r${r}-m${i + 1}`,
        round: r,
        p1: null,
        p2: null,
        winner: null,
        score: null,
        nextMatchId: r < totalRounds ? `r${r + 1}-m${Math.floor(i / 2) + 1}` : null,
      });
    }
    rounds.push({ round: r, matches });
    perRound = perRound / 2;
  }

  for (let i = 0; i < slots / 2; i++) {
    rounds[0].matches[i].p1 = padded[i * 2];
    rounds[0].matches[i].p2 = padded[i * 2 + 1];
  }

  // Cascade BYE auto-wins forward
  for (let r = 0; r < rounds.length; r++) {
    for (let i = 0; i < rounds[r].matches.length; i++) {
      const m = rounds[r].matches[i];
      if (m.p1 && !m.p2) m.winner = m.p1;
      else if (!m.p1 && m.p2) m.winner = m.p2;
      if (m.winner && m.nextMatchId) {
        const next = rounds[r + 1]?.matches.find((x) => x.matchId === m.nextMatchId);
        if (next) {
          if (i % 2 === 0) next.p1 = m.winner;
          else next.p2 = m.winner;
        }
      }
    }
  }

  return {
    format: "single_elimination",
    generatedAt: new Date().toISOString(),
    rounds,
  };
}

/** Distribute players into groups of approximately `groupSize`. Last group may be smaller. */
function partitionGroups(players: BracketPlayer[], groupSize = 4): BracketPlayer[][] {
  const shuffled = shuffle(players);
  const groupCount = Math.max(1, Math.ceil(shuffled.length / groupSize));
  // Snake distribution to keep group sizes balanced rather than dumping leftovers in the last group.
  const groups: BracketPlayer[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((p, i) => groups[i % groupCount].push(p));
  return groups;
}

function buildGroupMatches(groupId: string, players: BracketPlayer[]): BracketMatch[] {
  const matches: BracketMatch[] = [];
  let idx = 1;
  // Round-robin: each pair plays once.
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        matchId: `g${groupId}-m${idx++}`,
        round: 1,
        groupId,
        p1: players[i],
        p2: players[j],
        winner: null,
        score: null,
        nextMatchId: null,
      });
    }
  }
  return matches;
}

function generateRoundRobin(players: BracketPlayer[], groupSize = 4): RoundRobinData | null {
  const valid = players.filter((p) => p && p.name);
  if (valid.length < 2) return null;
  const partitions = partitionGroups(valid, groupSize);
  const groups: RoundRobinGroup[] = partitions.map((ps, i) => {
    const groupId = String.fromCharCode(65 + i); // A, B, C, ...
    return {
      groupId,
      players: ps,
      matches: buildGroupMatches(groupId, ps),
    };
  });
  return { format: "round_robin", generatedAt: new Date().toISOString(), groupSize, groups };
}

function generateHybrid(players: BracketPlayer[], groupSize = 4, advancePerGroup = 2): HybridData | null {
  const rr = generateRoundRobin(players, groupSize);
  if (!rr) return null;
  return {
    format: "hybrid",
    generatedAt: rr.generatedAt,
    groupSize: rr.groupSize,
    groups: rr.groups,
    playoffs: null,
    advancePerGroup,
  };
}

/** Compute standings for a single round-robin group. */
function computeGroupStandings(group: RoundRobinGroup): StandingsRow[] {
  const rows: Record<number, StandingsRow> = {};
  for (const p of group.players) {
    rows[p.regId] = {
      regId: p.regId,
      name: p.name,
      played: 0,
      won: 0,
      lost: 0,
      setsDiff: 0,
      pointsDiff: 0,
      rankPoints: 0,
    };
  }
  // Track head-to-head: h2h[a][b] = 1 if a beat b in their direct match, else absent.
  const h2h: Record<number, Record<number, number>> = {};
  for (const m of group.matches) {
    if (!m.winner || !m.p1 || !m.p2) continue;
    const a = rows[m.p1.regId];
    const b = rows[m.p2.regId];
    if (!a || !b) continue;
    a.played++;
    b.played++;
    const winnerIsA = m.winner.regId === m.p1.regId;
    if (winnerIsA) {
      a.won++; b.lost++;
      a.rankPoints += 3;
      (h2h[m.p1.regId] ??= {})[m.p2.regId] = 1;
    } else {
      b.won++; a.lost++;
      b.rankPoints += 3;
      (h2h[m.p2.regId] ??= {})[m.p1.regId] = 1;
    }
    // Score-based diffs (only when score is structured)
    if (m.score && typeof m.score === "object") {
      const pts = pointsWonFromScore(m.score);
      const sets = setsWonFromScore(m.score);
      a.pointsDiff += pts.a - pts.b;
      b.pointsDiff += pts.b - pts.a;
      a.setsDiff += sets.a - sets.b;
      b.setsDiff += sets.b - sets.a;
    }
  }
  return Object.values(rows).sort((x, y) => {
    if (y.rankPoints !== x.rankPoints) return y.rankPoints - x.rankPoints;
    // Head-to-head when two teams are tied on rank points
    const xBeatY = h2h[x.regId]?.[y.regId] === 1;
    const yBeatX = h2h[y.regId]?.[x.regId] === 1;
    if (xBeatY && !yBeatX) return -1;
    if (yBeatX && !xBeatY) return 1;
    if (y.setsDiff !== x.setsDiff) return y.setsDiff - x.setsDiff;
    if (y.pointsDiff !== x.pointsDiff) return y.pointsDiff - x.pointsDiff;
    return x.name.localeCompare(y.name);
  });
}

function allGroupMatchesComplete(groups: RoundRobinGroup[]): boolean {
  return groups.every((g) => g.matches.every((m) => m.winner != null));
}

/** Build the playoff bracket for hybrid: top N of each group advance, cross-seeded. */
function seedHybridPlayoffs(groups: RoundRobinGroup[], advancePerGroup: number): HybridData["playoffs"] {
  const seedsPerGroup = groups.map((g) => computeGroupStandings(g).slice(0, advancePerGroup));
  // Cross-seed: G1.1 vs G2.2, G2.1 vs G1.2, etc. For >2 groups we just chain pairs.
  const seeds: BracketPlayer[] = [];
  // Walk by seed-rank then by group, alternating across groups so #1 and #2 of the same group end up in opposite halves.
  for (let rank = 0; rank < advancePerGroup; rank++) {
    groups.forEach((_, gi) => {
      const row = seedsPerGroup[gi]?.[rank];
      if (row) seeds.push({ regId: row.regId, name: row.name });
    });
  }
  if (seeds.length < 2) return null;
  // Deterministic seeded bracket so cross-group seeding is preserved (G1.1 vs G2.2 etc.).
  const bracket = generateSeededSingleElim(seeds);
  if (!bracket) return null;
  // Re-key match ids so they don't collide with group match ids.
  const playoffs = {
    rounds: bracket.rounds.map((r) => ({
      round: r.round,
      matches: r.matches.map((m) => ({
        ...m,
        matchId: `p-${m.matchId}`,
        nextMatchId: m.nextMatchId ? `p-${m.nextMatchId}` : null,
      })),
    })),
  };
  return playoffs;
}

function applyMatchResult(
  bracket: BracketData,
  matchId: string,
  winnerRegId: number,
  score: SportScore | string | null,
  sportCfg: SportConfig,
): { ok: true; nextMatchId: string | null; nextOpponent: BracketPlayer | null } | { ok: false; error: string } {
  // Helper: locate a match in any of the supported structures.
  const locate = (): { match: BracketMatch; siblingIndex: number; rounds?: SingleEliminationData["rounds"] } | null => {
    if (bracket.format === "single_elimination") {
      for (let r = 0; r < bracket.rounds.length; r++) {
        const idx = bracket.rounds[r].matches.findIndex((m) => m.matchId === matchId);
        if (idx !== -1) return { match: bracket.rounds[r].matches[idx], siblingIndex: idx, rounds: bracket.rounds };
      }
      return null;
    }
    if (bracket.format === "round_robin") {
      for (const g of bracket.groups) {
        const m = g.matches.find((x) => x.matchId === matchId);
        if (m) return { match: m, siblingIndex: -1 };
      }
      return null;
    }
    // hybrid
    for (const g of bracket.groups) {
      const m = g.matches.find((x) => x.matchId === matchId);
      if (m) return { match: m, siblingIndex: -1 };
    }
    if (bracket.playoffs) {
      for (let r = 0; r < bracket.playoffs.rounds.length; r++) {
        const idx = bracket.playoffs.rounds[r].matches.findIndex((m) => m.matchId === matchId);
        if (idx !== -1) return { match: bracket.playoffs.rounds[r].matches[idx], siblingIndex: idx, rounds: bracket.playoffs.rounds };
      }
    }
    return null;
  };

  const found = locate();
  if (!found) return { ok: false, error: "Match not found in bracket" };
  const m = found.match;
  if (!m.p1 || !m.p2) return { ok: false, error: "Match cannot be scored until both players are decided" };

  // Validate score against sport config when structured
  let resolvedWinnerRegId = winnerRegId;
  if (score && typeof score === "object") {
    const errs = validateScore(score, sportCfg);
    if (errs.length > 0) return { ok: false, error: errs[0].message };
    const side = deriveWinner(score, sportCfg);
    if (!side) return { ok: false, error: "Lygiosios negalimos – nustatykite nugalėtoją." };
    resolvedWinnerRegId = side === "a" ? m.p1.regId : m.p2.regId;
  }

  const winner = m.p1.regId === resolvedWinnerRegId ? m.p1 : m.p2.regId === resolvedWinnerRegId ? m.p2 : null;
  if (!winner) return { ok: false, error: "Winner must be one of the match players" };

  m.winner = winner;
  m.score = score ?? null;

  let nextOpponent: BracketPlayer | null = null;
  // Knockout advancement (single_elim or hybrid playoffs)
  if (m.nextMatchId && found.rounds) {
    const idx = found.siblingIndex;
    const next = found.rounds.find((r) => r.matches.some((x) => x.matchId === m.nextMatchId))?.matches.find((x) => x.matchId === m.nextMatchId);
    if (next) {
      if (idx % 2 === 0) next.p1 = winner;
      else next.p2 = winner;
      nextOpponent = idx % 2 === 0 ? next.p2 : next.p1;
      if (next.p1 && !next.p2) next.winner = next.p1;
      else if (!next.p1 && next.p2) next.winner = next.p2;
    }
  }

  // Hybrid: when all group matches are complete, auto-seed the playoff bracket
  if (bracket.format === "hybrid" && !bracket.playoffs && allGroupMatchesComplete(bracket.groups)) {
    bracket.playoffs = seedHybridPlayoffs(bracket.groups, bracket.advancePerGroup);
  }

  return { ok: true, nextMatchId: m.nextMatchId, nextOpponent };
}

/** Top-level dispatch used by /generate-bracket. */
function generateBracket(format: string, players: BracketPlayer[]): BracketData | null {
  switch (format) {
    case "round_robin":
      return generateRoundRobin(players, 4);
    case "hybrid":
      return generateHybrid(players, 4, 2);
    case "single_elimination":
    default:
      return generateSingleEliminationBracket(players);
  }
}

/** Build a result_data snapshot with standings (round-robin/hybrid) for client convenience. */
function buildResultData(bracket: BracketData): unknown {
  if (bracket.format === "single_elimination") return null;
  const standings = bracket.groups.map((g) => ({
    groupId: g.groupId,
    rows: computeGroupStandings(g),
  }));
  if (bracket.format === "round_robin") {
    return { format: "round_robin", standings, updatedAt: new Date().toISOString() };
  }
  return {
    format: "hybrid",
    standings,
    playoffsSeeded: bracket.playoffs != null,
    updatedAt: new Date().toISOString(),
  };
}

function* eachDateInRange(startDate: string, endDate: string): Generator<string> {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

// --- Read endpoints ----------------------------------------------------------

// GET /tournaments — list, optionally ?sport=&status=&courtId=&featured=1&facilityId=&ownerUserId=&includePending=1
router.get("/tournaments", async (req, res): Promise<void> => {
  let rows = await db.select().from(tournamentsTable).orderBy(tournamentsTable.startDate);

  // Public callers only see approved tournaments. Owners/organizers can opt in to see pending via ?includePending=1
  // (we'll still gate sensitive details by the caller's identity in respond/generate endpoints).
  const userId = getCurrentUserId(req);
  const includePending = req.query.includePending === "1" || req.query.includePending === "true";
  if (!includePending || !userId) {
    // Unauthenticated callers (or callers who didn't opt in) see only approved.
    rows = rows.filter((r) => (r.approvalStatus ?? "approved") === "approved");
  } else {
    // Authenticated caller opting in: see approved + their own pending/rejected.
    rows = rows.filter(
      (r) => (r.approvalStatus ?? "approved") === "approved" || r.organizerId === userId || r.ownerUserId === userId,
    );
  }

  if (req.query.sport) rows = rows.filter((r) => r.sport === req.query.sport);
  if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
  if (req.query.courtId) {
    const cid = parseInt(req.query.courtId as string, 10);
    if (!isNaN(cid)) rows = rows.filter((r) => r.courtId === cid || (r.courtIds ?? []).includes(cid));
  }
  if (req.query.facilityId) {
    const fid = parseInt(req.query.facilityId as string, 10);
    if (!isNaN(fid)) rows = rows.filter((r) => r.facilityId === fid);
  }
  if (req.query.featured === "1" || req.query.featured === "true") {
    const now = new Date();
    rows = rows.filter((r) => r.isFeatured && r.featuredUntil && new Date(r.featuredUntil) > now);
  }
  if (req.query.ownerUserId) {
    rows = rows.filter((r) => r.ownerUserId === req.query.ownerUserId || r.organizerId === req.query.ownerUserId);
  }

  // Attach registration counts and facility-verification metadata
  const counts = await db
    .select({ tournamentId: tournamentRegistrationsTable.tournamentId, count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .groupBy(tournamentRegistrationsTable.tournamentId);
  const countMap = new Map(counts.map((c) => [c.tournamentId, Number(c.count)]));

  const facilityIds = Array.from(new Set(rows.map((r) => r.facilityId).filter((id): id is number => id != null)));
  const facilityMap = new Map<number, { name: string; city: string | null; verificationStatus: string }>();
  if (facilityIds.length) {
    const fs = await db
      .select({ id: facilitiesTable.id, name: facilitiesTable.name, city: facilitiesTable.city, verificationStatus: facilitiesTable.verificationStatus })
      .from(facilitiesTable)
      .where(inArray(facilitiesTable.id, facilityIds));
    for (const f of fs) facilityMap.set(f.id, { name: f.name, city: f.city ?? null, verificationStatus: f.verificationStatus ?? "" });
  }

  res.json(
    rows.map((r) => {
      const facMeta = r.facilityId != null ? facilityMap.get(r.facilityId) : undefined;
      return {
        ...formatTournament(r, countMap.get(r.id) ?? 0),
        facilityName: facMeta?.name ?? null,
        facilityCity: facMeta?.city ?? null,
        facilityVerified: facMeta?.verificationStatus === "active",
      };
    }),
  );
});

// GET /tournaments/:id — public; only approved tournaments visible to non-organizer/owner
router.get("/tournaments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }

  // Guard pending/rejected tournaments — only organizer or facility owner may see
  if ((t.approvalStatus ?? "approved") !== "approved") {
    const userId = getCurrentUserId(req);
    const isOrganizer = userId && (userId === t.organizerId || userId === t.ownerUserId);
    let isFacilityOwner = false;
    if (!isOrganizer && userId && t.facilityId) {
      const [fac] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, t.facilityId));
      if (fac) isFacilityOwner = await isOwner(req, fac.ownerUserId);
    }
    if (!isOrganizer && !isFacilityOwner) { res.status(404).json({ error: "Tournament not found" }); return; }
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id));

  let facilityName: string | null = null;
  let facilityCity: string | null = null;
  let facilityVerified = false;
  if (t.facilityId) {
    const [fac] = await db
      .select({ name: facilitiesTable.name, city: facilitiesTable.city, verificationStatus: facilitiesTable.verificationStatus })
      .from(facilitiesTable)
      .where(eq(facilitiesTable.id, t.facilityId));
    if (fac) {
      facilityName = fac.name;
      facilityCity = fac.city;
      facilityVerified = fac.verificationStatus === "active";
    }
  }

  res.json({
    ...formatTournament(t, Number(countRow?.count ?? 0)),
    facilityName,
    facilityCity,
    facilityVerified,
  });
});

// GET /tournaments/:id/bracket — public read of bracketData
router.get("/tournaments/:id/bracket", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [t] = await db.select({ bracketData: tournamentsTable.bracketData })
    .from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }
  // Frontend expects BracketData | null directly (not wrapped).
  res.json((t.bracketData as BracketData | null) ?? null);
});

// GET /courts/:id/tournaments — by court (matches courtId or courtIds[])
router.get("/courts/:id/tournaments", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id as string, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }
  const rows = await db.select().from(tournamentsTable);
  const filtered = rows.filter(
    (r) => (r.approvalStatus ?? "approved") === "approved" && (r.courtId === courtId || (r.courtIds ?? []).includes(courtId)),
  );
  res.json(filtered.map((r) => formatTournament(r)));
});

// --- Owner-side approval workflow -------------------------------------------

// GET /owner/tournament-requests — pending tournaments at facilities the caller owns
router.get("/owner/tournament-requests", requireOwner, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const ownedFacilities = await db
    .select({ id: facilitiesTable.id, name: facilitiesTable.name, city: facilitiesTable.city })
    .from(facilitiesTable)
    .where(eq(facilitiesTable.ownerUserId, userId));
  if (ownedFacilities.length === 0) { res.json([]); return; }
  const facilityIds = ownedFacilities.map((f) => f.id);
  const facilityMap = new Map(ownedFacilities.map((f) => [f.id, f]));

  const rows = await db
    .select()
    .from(tournamentsTable)
    .where(and(inArray(tournamentsTable.facilityId, facilityIds), eq(tournamentsTable.approvalStatus, "pending")))
    .orderBy(tournamentsTable.createdAt);

  res.json(
    rows.map((r) => ({
      ...formatTournament(r),
      facilityName: r.facilityId != null ? (facilityMap.get(r.facilityId)?.name ?? null) : null,
      facilityCity: r.facilityId != null ? (facilityMap.get(r.facilityId)?.city ?? null) : null,
    })),
  );
});

// POST /owner/respond-to-tournament — approve/reject a pending tournament hosted at owner's facility
router.post("/owner/respond-to-tournament", requireOwner, async (req, res): Promise<void> => {
  const { tournamentId, decision, message } = req.body ?? {};
  const id = Number(tournamentId);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "tournamentId required" }); return; }
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "decision must be 'approve' or 'reject'" }); return;
  }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }
  if ((t.approvalStatus ?? "approved") !== "pending") {
    res.status(409).json({ error: `Tournament already ${t.approvalStatus}` }); return;
  }
  if (t.facilityId == null) { res.status(400).json({ error: "Tournament has no facility — cannot route approval" }); return; }
  const [fac] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, t.facilityId));
  if (!fac) { res.status(404).json({ error: "Facility not found" }); return; }
  const canApprove = await isOwner(req, fac.ownerUserId);
  if (!canApprove) { res.status(403).json({ error: "Forbidden – not the facility owner" }); return; }

  if (decision === "approve") {
    // Atomic: only mark approved if we can also reserve every court×date slot.
    const courtIds = Array.isArray(t.courtIds) && t.courtIds.length ? t.courtIds : t.courtId != null ? [t.courtId] : [];
    const dates = [...eachDateInRange(t.startDate, t.endDate)];
    try {
      await db.transaction(async (tx) => {
        await tx.update(tournamentsTable).set({
          approvalStatus: "approved",
          approvalMessage: message ?? null,
          // Open registration immediately so the public can sign up
          status: "open",
        }).where(eq(tournamentsTable.id, id));

        if (courtIds.length && dates.length) {
          const blocks = courtIds.flatMap((cid) =>
            dates.map((date) => ({
              courtId: cid,
              date,
              startTime: "00:00",
              endTime: "23:59",
              reason: `Turnyras: ${t.name}`,
            })),
          );
          await tx.insert(courtBlockedSlotsTable).values(blocks);
        }
      });
    } catch (err) {
      req.log.error({ err }, "Failed to atomically approve tournament + block courts");
      res.status(500).json({ error: "Nepavyko patvirtinti turnyro – aikštelės užimtumo įrašymas nepavyko. Bandykite vėliau." });
      return;
    }

    if (t.organizerId) {
      await sendNotification(
        t.organizerId,
        "tournament_approved",
        "Turnyras patvirtintas",
        `Jūsų turnyras „${t.name}" buvo patvirtintas ir atidaryta registracija.`,
        `/tournaments/${id}`,
      ).catch(() => {});
    }
  } else {
    await db.update(tournamentsTable).set({
      approvalStatus: "rejected",
      approvalMessage: message ?? null,
    }).where(eq(tournamentsTable.id, id));
    if (t.organizerId) {
      await sendNotification(
        t.organizerId,
        "tournament_rejected",
        "Turnyras atmestas",
        `Jūsų turnyras „${t.name}" buvo atmestas.`,
        `/tournaments/${id}`,
      ).catch(() => {});
    }
  }

  res.json({ ok: true, status: decision === "approve" ? "approved" : "rejected" });
});

// --- Organizer-initiated request --------------------------------------------

// POST /tournaments/request — coach/owner requests to host a tournament at a third-party facility
router.post("/tournaments/request", requireCreator, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const {
    facilityId,
    courtIds,
    name,
    description,
    sport,
    startDate,
    endDate,
    registrationDeadline,
    maxParticipants,
    entryFee,
    prizeInfo,
    format,
    coverPhotoUrl,
    message,
  } = req.body ?? {};

  if (!facilityId || !Array.isArray(courtIds) || courtIds.length === 0 || !name || !sport || !startDate || !endDate) {
    res.status(400).json({
      error: "facilityId, courtIds[], name, sport, startDate, endDate are required",
    }); return;
  }
  const facId = Number(facilityId);
  const cleanCourtIds = courtIds.map(Number).filter((n) => Number.isFinite(n));
  if (!Number.isFinite(facId) || cleanCourtIds.length === 0) {
    res.status(400).json({ error: "facilityId and courtIds must be valid numbers" }); return;
  }

  const [fac] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, facId));
  if (!fac) { res.status(404).json({ error: "Facility not found" }); return; }
  if (fac.verificationStatus !== "active") {
    res.status(400).json({ error: "Facility is not verified" }); return;
  }

  const courts = await db.select().from(courtsTable).where(inArray(courtsTable.id, cleanCourtIds));
  if (courts.length !== cleanCourtIds.length) {
    res.status(400).json({ error: "One or more courts not found" }); return;
  }
  for (const c of courts) {
    if (c.facilityId !== facId) {
      res.status(400).json({ error: "All courts must belong to the chosen facility" }); return;
    }
  }

  // Owner of their own facility creating a tournament gets auto-approved
  const isFacilityOwner = await isOwner(req, fac.ownerUserId);
  const initialApproval = isFacilityOwner ? "approved" : "pending";
  const initialStatus = isFacilityOwner ? "open" : "draft";

  const [t] = await db.insert(tournamentsTable).values({
    courtId: cleanCourtIds[0],
    courtIds: cleanCourtIds,
    facilityId: facId,
    ownerUserId: userId,
    organizerId: userId,
    name,
    description: description ?? null,
    sport,
    coverPhotoUrl: coverPhotoUrl ?? null,
    startDate,
    endDate,
    registrationDeadline: registrationDeadline ?? null,
    maxParticipants: maxParticipants ?? 16,
    entryFee: entryFee != null ? String(entryFee) : null,
    prizeInfo: prizeInfo ?? null,
    status: initialStatus,
    approvalStatus: initialApproval,
    approvalMessage: message ?? null,
    format: format ?? "single_elimination",
  }).returning();

  // If self-approved, also block courts now. If court-blocking fails we roll the tournament back
  // to pending so the owner can retry rather than leaving an approved tournament with no held slots.
  if (isFacilityOwner) {
    const dates = [...eachDateInRange(startDate, endDate)];
    if (dates.length) {
      const blocks = cleanCourtIds.flatMap((cid) =>
        dates.map((date) => ({
          courtId: cid, date, startTime: "00:00", endTime: "23:59",
          reason: `Turnyras: ${name}`,
        })),
      );
      try {
        await db.insert(courtBlockedSlotsTable).values(blocks);
      } catch (err) {
        req.log.error({ err }, "Failed to insert blocked slots for self-approved tournament — rolling status back to pending");
        await db.update(tournamentsTable)
          .set({ status: "draft", approvalStatus: "pending" })
          .where(eq(tournamentsTable.id, t.id));
        res.status(500).json({ error: "Aikštelės užimtumo įrašymas nepavyko – turnyras paliktas laukti patvirtinimo." });
        return;
      }
    }
  } else {
    await sendNotification(
      fac.ownerUserId,
      "tournament_pending_review",
      "Naujas turnyro prašymas",
      `${name} — laukia jūsų patvirtinimo`,
      `/owner/tournaments`,
    ).catch(() => {});
  }

  res.status(201).json(formatTournament(t));
});

// --- Bracket endpoints -------------------------------------------------------

type LoadResult =
  | { ok: false; status: number; body: { error: string } }
  | { ok: true; tournament: typeof tournamentsTable.$inferSelect };

async function loadOrganizerEditableTournament(req: Request, id: number): Promise<LoadResult> {
  const userId = getCurrentUserId(req);
  if (!userId) return { ok: false, status: 401, body: { error: "Unauthorized" } };
  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) return { ok: false, status: 404, body: { error: "Tournament not found" } };
  // Organizer or facility owner (or admin via isOwner) may edit
  let canEdit = userId === t.organizerId || userId === t.ownerUserId;
  if (!canEdit && t.facilityId) {
    const [fac] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, t.facilityId));
    if (fac) canEdit = await isOwner(req, fac.ownerUserId);
  }
  if (!canEdit) return { ok: false, status: 403, body: { error: "Forbidden" } };
  return { ok: true, tournament: t };
}

// POST /tournaments/:id/generate-bracket — organizer-only bracket generation (single-elim / round-robin / hybrid)
router.post("/tournaments/:id/generate-bracket", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }
  const t = result.tournament;

  const regs = await db
    .select({ regId: tournamentRegistrationsTable.id, playerName: tournamentRegistrationsTable.playerName })
    .from(tournamentRegistrationsTable)
    .where(and(eq(tournamentRegistrationsTable.tournamentId, id), eq(tournamentRegistrationsTable.status, "confirmed")));

  const players = regs.map((r) => ({ regId: r.regId, name: r.playerName }));
  const bracket = generateBracket(t.format ?? "single_elimination", players);
  if (!bracket) {
    res.status(400).json({ error: "Reikia bent 2 patvirtintų dalyvių, kad būtų galima sugeneruoti tinklelį" });
    return;
  }

  const resultData = buildResultData(bracket);
  await db.update(tournamentsTable)
    .set({ bracketData: bracket, resultData: resultData ?? null })
    .where(eq(tournamentsTable.id, id));
  res.json({ ok: true, bracketData: bracket, resultData, tournamentName: t.name });
});

// POST /tournaments/:id/match-result — organizer-only score entry (sport-typed)
router.post("/tournaments/:id/match-result", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }
  const t = result.tournament;

  const { matchId, winnerRegId, score } = req.body ?? {};
  // For SET_BASED / POINT_BASED scores, winner can be derived; we still accept explicit winnerRegId for legacy callers.
  const winnerRegIdNum = winnerRegId == null ? NaN : (typeof winnerRegId === "number" ? winnerRegId : parseInt(String(winnerRegId), 10));
  if (typeof matchId !== "string") {
    res.status(400).json({ error: "matchId yra privalomas" }); return;
  }
  // Either a structured score (preferred) or an explicit winnerRegId is required.
  const hasStructuredScore = score && typeof score === "object" && (score.type === "SET_BASED" || score.type === "POINT_BASED");
  if (!hasStructuredScore && isNaN(winnerRegIdNum)) {
    res.status(400).json({ error: "Reikia rezultato arba laimėtojo." }); return;
  }

  const sportCfg = getSportConfig(t.sport);

  // Run inside a transaction with row-level lock so two simultaneous match-result submissions
  // can't lose each other's writes (read-modify-write race on bracketData JSON).
  const txResult = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ bracketData: tournamentsTable.bracketData })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, id))
      .for("update");
    const bracket = (locked?.bracketData ?? null) as BracketData | null;
    if (!bracket) return { ok: false as const, status: 400, error: "Tinklelis dar nesugeneruotas" };

    const upd = applyMatchResult(
      bracket,
      matchId,
      winnerRegIdNum,
      hasStructuredScore ? (score as SportScore) : (typeof score === "string" ? score : null),
      sportCfg,
    );
    if (!upd.ok) return { ok: false as const, status: 400, error: upd.error };

    const resultData = buildResultData(bracket);
    await tx.update(tournamentsTable)
      .set({ bracketData: bracket, resultData: resultData ?? null })
      .where(eq(tournamentsTable.id, id));
    return { ok: true as const, bracket, resultData, nextOpponent: upd.nextOpponent };
  });

  if (!txResult.ok) { res.status(txResult.status).json({ error: txResult.error }); return; }
  const bracket = txResult.bracket;
  const resultData = txResult.resultData;
  const upd = { nextOpponent: txResult.nextOpponent };

  // Notify the next opponent if there is one (knockout flows only)
  if (upd.nextOpponent) {
    const [reg] = await db
      .select({ userId: tournamentRegistrationsTable.userId })
      .from(tournamentRegistrationsTable)
      .where(eq(tournamentRegistrationsTable.id, upd.nextOpponent.regId));
    if (reg?.userId) {
      await sendNotification(
        reg.userId,
        "tournament_match_ready",
        "Jūsų kitas mačas paruoštas",
        `Turnyras „${t.name}" — laukia kito etapo varžybos`,
        `/tournaments/${id}`,
      ).catch(() => {});
    }
  }

  res.json({ ok: true, bracketData: bracket, resultData });
});

// --- Legacy create/edit (kept for back-compat) -------------------------------

// POST /courts/:id/tournaments — legacy single-court create (court owner only) → auto-approved
router.post("/courts/:id/tournaments", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id as string, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const userId = getCurrentUserId(req)!;
  const { name, description, sport, startDate, endDate, registrationDeadline, maxParticipants, entryFee, prizeInfo, status, format, coverPhotoUrl } = req.body;

  if (!name || !sport || !startDate || !endDate) {
    res.status(400).json({ error: "name, sport, startDate, endDate are required" }); return;
  }

  const [tournament] = await db.insert(tournamentsTable).values({
    courtId,
    courtIds: [courtId],
    facilityId: court.facilityId ?? null,
    ownerUserId: userId,
    organizerId: userId,
    name,
    description: description ?? null,
    sport,
    coverPhotoUrl: coverPhotoUrl ?? null,
    startDate,
    endDate,
    registrationDeadline: registrationDeadline ?? null,
    maxParticipants: maxParticipants ?? 16,
    entryFee: entryFee != null ? String(entryFee) : null,
    prizeInfo: prizeInfo ?? null,
    status: status ?? "draft",
    approvalStatus: "approved",
    format: format ?? "single_elimination",
  }).returning();

  res.status(201).json(formatTournament(tournament));
});

// PUT /tournaments/:id — update tournament (organizer/owner/admin)
router.put("/tournaments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }

  const { name, description, sport, startDate, endDate, registrationDeadline, maxParticipants, entryFee, prizeInfo, status, format, coverPhotoUrl } = req.body;

  const [updated] = await db.update(tournamentsTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description: description ?? null }),
    ...(sport !== undefined && { sport }),
    ...(coverPhotoUrl !== undefined && { coverPhotoUrl: coverPhotoUrl ?? null }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(registrationDeadline !== undefined && { registrationDeadline: registrationDeadline ?? null }),
    ...(maxParticipants !== undefined && { maxParticipants }),
    ...(entryFee !== undefined && { entryFee: entryFee != null ? String(entryFee) : null }),
    ...(prizeInfo !== undefined && { prizeInfo: prizeInfo ?? null }),
    ...(status !== undefined && { status }),
    ...(format !== undefined && { format }),
  }).where(eq(tournamentsTable.id, id)).returning();

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id));

  res.json(formatTournament(updated, Number(countRow?.count ?? 0)));
});

// POST /tournaments/:id/promote — homepage promotion (organizer/owner/admin)
router.post("/tournaments/:id/promote", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }

  const days = parseInt(String(req.body?.days ?? 14), 10);
  const until = new Date();
  until.setDate(until.getDate() + (isNaN(days) ? 14 : days));

  const [updated] = await db.update(tournamentsTable).set({
    isFeatured: true,
    featuredUntil: until,
  }).where(eq(tournamentsTable.id, id)).returning();

  res.json(formatTournament(updated));
});

// DELETE /tournaments/:id (organizer/owner/admin)
router.delete("/tournaments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }

  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.json({ ok: true });
});

// GET /tournaments/:id/registrations — organizer/owner/admin only
router.get("/tournaments/:id/registrations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }

  const rows = await db.select().from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id))
    .orderBy(tournamentRegistrationsTable.registeredAt);

  res.json(rows.map(formatReg));
});

// POST /tournaments/:id/register — public/guest registration (still works; Stripe Checkout integration is future work)
router.post("/tournaments/:id/register", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }
  if ((t.approvalStatus ?? "approved") !== "approved") {
    res.status(400).json({ error: "Tournament is not yet approved" }); return;
  }
  if (t.status !== "open") {
    res.status(400).json({ error: "Tournament is not open for registration" }); return;
  }

  if (t.registrationDeadline) {
    const deadline = new Date(t.registrationDeadline);
    if (new Date() > deadline) {
      res.status(400).json({ error: "Registration deadline has passed" }); return;
    }
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tournamentRegistrationsTable)
    .where(eq(tournamentRegistrationsTable.tournamentId, id));

  if (Number(countRow?.count ?? 0) >= t.maxParticipants) {
    res.status(400).json({ error: "Tournament is full" }); return;
  }

  const { playerName, playerEmail, playerPhone, userId } = req.body;
  if (!playerName || !playerEmail) {
    res.status(400).json({ error: "playerName and playerEmail are required" }); return;
  }

  const [reg] = await db.insert(tournamentRegistrationsTable).values({
    tournamentId: id,
    playerName,
    playerEmail,
    playerPhone: playerPhone ?? null,
    userId: userId ?? null,
    status: "confirmed",
  }).returning();

  res.status(201).json(formatReg(reg));
});

// DELETE /tournaments/:id/registrations/:regId — organizer/owner/admin only
router.delete("/tournaments/:id/registrations/:regId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const regId = parseInt(req.params.regId as string, 10);
  if (isNaN(id) || isNaN(regId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await loadOrganizerEditableTournament(req, id);
  if (!result.ok) { res.status(result.status).json(result.body); return; }

  const deleted = await db.delete(tournamentRegistrationsTable).where(
    and(
      eq(tournamentRegistrationsTable.id, regId),
      eq(tournamentRegistrationsTable.tournamentId, id),
    ),
  ).returning();
  if (deleted.length === 0) { res.status(404).json({ error: "Registration not found" }); return; }
  res.json({ ok: true });
});

export default router;
