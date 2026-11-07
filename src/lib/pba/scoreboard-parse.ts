/**
 * Pure parsers for the association's legacy scoring terminal.
 *
 * Kept free of imports so the markup contract can be tested on its own, with no
 * network and no Next runtime. `./scoreboard` adds the transport.
 *
 * The shapes upstream publishes:
 *   live_info_setview.asp   one block per set, with a PCGMCode per set
 *   contest_result_set_record.asp   one row per inning, two column groups
 *   contest_result_set_help.asp     value | label | value match totals
 *   live_info.asp           the live board, CSS-only when nothing is scored
 */

/* ------------------------------------------------------------------- types */

export interface SetPlayer {
  name: string;
  /** Points in the set, i.e. the race target reached or approached. */
  points: number;
  innings: number;
  average: number | null;
  highRun: number | null;
  won: boolean;
  /** Billed first, marked "(선공)" upstream. */
  broke: boolean;
}

export interface MatchSet {
  setNo: number;
  /** Identifier of this single set, used to fetch its innings. */
  pcgmCode: string | null;
  /** Race format of the set: GP9, GP11, GP15. */
  gameType: string | null;
  /** Published as `MM-DD`, with no year and no time. */
  playedOn: string | null;
  players: SetPlayer[];
}

/** One row of the match-total comparison table: value, label, value. */
export interface MatchTotalRow {
  label: string;
  left: string;
  right: string;
}

export interface Scorecard {
  pstCode: string;
  sets: MatchSet[];
  totals: MatchTotalRow[];
}

export interface InningSide {
  onePoint: number;
  twoPoint: number;
  /** Running score after this inning, as published. */
  total: number;
}

export interface InningRow {
  inning: number;
  sides: InningSide[];
}

export interface SetInnings {
  /** Player names in column order, from the table head. */
  players: string[];
  /** Index of the player who broke first, when marked. */
  breaker: number | null;
  rows: InningRow[];
}

/** A match the scoring terminal is publishing right now. */
export interface LiveMatchRef {
  pstCode: string;
  /** Any broadcast link the live board attached to the row. */
  watchUrl: string | null;
}

/* --------------------------------------------------------------- utilities */

/** Drop markup that carries no data but does carry misleading text. */
function clean(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ");
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&middot;": "·",
};

/** Visible text of a fragment, entities decoded, whitespace collapsed. */
export function text(fragment: string | null | undefined): string {
  if (!fragment) return "";
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellHtml(row: string): string[] {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);
}

function rowHtml(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

function span(html: string, className: string): string | null {
  const match = html.match(new RegExp(`class="${className}"[^>]*>([\\s\\S]*?)</span>`, "i"));
  return match ? text(match[1]) : null;
}

function toNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/* --------------------------------------------------------------- match page */

/**
 * The set list from the match page.
 *
 * Each set block carries its race format, the published date, both players'
 * points and innings, and the `PCGMCode` needed to ask for that set's innings.
 * Player rows are list items, not table rows, so they are split on `<li>`.
 */
export function parseSets(html: string | null): MatchSet[] {
  if (!html) return [];

  const blocks = clean(html).split(/<div class="set_box">/i).slice(1);
  const sets: MatchSet[] = [];

  for (const block of blocks) {
    const setLabel = block.match(/class="no_order[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;
    const gameType = block.match(/<span class="t14">\s*(GP\d+)\s*<\/span>/i)?.[1] ?? null;
    const playedOn = block.match(/<span class="t14">\s*(\d{1,2}-\d{1,2})\s*<\/span>/i)?.[1] ?? null;
    const pcgmCode = block.match(/recordlayer\(\s*\d+\s*,\s*(\d+)\s*\)/i)?.[1] ?? null;

    const players: SetPlayer[] = [];
    for (const item of block.split(/<li\b/i).slice(1)) {
      if (!/class="t_set"/i.test(item)) continue;
      const name = span(item, "t_name");
      if (!name) continue;
      // The column-heading row is a list item too; a real player row is the
      // only one that publishes points over innings.
      const pointsAndInnings = (span(item, "t_set") ?? "").match(/(\d+)\s*P\s*\/\s*(\d+)/i);
      if (!pointsAndInnings) continue;
      players.push({
        name,
        points: toNumber(pointsAndInnings[1]) ?? 0,
        innings: toNumber(pointsAndInnings[2]) ?? 0,
        average: toNumber(span(item, "t_avg")),
        highRun: toNumber(span(item, "t_high")),
        won: /class="icon_win"/i.test(item),
        broke: /선공/.test(item),
      });
    }

    if (players.length === 0) continue;
    sets.push({
      setNo: toNumber(text(setLabel)) ?? sets.length + 1,
      pcgmCode,
      gameType,
      playedOn,
      players,
    });
  }

  return sets.sort((a, b) => a.setNo - b.setNo);
}

/** Assemble the two fragments the match page needs into one scorecard. */
export function parseScorecard(
  matchHtml: string | null,
  totalsHtml: string | null,
  pstCode: string,
): Scorecard {
  return {
    pstCode,
    sets: parseSets(matchHtml),
    totals: parseTotals(totalsHtml),
  };
}

/** The match-total comparison table: `value | label | value`. */
export function parseTotals(html: string | null): MatchTotalRow[] {
  if (!html) return [];
  const out: MatchTotalRow[] = [];
  for (const row of rowHtml(clean(html))) {
    const values = cellHtml(row).map(text);
    if (values.length !== 3) continue;
    const [left, label, right] = values;
    if (!label || !left || !right) continue;
    // The player header row reads "name | VS | name".
    if (/^VS$/i.test(label)) continue;
    out.push({ label, left, right });
  }
  return out;
}

/* -------------------------------------------------------------- innings page */

/**
 * One set, inning by inning.
 *
 * The table has one column group per player. Inside a group the three cells are
 * 1-point conversions, 2-point conversions, and the running score, so the group
 * count is derived rather than assumed: a doubles set publishes four groups.
 */
export function parseSetInnings(html: string | null): SetInnings {
  const empty: SetInnings = { players: [], breaker: null, rows: [] };
  if (!html) return empty;

  const source = clean(html);
  const head = source.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "";

  const players: string[] = [];
  let breaker: number | null = null;
  for (const match of head.matchAll(/class="player_name"[^>]*>([\s\S]*?)<\/span>/gi)) {
    const raw = match[1];
    const name = text(raw.replace(/\(선공\)/gi, ""));
    if (!name) continue;
    if (/선공/.test(raw)) breaker = players.length;
    players.push(name);
  }

  const body = source.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? source;
  const parsed: InningRow[] = [];
  for (const row of rowHtml(body)) {
    const values = cellHtml(row).map(text);
    if (values.length < 4) continue;
    const inning = toNumber(values[0]);
    // The inning column is the only cell outside a player group of three.
    if (inning === null || (values.length - 1) % 3 !== 0) continue;
    const sides: InningSide[] = [];
    for (let index = 1; index + 3 <= values.length + 1; index += 3) {
      const onePoint = toNumber(values[index]) ?? 0;
      const twoPoint = toNumber(values[index + 1]) ?? 0;
      sides.push({
        onePoint,
        twoPoint,
        total: toNumber(values[index + 2]) ?? (parsed[parsed.length - 1]?.sides[sides.length]?.total ?? 0) + onePoint + twoPoint * 2,
      });
    }
    if (sides.length < 2) continue;
    parsed.push({ inning, sides });
  }

  if (players.length === 0) {
    players.push(...Array.from({ length: parsed[0]?.sides.length ?? 0 }, () => ""));
  }
  return { players, breaker, rows: parsed };
}

/* --------------------------------------------------------------- live board */

/**
 * The live board answers with the CSS-only shell whenever no table is being
 * scored, which is the common case. When a match is live the fragment links to
 * its scorecard, and that is the only thing we rely on: a `PSTCode` and an
 * optional broadcast link. The rest of the fragment is prose.
 */
export function parseLiveBoard(html: string | null): LiveMatchRef[] {
  if (!html) return [];

  const found = new Set<string>();
  for (const pattern of [
    /live_info_setview\.asp\?PSTCode=(\d+)/gi,
    /setview\(\s*(\d+)\s*\)/gi,
    // Any other form the board uses to carry a match code, e.g. a data
    // attribute or a quoted query string.
    /PSTCode\D{0,3}(\d{4,7})/gi,
  ]) {
    for (const match of html.matchAll(pattern)) found.add(match[1]);
  }

  const youTube = html.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/[\w?=&%./-]+|youtu\.be\/[\w-]+)/i,
  );
  const watchUrl = youTube?.[0] ?? null;

  return [...found].map((pstCode) => ({ pstCode, watchUrl }));
}

/**
 * The readable text of a fragment, one entry per line.
 *
 * Kept so a live board we cannot read structurally is still shown as it
 * arrived, instead of being replaced by an empty state that hides a match.
 */
export function visibleLines(html: string | null): string[] {
  if (!html) return [];

  // Tags become line breaks before whitespace is collapsed, so each cell and
  // sentence stays on its own line.
  const lines = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .filter((line) => !/^[.#][\w-]+\s*\{$/.test(line))
    .filter((line) => !/^(padding|margin|border|font|color|background|width|height|display)$/i.test(line));

  return [...new Set(lines)];
}
