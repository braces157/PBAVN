/**
 * Match model: what the scoring terminal published, turned into the numbers a
 * billiards follower actually reads.
 *
 * The upstream record is one row per inning with both players' 1-point and
 * 2-point conversions and their running score. Everything on a match page that
 * is not published directly (per-inning average, scoring streaks, how a set was
 * closed out) is derived here, once, in pure functions, so the components only
 * render.
 */

import type { InningRow, MatchSet, MatchTotalRow, SetInnings } from "./pba/scoreboard-parse";

export interface Turn {
  inning: number;
  /** Points scored on this turn, from conversions. */
  scored: number;
  onePoint: number;
  twoPoint: number;
  /** Running score after the turn, as published. */
  total: number;
  empty: boolean;
}

export interface SetSide {
  index: number;
  name: string;
  points: number;
  innings: number;
  /** Published average for the set, three decimals. */
  average: number | null;
  highRun: number | null;
  won: boolean;
  broke: boolean;
  turns: Turn[];
  ones: number;
  twos: number;
  emptyTurns: number;
  scoringTurns: number;
  /** Most consecutive turns with at least one point. */
  bestStreak: number;
  /** Points still needed to reach the race target. */
  shortBy: number | null;
}

export interface AnalysedSet {
  setNo: number;
  gameType: string | null;
  /** Race target parsed from the game type, e.g. GP15 → 15. */
  target: number | null;
  playedOn: string | null;
  /** Innings actually published for the set. */
  innings: number;
  sides: SetSide[];
  winner: number | null;
  /** False when the innings fragment was unavailable, so the table is omitted. */
  hasTurns: boolean;
}

export interface MatchSummary {
  playedOn: string | null;
  /** Sets won by each side, in side order. */
  setsWon: number[];
  totalInnings: number[];
  totalPoints: number[];
  average: Array<number | null>;
  /** How many sets have a published turn record. */
  coveredSets: number;
}

/**
 * Race target from the published format code.
 *
 * Only formats in the range the sport actually uses are treated as a target.
 * A deciding set is sometimes published as `GP99`, which is a format flag, not
 * a race to ninety-nine, so anything outside the range reports no target rather
 * than inventing one.
 */
function target(gameType: string | null): number | null {
  if (!gameType) return null;
  const match = gameType.match(/^GP(\d+)$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return parsed >= 5 && parsed <= 21 ? parsed : null;
}

/** Longest run of consecutive turns that scored. */
function bestScoringStreak(turns: Turn[]): number {
  let best = 0;
  let current = 0;
  for (const turn of turns) {
    if (turn.empty) {
      current = 0;
      continue;
    }
    current += 1;
    if (current > best) best = current;
  }
  return best;
}

function toTurns(sideIndex: number, rows: InningRow[]): Turn[] {
  return rows.map((row) => {
    const cell = row.sides[sideIndex];
    const onePoint = cell?.onePoint ?? 0;
    const twoPoint = cell?.twoPoint ?? 0;
    const scored = onePoint + twoPoint * 2;
    return {
      inning: row.inning,
      onePoint,
      twoPoint,
      scored,
      total: cell?.total ?? 0,
      empty: scored === 0,
    };
  });
}

export function analyseSet(set: MatchSet, innings: SetInnings | null): AnalysedSet {
  const raceTo = target(set.gameType);
  const rows = innings?.rows ?? [];
  const hasTurns = rows.length > 0;

  const sides: SetSide[] = set.players.map((player, index) => {
    const turns = hasTurns ? toTurns(index, rows) : [];
    // Names come from two fragments; prefer the match page, fall back to the
    // innings header when the set page omits a name.
    const name = player.name || innings?.players[index] || "";
    const won = player.won || (raceTo !== null && player.points >= raceTo);
    return {
      index,
      name,
      points: player.points,
      innings: player.innings || turns.length,
      average: player.average,
      highRun: player.highRun,
      won,
      broke: player.broke || innings?.breaker === index,
      turns,
      ones: turns.reduce((sum, turn) => sum + turn.onePoint, 0),
      twos: turns.reduce((sum, turn) => sum + turn.twoPoint, 0),
      emptyTurns: turns.filter((turn) => turn.empty).length,
      scoringTurns: turns.filter((turn) => !turn.empty).length,
      bestStreak: bestScoringStreak(turns),
      shortBy: raceTo === null ? null : Math.max(0, raceTo - player.points),
    };
  });

  const winners = sides.filter((side) => side.won);
  return {
    setNo: set.setNo,
    gameType: set.gameType,
    target: raceTo,
    playedOn: set.playedOn,
    innings: rows.length,
    sides,
    winner: winners.length === 1 ? winners[0].index : null,
    hasTurns,
  };
}

/** Sets won, from the set list, independent of whether innings were published. */
export function setsWon(sets: MatchSet[]): number[] {
  const totals = new Map<number, number>();
  for (const set of sets) {
    set.players.forEach((player, index) => {
      if (!player.won) return;
      totals.set(index, (totals.get(index) ?? 0) + 1);
    });
  }
  return [...totals.entries()].sort((a, b) => a[0] - b[0]).map(([, won]) => won);
}

/**
 * Match totals, aggregated from the analysed sets.
 *
 * `sides` is the column count, which the match page fixes at two for singles;
 * doubles matches publish four and are aggregated the same way.
 */
export function summariseMatch(analysed: AnalysedSet[]): MatchSummary {
  const sideCount = analysed.reduce((widest, set) => Math.max(widest, set.sides.length), 0);
  const range = Array.from({ length: sideCount }, (_, index) => index);
  const playedOn = analysed.find((set) => set.playedOn)?.playedOn ?? null;

  const totalPoints = range.map((index) =>
    analysed.reduce((sum, set) => sum + (set.sides[index]?.points ?? 0), 0),
  );
  const totalInnings = range.map((index) =>
    analysed.reduce((sum, set) => sum + (set.sides[index]?.innings ?? 0), 0),
  );

  const average = range.map((index) => {
    const innings = totalInnings[index];
    return innings > 0 ? totalPoints[index] / innings : null;
  });

  return {
    playedOn,
    setsWon: range.map((index) =>
      analysed.reduce((sum, set) => sum + (set.sides[index]?.won ? 1 : 0), 0),
    ),
    totalInnings,
    totalPoints,
    average,
    coveredSets: analysed.filter((set) => set.hasTurns).length,
  };
}

/**
 * Cumulative score after each inning, for a progression chart. Sides are padded
 * to the longer one with their final score so both lines span the full width.
 */
export function progression(analysed: AnalysedSet): { innings: number; series: number[][] } {
  const innings = analysed.innings;
  if (innings === 0) return { innings: 0, series: [] };
  const series = analysed.sides.map((side) => {
    const line = side.turns.map((turn) => turn.total);
    const last = line.at(-1) ?? 0;
    while (line.length < innings) line.push(last);
    return line;
  });
  return { innings, series };
}

/* --------------------------------------------------------------- published */

const TOTAL_LABELS: Record<string, string> = {
  승패: "Sets",
  SET: "Sets",
  AVG: "Average",
  HR: "High run",
  이닝: "Innings",
  득점: "Points",
  "1P": "1-point",
  "2P": "2-point",
  공격성공율: "Attack success",
  장타율: "Long-run rate",
  뱅크샷율: "Bank-shot rate",
};

/** The totals table reads as Korean labels; the page shows English ones. */
export function totalLabel(label: string): string {
  return TOTAL_LABELS[label] ?? label;
}

/** Only the rows a reader can act on, in a stable reading order. */
const TOTAL_ORDER = [
  "Sets",
  "Average",
  "High run",
  "Innings",
  "Points",
  "1-point",
  "2-point",
  "Attack success",
  "Long-run rate",
  "Bank-shot rate",
];

export interface ComparisonRow {
  label: string;
  left: string;
  right: string;
  /** Higher is better for every published row except innings. */
  better: "left" | "right" | "none";
}

function numeric(value: string): number | null {
  const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

/** Turn the published totals into a comparison table with a winner per row. */
export function compareTotals(totals: MatchTotalRow[]): ComparisonRow[] {
  const seen = new Set<string>();
  const rows: ComparisonRow[] = [];

  for (const total of totals) {
    const label = totalLabel(total.label);
    if (seen.has(label)) continue;
    seen.add(label);

    const left = numeric(total.left);
    const right = numeric(total.right);
    let better: ComparisonRow["better"] = "none";
    // Innings is the one row where fewer is better, because it took less time
    // to reach the same target.
    if (left !== null && right !== null && left !== right) {
      if (label === "Innings") better = left < right ? "left" : "right";
      else better = left > right ? "left" : "right";
    }
    rows.push({ label, left: total.left, right: total.right, better });
  }

  return rows.sort((a, b) => {
    const ai = TOTAL_ORDER.indexOf(a.label);
    const bi = TOTAL_ORDER.indexOf(b.label);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}
