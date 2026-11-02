/**
 * Pure parsers for the team-league terminal at team.pbatour.org.
 *
 * Four fragments, all legacy ASP, all testable offline:
 *
 *   POST /mob/code_behind/getPlanDetailEnd_new2.asp   one round's fixtures
 *   POST /mob/code_behind/getPlanResult_new.asp       one fixture's bouts
 *   GET  /mob/ko/planResultDetail.asp?TGCode=         one bout's TPT variables
 *   POST /mob/code_behind/getPlanResultDetail.asp     one bout's innings JSON
 *
 * A round listing mixes two block shapes: played fixtures carry a
 * `content_block_set` wrapper and a `win_lost_block01_set` score table;
 * scheduled fixtures carry `content_block` and `win_lost_block01` with names
 * and a date only. Either list class is accepted, so a round in progress can
 * put a score table under either one. No imports; `./team-matches` adds the
 * transport.
 */

/* ------------------------------------------------------- round fixtures, getPlanDetailEnd_new2 */

export interface FixtureSide {
  /** T000xx, from viewRanktOther. The join key to everything else. */
  clubCode: string | null;
  /** Display name from the block. Unplayed blocks may publish it in Korean. */
  name: string;
  sets: number | null;
  average: number | null;
  highRun: number | null;
  draws: number | null;
  losses: number | null;
  won: boolean;
}

export interface TeamFixture {
  /** TeamGameNO from viewResult. Null on a shape that never publishes one. */
  gameNo: string | null;
  home: FixtureSide;
  away: FixtureSide;
  playedAt: string | null;
  played: boolean;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function text(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function number(value: string | null): number | null {
  if (!value) return null;
  // `Number("")` is 0, so a heading like "Win" would otherwise read as a zero.
  const digits = value.replace(/[^0-9.\-]/g, "");
  if (digits === "" || digits === "-" || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

interface Cell {
  cls: string;
  value: string;
}

/**
 * The leaf spans of a list item, in document order.
 *
 * Fixture rows publish Win / AVG / HR / Draw / Loss under three different
 * class names shared between columns, so position after the name cell is the
 * only honest way to read them. Spans that contain another span (the result
 * marker inside `t_order`) are represented by their innermost leaf.
 */
function cells(item: string): Cell[] {
  const found: Cell[] = [];
  const pattern = /<span\s+class="([^"]*)"[^>]*>([^<]*)<\/span>/gi;
  for (const match of item.matchAll(pattern)) {
    const cls = match[1];
    const value = text(match[2]);
    if (!cls && !value) continue;
    found.push({ cls, value });
  }
  return found;
}

/** `2026-09-14 16:01` and its two-digit-year cousin. */
const DATETIME = /^(?:\d{2}|\d{4})-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/;

function fixtureSides(block: string): FixtureSide[] {
  const list = block.match(/<ul\s+class="win_lost_block01[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1];
  if (!list) return [];

  const sides: FixtureSide[] = [];
  const items = list.split(/<li\b/i).slice(1);

  for (const [index, item] of items.entries()) {
    const row = cells(item);
    const nameCell = row.find((cell) => cell.cls === "t_name");
    if (!nameCell || !nameCell.value) continue;
    // The column heading row is the list's first item in every saved shape.
    if (index === 0) continue;

    // Score columns follow the name in published order: sets, average, high
    // run, draws, losses. A scheduled block publishes none of them.
    const values = row.slice(row.indexOf(nameCell) + 1).map((cell) => number(cell.value));
    sides.push({
      clubCode: null,
      name: nameCell.value,
      sets: values[0] ?? null,
      average: values[1] ?? null,
      highRun: values[2] ?? null,
      draws: values[3] ?? null,
      losses: values[4] ?? null,
      won: /class="icon_win"/i.test(item),
    });
  }

  return sides;
}

export function parseRoundFixtures(html: string | null): TeamFixture[] {
  if (!html) return [];

  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const fixtures: TeamFixture[] = [];

  for (const block of clean.split(/<div class="set_box">/i).slice(1)) {
    const sides = fixtureSides(block);
    if (sides.length < 2) continue;

    const gameNo = block.match(/viewResult\(\s*'([^']*)'\s*\)/i)?.[1] ?? null;
    const clubCodes = block.match(
      /viewRanktOther\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/i,
    );

    const stamp = [...block.matchAll(/<span class="t14"[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => text(match[1]))
      .find((value) => DATETIME.test(value));
    let playedAt = stamp ?? null;
    if (!playedAt) {
      // A scheduled block splits the kickoff into a d_day date and a time.
      const day = block.match(/class="d_day"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
      const date = day.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const time = day.match(/\d{1,2}:\d{2}/)?.[0];
      if (date && time) playedAt = `${date} ${time}`;
    }

    sides[0].clubCode = clubCodes?.[1] || null;
    sides[1].clubCode = clubCodes?.[2] || null;

    fixtures.push({
      gameNo,
      home: sides[0],
      away: sides[1],
      playedAt,
      played: sides.some((side) => side.sets !== null),
    });
  }

  return fixtures;
}

/* ------------------------------------------------------------- bouts, getPlanResult_new */

export interface BoutSide {
  /** Split on <br>; a doubles pair yields two names. */
  names: string[];
  points: number | null;
  innings: number | null;
  average: number | null;
  highRun: number | null;
  won: boolean;
}

export interface Bout {
  setNo: number;
  /** TGCode from viewResultDetail. Null while the bout is running or unrecorded. */
  tgCode: string | null;
  /** Race format as published, "GP11". */
  format: string | null;
  playedAt: string | null;
  sides: BoutSide[];
}

export interface FixtureBouts {
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeSets: number | null;
  awaySets: number | null;
  homeAverage: number | null;
  awayAverage: number | null;
  homeHighRun: number | null;
  awayHighRun: number | null;
  winner: "home" | "away" | null;
  bouts: Bout[];
}

/** `11P / 8` — points over innings. */
const POINTS_INNINGS = /^(\d+)\s*P\s*\/\s*(\d+)$/i;

function boutSides(block: string): BoutSide[] {
  const list = block.match(/<ul\s+class="win_lost_block01[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1];
  if (!list) return [];

  const sides: BoutSide[] = [];
  for (const item of list.split(/<li\b/i).slice(1)) {
    // A doubles pair arrives as two names over a <br>, which text() would
    // flatten and the leaf-span scan would drop, so the raw name cell is read
    // and split first.
    const rawName = item.match(/class="t_name"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const names = rawName
      .split(/<br\s*\/?>/i)
      .map((part) => text(part))
      .filter((name) => name.length > 0);
    if (names.length === 0) continue;

    // Only a scored row is a side: the heading publishes "Point/inn", and a
    // real row always carries points over innings, running or final.
    const row = cells(item);
    const score = row
      .map((cell) => (cell.cls === "t_set" ? POINTS_INNINGS.exec(cell.value.trim()) : null))
      .find(Boolean);
    if (!score) continue;
    sides.push({
      names,
      points: Number(score[1]),
      innings: Number(score[2]),
      average: number(row.find((cell) => cell.cls === "t_avg")?.value ?? null),
      highRun: number(row.find((cell) => cell.cls === "t_high")?.value ?? null),
      won: /class="icon_win"/i.test(item),
    });
  }

  return sides;
}

function headerRowValue(rows: string[][], label: string): [number | null, number | null] {
  for (const row of rows) {
    const index = row.findIndex((cell) => cell === label);
    if (index === -1) continue;
    const before = number(row[index - 1] ?? "");
    const after = number(row[index + 1] ?? "");
    return [before, after];
  }
  return [null, null];
}

export function parseFixtureBouts(html: string | null): FixtureBouts | null {
  if (!html) return null;

  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const board = clean.match(/<div[^>]*class="[^"]*score_board[^"]*"[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!board) return null;

  const names = [...board.matchAll(/class="player_name"[^>]*>([\s\S]*?)<\/span>/gi)].map((match) =>
    text(match[1]),
  );
  const logos = [...board.matchAll(/<img[^>]*src="([^"]+)"/gi)].map((match) => match[1]);

  // The board is one table: names in the header row, then Score, AVG and HR
  // rows that each read value / label / value.
  const rows = [...board.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1])),
  );
  const [homeSets, awaySets] = headerRowValue(rows, "Score");
  const [homeAverage, awayAverage] = headerRowValue(rows, "AVG");
  const [homeHighRun, awayHighRun] = headerRowValue(rows, "HR");

  // The W mark sits in the winner's header cell.
  const nameCells = [...board.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => match[1]);
  const homeWins = /icon_win/.test(nameCells[0] ?? "");
  const awayWins = /icon_win/.test(nameCells[nameCells.length - 1] ?? "");

  const bouts: Bout[] = [];
  for (const block of clean.split(/<div class="set_box">/i).slice(1)) {
    const setNo = number(text(block.match(/class="no_order[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""));
    if (setNo === null) continue;

    const spans = [...block.matchAll(/<span class="t14"[^>]*>([\s\S]*?)<\/span>/gi)].map((match) =>
      text(match[1]),
    );
    const playedAt = spans.find((value) => DATETIME.test(value)) ?? null;
    const format = spans.find((value) => /^[A-Z]{2,4}\d{1,3}$/.test(value)) ?? null;

    const sides = boutSides(block);
    if (sides.length === 0) continue;

    bouts.push({
      setNo,
      tgCode: block.match(/viewResultDetail\(\s*'([^']*)'\s*\)/i)?.[1] ?? null,
      format,
      playedAt,
      sides,
    });
  }

  return {
    homeName: names[0] ?? "",
    awayName: names[1] ?? "",
    homeLogo: logos[0] ?? null,
    awayLogo: logos[1] ?? null,
    homeSets,
    awaySets,
    homeAverage,
    awayAverage,
    homeHighRun,
    awayHighRun,
    winner: homeWins ? "home" : awayWins ? "away" : null,
    bouts,
  };
}

/* --------------------------------------------------- TPT variables, planResultDetail.asp */

export interface TptCodes {
  tptCode1: string;
  tptCode2: string;
  lastInning: number;
}

/**
 * The per-inning chain needs two codes that only the detail page publishes,
 * each as a `var` assignment that appears several times in the shell. The
 * regex anchors on the declaration form so later re-uses cannot shadow it.
 */
export function parseTptCodes(html: string | null): TptCodes | null {
  if (!html) return null;

  const code1 = html.match(/var\s+TPTCode1\s*=\s*"([^"]*)"/)?.[1];
  const code2 = html.match(/var\s+TPTCode2\s*=\s*"([^"]*)"/)?.[1];
  const lastInning = number(html.match(/var\s+LastInn\s*=\s*"([^"]*)"/)?.[1] ?? null);

  if (!code1 || !code2) return null;
  return { tptCode1: code1, tptCode2: code2, lastInning: lastInning ?? 0 };
}

/* -------------------------------------------------------------- innings, getPlanResultDetail */

export interface InningSide {
  /** InnScore, this inning's points. */
  score: number;
  onePoint: number;
  twoPoint: number;
  /** TotalScore, cumulative. */
  total: number;
}

export interface BoutInnings {
  maxInnings: number;
  /** One row per inning up to the longer side. A side that stopped early is null. */
  rows: { inning: number; sides: [InningSide, InningSide | null] }[];
}

interface RawInning {
  InnScore?: string;
  OnePoint?: string;
  TwoPoint?: string;
  TotalScore?: string;
}

interface RawInnings {
  MaxInn?: string;
  InnInfo1?: RawInning[];
  InnInfo2?: RawInning[];
}

function inningOf(raw: RawInning | undefined): InningSide | null {
  if (!raw) return null;
  const score = number(raw.InnScore ?? null);
  const onePoint = number(raw.OnePoint ?? null);
  const twoPoint = number(raw.TwoPoint ?? null);
  const total = number(raw.TotalScore ?? null);
  if (score === null || total === null) return null;
  return { score, onePoint: onePoint ?? 0, twoPoint: twoPoint ?? 0, total };
}

export function parseInnings(json: string | null): BoutInnings {
  if (!json) return { maxInnings: 0, rows: [] };

  let raw: RawInnings;
  try {
    raw = JSON.parse(json) as RawInnings;
  } catch {
    return { maxInnings: 0, rows: [] };
  }

  const first = Array.isArray(raw.InnInfo1) ? raw.InnInfo1 : [];
  const second = Array.isArray(raw.InnInfo2) ? raw.InnInfo2 : [];
  const length = Math.max(first.length, second.length);
  if (length === 0) return { maxInnings: 0, rows: [] };

  const maxInnings = number(raw.MaxInn ?? null);
  const rows = Array.from({ length }, (_, index) => ({
    inning: index + 1,
    sides: [inningOf(first[index]), inningOf(second[index])] as [InningSide, InningSide | null],
  }));

  return { maxInnings: maxInnings ?? length, rows };
}
