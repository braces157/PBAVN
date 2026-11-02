/**
 * Period statistics.
 *
 * `/stats/service/period` returns one row per player for a date window, and it
 * is the richest surface the association publishes: conversions and attempts,
 * 1-point counts, long runs, bank shots, first-shot success, expected points,
 * closing probability and the whole tiebreak record. The site never read it.
 *
 * The upstream keys are Korean column aliases straight off the SQL result, so
 * they are normalised once, here, into names the UI can use.
 */

import type { RawPeriodStat } from "./pba/types";

export interface TiebreakRecord {
  wins: number;
  losses: number;
  rate: number | null;
  firstCount: number;
  firstRate: number | null;
  secondCount: number;
  secondRate: number | null;
  highRun: number;
}

export interface PeriodStat {
  memCode: string;
  name: string;
  nameShort: string;
  circuit: string;

  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;

  setWins: number;
  setLosses: number;
  setDiff: number;

  points: number;
  innings: number;
  average: number | null;
  highRun: number;
  inningsPerMatch: number | null;

  attempts: number;
  conversions: number;
  attackRate: number | null;

  onePoints: number;
  longRuns: number;
  longRunRate: number | null;
  bankShots: number;
  bankShotRate: number | null;
  firstShotRate: number | null;

  expectedPoints: number | null;
  closingRate: number | null;

  tiebreak: TiebreakRecord;
}

function n(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function normalizePeriodStat(raw: RawPeriodStat): PeriodStat {
  const wins = n(raw.승수);
  const losses = n(raw.패수);
  const matches = wins + losses;

  return {
    memCode: raw.MemCode,
    name: raw.NameFull || raw.NameShort || raw.MemCode,
    nameShort: raw.NameShort || raw.NameFull || raw.MemCode,
    circuit: raw.PBAType ?? "",

    matches,
    wins,
    losses,
    winRate: ratio(wins, matches),

    setWins: n(raw["세트 승"]),
    setLosses: n(raw["세트 패"]),
    setDiff: n(raw["세트 득실"]),

    points: n(raw.점수),
    innings: n(raw.이닝),
    average: ratio(n(raw.점수), n(raw.이닝)),
    highRun: n(raw.하이런),
    inningsPerMatch: ratio(n(raw.이닝), matches),

    attempts: n(raw.공격시도횟수),
    conversions: n(raw.공격성공횟수),
    attackRate: ratio(n(raw.공격성공횟수), n(raw.공격시도횟수)),

    onePoints: n(raw["1득점 횟수"]),
    longRuns: n(raw.장타),
    longRunRate: ratio(n(raw.장타), n(raw.공격시도횟수)),
    bankShots: n(raw["뱅크샷 횟수"]),
    bankShotRate: ratio(n(raw["뱅크샷 횟수"]), n(raw.공격시도횟수)),
    firstShotRate: raw["초구 성공율"] === undefined ? null : n(raw["초구 성공율"]) / 100,

    expectedPoints: raw["기대 득점"] === undefined ? null : n(raw["기대 득점"]),
    closingRate: raw["끝내기 확률"] === undefined ? null : n(raw["끝내기 확률"]) / 100,

    tiebreak: {
      wins: n(raw["승부치기 승"]),
      losses: n(raw["승부치기 패"]),
      rate: raw["승부치기 승률"] === undefined ? null : n(raw["승부치기 승률"]) / 100,
      firstCount: n(raw["승부치기 선공 횟수"]),
      firstRate:
        raw["승부치기 선공 승률"] === undefined ? null : n(raw["승부치기 선공 승률"]) / 100,
      secondCount: n(raw["승부치기 후공 횟수"]),
      secondRate:
        raw["승부치기 후공 승률"] === undefined ? null : n(raw["승부치기 후공 승률"]) / 100,
      highRun: n(raw["승부치기 하이런"]),
    },
  };
}

export type PeriodUnit = "avg" | "int" | "pct" | "num";

export interface PeriodCategory {
  key: string;
  label: string;
  unit: PeriodUnit;
  /** Short column heading for the dense table. */
  column: string;
  value: (stat: PeriodStat) => number | null;
  /** Every category the association publishes here is better when larger. */
  hint: string;
}

/** Only fields with a real sample size are offered as a ranking. */
export const PERIOD_CATEGORIES: PeriodCategory[] = [
  {
    key: "average",
    label: "Average",
    unit: "avg",
    column: "Avg",
    value: (stat) => stat.average,
    hint: "Points per inning across the window.",
  },
  {
    key: "highRun",
    label: "High run",
    unit: "int",
    column: "HR",
    value: (stat) => (stat.highRun > 0 ? stat.highRun : null),
    hint: "Longest single run.",
  },
  {
    key: "onePoints",
    label: "1-point conversions",
    unit: "int",
    column: "1P",
    value: (stat) => stat.onePoints,
    hint: "Single-point shots converted.",
  },
  {
    key: "longRunRate",
    label: "Long-run rate",
    unit: "pct",
    column: "LR%",
    value: (stat) => stat.longRunRate,
    hint: "Long runs as a share of all attempts.",
  },
  {
    key: "bankShotRate",
    label: "Bank-shot rate",
    unit: "pct",
    column: "BS%",
    value: (stat) => stat.bankShotRate,
    hint: "Bank shots as a share of all attempts.",
  },
  {
    key: "firstShotRate",
    label: "First-shot success",
    unit: "pct",
    column: "1st%",
    value: (stat) => stat.firstShotRate,
    hint: "How often the opening shot of an inning scores.",
  },
  {
    key: "attackRate",
    label: "Attack success",
    unit: "pct",
    column: "Att%",
    value: (stat) => stat.attackRate,
    hint: "Conversions as a share of attempts.",
  },
  {
    key: "closingRate",
    label: "Closing probability",
    unit: "pct",
    column: "Close",
    value: (stat) => stat.closingRate,
    hint: "Modelled chance of finishing the set once in a scoring position.",
  },
  {
    key: "expectedPoints",
    label: "Expected points",
    unit: "num",
    column: "xPts",
    value: (stat) => stat.expectedPoints,
    hint: "Points expected from an average visit.",
  },
  {
    key: "tiebreakRate",
    label: "Tiebreak win rate",
    unit: "pct",
    column: "TB%",
    value: (stat) => stat.tiebreak.rate,
    hint: "Record in the deciding tiebreak.",
  },
  {
    key: "wins",
    label: "Match wins",
    unit: "int",
    column: "W",
    value: (stat) => stat.wins,
    hint: "Matches won in the window.",
  },
];

export function periodCategory(key: string | undefined): PeriodCategory {
  return PERIOD_CATEGORIES.find((category) => category.key === key) ?? PERIOD_CATEGORIES[0];
}

/**
 * Format a statistic for display.
 *
 * Zero is a real value and is printed as one; only a missing sample becomes a
 * dash. Rates are carried as fractions so they cannot be double-multiplied.
 */
export function formatPeriodValue(unit: PeriodUnit, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "avg":
      return value.toFixed(3);
    case "pct":
      return `${(value * 100).toFixed(1)}%`;
    case "num":
      return value.toFixed(2);
    default:
      return value.toLocaleString("en-US");
  }
}

/**
 * Rank a window.
 *
 * Players with no sample for the chosen category are dropped rather than shown
 * at the bottom with a zero: a missing average is not a bad average.
 */
export function rankPeriod(rows: PeriodStat[], category: PeriodCategory, limit = 25): PeriodStat[] {
  return rows
    .filter((row) => {
      const value = category.value(row);
      return value !== null && Number.isFinite(value);
    })
    .sort((a, b) => (category.value(b) ?? 0) - (category.value(a) ?? 0))
    .slice(0, limit);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The date window the page asked for, so the table can state it. */
export function periodWindow(startDate: string, endDate: string): string {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
  };
  return `${format(startDate)} – ${format(endDate)}`;
}

/** Season code to the calendar window the association's stats service accepts. */
export function seasonWindow(seasonCode: string, today = new Date()): { startDate: string; endDate: string } {
  const year = /^\d{4}$/.test(seasonCode) ? Number(seasonCode) : today.getFullYear();
  const pad = (value: number) => String(value).padStart(2, "0");
  // Local date parts, not `toISOString`: a page rendered in the morning east of
  // Greenwich would otherwise ask for yesterday.
  const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (year === today.getFullYear()) {
    return { startDate: `${year}-01-01`, endDate: day };
  }
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}
