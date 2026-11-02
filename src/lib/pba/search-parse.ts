/**
 * Pure parser for the scoring terminal's name-search rows.
 *
 *   GET /mob/contest_new/code_behind/contest_result_sur.asp
 *       ?TourCode=&iBLCode=128&iPage=1&txt_Search=<latin name>&LangCode=en
 *
 * The search scans every bracket depth of one tour, so the rows arrive as a
 * flat stream of `set_box` blocks, each introduced by a `tit_round` heading
 * that names the round. A heading can cover several blocks, so the current
 * heading is carried forward to rows that bring none of their own. No imports,
 * so the markup contract is testable on its own; `./match-search` adds the
 * transport and the fan-out.
 */

export interface HistorySide {
  name: string;
  /** Member code, when the row carries one. */
  memCode: string | null;
  /** Sets won in the match. */
  sets: number | null;
  average: number | null;
  highRun: number | null;
  won: boolean;
}

export interface SearchedMatch {
  pstCode: string;
  matchNo: string;
  /** Canonical English label resolved from the tit_round heading. */
  round: string;
  /** The terminal publishes the kickoff verbatim; a search row often carries the time only. */
  scheduledAt: string | null;
  sides: HistorySide[];
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
  // `Number("")` is 0, so a heading like "Set" would otherwise read as a zero.
  const digits = value.replace(/[^0-9.\-]/g, "");
  if (digits === "" || digits === "-" || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function span(item: string, className: string): string | null {
  const match = item.match(new RegExp(`class="${className}"[^>]*>([\\s\\S]*?)</span>`, "i"));
  return match ? text(match[1]) : null;
}

/** A full `YY-MM-DD HH:MM` stamp, or the time-only form the search rows publish. */
const TIMESTAMP = /^(?:\d{2}-\d{2}-\d{2}\s+)?\d{1,2}:\d{2}$/;

export function parseSearchRows(html: string | null): SearchedMatch[] {
  if (!html) return [];

  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ");

  const matches: SearchedMatch[] = [];
  let round = "";

  for (const block of clean.split(/<div class="set_box">/i).slice(1)) {
    const heading = block.match(/class="tit_round"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    if (heading) {
      const strong = heading.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1];
      round = text(strong ?? heading.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "")) || round;
    }

    const pstCode = block.match(/setview\(\s*(\d+)\s*\)/i)?.[1] ?? null;
    if (!pstCode) continue;

    const noLabel = block.match(/class="no_order[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const matchNo = text(noLabel).replace(/^No\s*/i, "").trim();

    const stamp = [...block.matchAll(/<span class="t14"[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((item) => text(item[1]))
      .find((value) => TIMESTAMP.test(value));
    const scheduledAt = stamp ?? null;

    const sides: HistorySide[] = [];
    for (const item of block.split(/<li\b/i).slice(1)) {
      if (!/class="t_set"/i.test(item)) continue;
      const name = span(item, "t_name");
      if (!name) continue;
      // The column heading row is a list item too. A real player row is the
      // only one whose set cell is a count.
      const sets = number(span(item, "t_set"));
      if (sets === null) continue;
      sides.push({
        name,
        memCode: null,
        sets,
        average: number(span(item, "t_avg")),
        highRun: number(span(item, "t_high")),
        won: /class="icon_win"/i.test(item),
      });
    }

    if (sides.length === 0) continue;

    // matchlayer names the two players in row order.
    const members = [...block.matchAll(/matchlayer\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/gi)][0];
    if (members) {
      [members[1], members[2]].forEach((code, index) => {
        if (sides[index]) sides[index].memCode = code || null;
      });
    }

    matches.push({
      pstCode,
      matchNo: matchNo || "—",
      round,
      scheduledAt,
      sides,
    });
  }

  return matches;
}
