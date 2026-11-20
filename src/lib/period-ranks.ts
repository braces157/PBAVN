/**
 * Pure circuit-wide ranking helpers derived from `/stats/service/period` rows.
 *
 * Kept free of runtime imports so `scripts/test-parsers.mjs` can execute it
 * directly under Node's `--experimental-strip-types`.
 */

import type { RawTour } from "./pba/types";

export interface PeriodRankInput {
  memCode: string;
  matches: number;
  winRate: number | null;
  points: number;
  tiebreak: {
    wins: number;
    losses: number;
  };
}

export interface ComputedCircuitRanks {
  winRate: number;
  points: number;
  shootoutRate: number;
}

/**
 * Derive the exact `[startDate, endDate]` span of a PBA season from its tour
 * calendar (PBA seasons run roughly June–March across two calendar years).
 * Returns `null` when no tour dates match `seasonCode`, so callers do not
 * substitute a calendar-year window for an unknown season span.
 */
export function tourSeasonWindow(
  tours: Pick<RawTour, "시즌코드" | "투어시작일자" | "투어종료일자">[],
  seasonCode: string,
): { startDate: string; endDate: string } | null {
  const dates: string[] = [];
  for (const tour of tours) {
    if (String(tour.시즌코드) !== seasonCode) continue;
    if (tour.투어시작일자) dates.push(tour.투어시작일자);
    if (tour.투어종료일자) dates.push(tour.투어종료일자);
  }
  if (dates.length === 0) return null;
  dates.sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

function assignCompetitionRanks(entries: { memCode: string; value: number }[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const ranks = new Map<string, number>();
  let prevValue: number | null = null;
  let prevRank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const { memCode, value } = sorted[i];
    const rank = prevValue !== null && Math.abs(prevValue - value) < 1e-9 ? prevRank : i + 1;
    ranks.set(memCode, rank);
    prevValue = value;
    prevRank = rank;
  }
  return ranks;
}

/**
 * Compute circuit-wide standard competition ranks (1, 1, 3…) for the three
 * season stats whose upstream rank fields are broken or omitted by
 * `/stats/service/season` (`winRate`, `points`, and `shootoutRate`).
 */
export function computePeriodRanks(rows: PeriodRankInput[]): Map<string, ComputedCircuitRanks> {
  const winRateEntries: { memCode: string; value: number }[] = [];
  const pointsEntries: { memCode: string; value: number }[] = [];
  const shootoutEntries: { memCode: string; value: number }[] = [];

  for (const row of rows) {
    if (row.matches > 0 && row.winRate !== null && Number.isFinite(row.winRate)) {
      winRateEntries.push({ memCode: row.memCode, value: row.winRate });
    }
    if (row.points > 0) {
      pointsEntries.push({ memCode: row.memCode, value: row.points });
    }
    const tbMatches = row.tiebreak.wins + row.tiebreak.losses;
    if (tbMatches > 0) {
      shootoutEntries.push({ memCode: row.memCode, value: row.tiebreak.wins / tbMatches });
    }
  }

  const winRateRanks = assignCompetitionRanks(winRateEntries);
  const pointsRanks = assignCompetitionRanks(pointsEntries);
  const shootoutRanks = assignCompetitionRanks(shootoutEntries);

  const result = new Map<string, ComputedCircuitRanks>();
  for (const row of rows) {
    result.set(row.memCode, {
      winRate: winRateRanks.get(row.memCode) ?? 0,
      points: pointsRanks.get(row.memCode) ?? 0,
      shootoutRate: shootoutRanks.get(row.memCode) ?? 0,
    });
  }
  return result;
}
