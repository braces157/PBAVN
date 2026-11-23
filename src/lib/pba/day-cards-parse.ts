/**
 * Pure parsers for the scoring terminal's live & upcoming tour match cards.
 *
 * The terminal publishes each day of an active tournament across three surfaces:
 *
 *   contest_result_sur.asp   finished matches (bracket rows, with results)
 *   live_info.asp            matches currently on the tables (live scorecards)
 *   next_game_new2.asp       scheduled upcoming matches (MM-DD | HH:MM kickoffs)
 *
 * Kept free of imports so the markup contract is testable offline, the same way
 * `./bracket-dated-parse` and `./scoreboard-parse` are.
 */

export interface UpcomingTourSide {
  name: string;
  memCode: string | null;
}

export interface UpcomingTourCard {
  tourCode: string | null;
  league: string | null;
  matchNo: string;
  round: string;
  /** Published as `MM-DD` in Korea time (no year). */
  monthDay: string | null;
  /** Published as `HH:MM` in Korea time. */
  clock: string | null;
  sides: UpcomingTourSide[];
}

export interface LiveTourSide {
  name: string;
  memCode: string | null;
  sets: number | null;
  points: number | null;
  average: number | null;
  highRun: number | null;
}

export interface LiveTourCard {
  tourCode: string | null;
  league: string | null;
  pstCode: string;
  matchNo: string;
  round: string;
  table: string | null;
  sides: LiveTourSide[];
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function text(fragment: string | null | undefined): string {
  if (!fragment) return "";
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ");
}

function toNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.\-]/g, "");
  if (!digits || digits === "-" || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseRound(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^(?:결승|final)$/i.test(s)) return "Final";
  if (/^(?:준결승|4강|semi[- ]?final)$/i.test(s)) return "Semi-final";
  if (/^(?:8강|quarter[- ]?final|round\s*(?:of\s*)?8)$/i.test(s)) return "Quarter-final";
  const m = /^(?:round\s*(?:of\s*)?(\d+)|(\d+)\s*강|r\s*(\d+))$/i.exec(s);
  if (m) {
    const n = Number(m[1] ?? m[2] ?? m[3]);
    if (n === 2) return "Final";
    if (n === 4) return "Semi-final";
    if (n === 8) return "Quarter-final";
    if (Number.isFinite(n) && n > 0) return `Round of ${n}`;
  }
  return s;
}

function parseMeta(block: string): {
  tourCode: string | null;
  league: string | null;
  matchNo: string;
  round: string;
  table: string | null;
} {
  const vs = block.match(/comGameResultSet\(\s*'[^']*'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/i);
  const tourCode = vs?.[1]?.trim() || null;
  const league = vs?.[2]?.trim() || null;

  const tblHead = block.match(/<div class="tbl_info"[^>]*>([\s\S]*?)<span class="btn_box\b/i)?.[1] ?? "";
  const strongs = [...tblHead.matchAll(/<strong>([\s\S]*?)<\/strong>/gi)].map((m) => text(m[1]));
  const matchNo = (strongs[0] ?? "").replace(/^No\s*/i, "").trim();
  const round = normaliseRound(strongs[1] ?? "");
  const table = text(tblHead).match(/\b(T\d{1,2})\b/i)?.[1]?.toUpperCase() ?? null;

  return { tourCode, league, matchNo: matchNo || "—", round, table };
}

function parseCardPlayerItems(block: string): string[] {
  const listHtml = block.match(/<ul class="score_01[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  if (!listHtml) return [];
  return listHtml.split(/<li\b[^>]*>/i).slice(1);
}

function parseSideIdentity(item: string): { name: string; memCode: string | null } | null {
  const call = item.match(
    /comPlayerInfoTour\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/i,
  );
  const memCode = call?.[1]?.trim() || null;
  const spanName = text(item.match(/<span class="spbox[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const name = spanName || text(call?.[2]);
  if (!name) return null;
  return { name, memCode };
}

/**
 * Upcoming scheduled matches from `/mob/contest_new/code_behind/next_game_new2.asp`.
 */
export function parseUpcomingTourCards(html: string | null): UpcomingTourCard[] {
  if (!html) return [];
  const source = clean(html);
  const out: UpcomingTourCard[] = [];

  for (const block of source.split(/<div class="set_game">/i).slice(1)) {
    const meta = parseMeta(block);
    const btnHtml =
      block.match(/<span class="btn_box\b[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i)?.[1] ??
      block.match(/<span class="btn_box\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
      "";
    const btnText = text(btnHtml);
    const dtMatch = /(\d{2}-\d{2})\s*\|\s*(\d{1,2}):(\d{2})/.exec(btnText);
    const monthDay = dtMatch ? dtMatch[1] : null;
    const clock = dtMatch ? `${dtMatch[2].padStart(2, "0")}:${dtMatch[3]}` : null;

    const sides: UpcomingTourSide[] = [];
    for (const item of parseCardPlayerItems(block)) {
      const id = parseSideIdentity(item);
      if (id) sides.push(id);
    }
    if (sides.length < 2) continue;

    out.push({
      tourCode: meta.tourCode,
      league: meta.league,
      matchNo: meta.matchNo,
      round: meta.round,
      monthDay,
      clock,
      sides: sides.slice(0, 2),
    });
  }

  return out;
}

/**
 * Live matches directly from `/mob/contest_new/code_behind/live_info.asp`.
 */
export function parseLiveTourCards(html: string | null): LiveTourCard[] {
  if (!html) return [];
  const source = clean(html);
  const out: LiveTourCard[] = [];

  for (const block of source.split(/<div class="set_game">/i).slice(1)) {
    const pstCode = block.match(/setview\(\s*(\d+)\s*\)/i)?.[1] ?? null;
    if (!pstCode) continue;

    const meta = parseMeta(block);
    const sides: LiveTourSide[] = [];
    for (const item of parseCardPlayerItems(block)) {
      const id = parseSideIdentity(item);
      if (!id) continue;
      const setText = text(item.match(/<span class="set_point[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
      const ptsText = text(item.match(/<span class="number0 t22[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
      const itemText = text(item);
      const avgMatch = /\bAVG\s+([0-9]+(?:\.[0-9]+)?)/i.exec(itemText);
      const hrMatch = /\bHR\s+(\d+)/i.exec(itemText);

      const sets = toNumber(setText);
      const points = toNumber(ptsText);
      sides.push({
        name: id.name,
        memCode: id.memCode,
        sets: sets ?? points,
        points,
        average: avgMatch ? toNumber(avgMatch[1]) : null,
        highRun: hrMatch ? toNumber(hrMatch[1]) : null,
      });
    }
    if (sides.length < 2) continue;

    out.push({
      tourCode: meta.tourCode,
      league: meta.league,
      pstCode,
      matchNo: meta.matchNo,
      round: meta.round,
      table: meta.table,
      sides: sides.slice(0, 2),
    });
  }

  return out;
}
