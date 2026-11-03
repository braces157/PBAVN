/**
 * Pure parser for the scoring terminal's bracket rows *as dated records*.
 *
 * This is not a second copy of `./bracket-parse`. That one reads the English
 * response, which is the right thing for an event page — Latin names, and the
 * page already knows the event's dates. This one reads the Korean response,
 * which is the only variant that publishes each match's full **date**, and turns
 * each row into "who played, when, and who won" so a screen can ask the one
 * question that variant is needed for: which matches happened on this day.
 *
 * Names therefore arrive in Korean. `./matches-on-day` replaces them with the
 * Latin names from the English response, joined on the match code; this file
 * stays free of imports so the markup contract is testable offline, the same way
 * `bracket-parse` is.
 *
 * A row looks like this (whitespace trimmed):
 *
 *   <div class="set_box">
 *     <span class="no_order t15">No 127</span>
 *     <span class="t14">T1</span> |
 *     <span class="t14">26-10-27 00:08</span>
 *     ...javascript:setview(98885);...
 *     <ul class="win_lost_block01_set">
 *       <li class="player_end">
 *         <span class="t_order"><span class="icon_lost">&nbsp;</span></span>
 *         <span class="t_name">…img…몬테스</span>
 *         <span class="t_set">2</span>
 *         <span class="t_avg">1.227</span>
 *         <span class="t_high">4</span>
 *       </li>
 *       …
 */

export interface DatedSide {
  /** Korean display name as the terminal publishes it ("몬테스", "조건휘"). */
  nameKo: string;
  memCode: string | null;
  sets: number | null;
  average: number | null;
  highRun: number | null;
  won: boolean;
}

export interface DatedMatch {
  pstCode: string;
  matchNo: string;
  table: string | null;
  /** The terminal's own stamp, `YY-MM-DD HH:MM`, already normalised to `YYYY-MM-DD HH:MM`. */
  at: string | null;
  /** `YYYY-MM-DD`, derived from `at`. */
  day: string | null;
  round: string;
  bracketSize: number;
  sides: DatedSide[];
}

const ROUNDS: Record<number, string> = {
  2: "Final",
  4: "Semi-final",
  8: "Quarter-final",
  16: "Round of 16",
  32: "Round of 32",
  64: "Round of 64",
  128: "Round of 128",
};

export function roundName(bracketSize: number): string {
  return ROUNDS[bracketSize] ?? `Bracket of ${bracketSize}`;
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

function number(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.\-]/g, "");
  if (digits === "" || digits === "-" || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `26-10-27 00:08` and its four-digit-year cousin → `2026-10-27 00:08`. */
const STAMP = /^(?:(\d{2})|(\d{4}))-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/;

export function normaliseStamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = STAMP.exec(value.trim());
  if (!match) return null;
  const [, twoDigitYear, fourDigitYear, month, day, hour, minute] = match;
  const year = twoDigitYear ? 2000 + Number(twoDigitYear) : Number(fourDigitYear);
  return `${year}-${month}-${day} ${hour.padStart(2, "0")}:${minute}`;
}

/** Extract one span's text by class name, without matching a nested sibling. */
function span(item: string, className: string): string | null {
  const match = item.match(new RegExp(`class="t_${className}"[^>]*>([\\s\\S]*?)</span>`, "i"));
  return match ? text(match[1]) : null;
}

export function parseDatedBracketRows(html: string | null, bracketSize: number): DatedMatch[] {
  if (!html) return [];

  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const matches: DatedMatch[] = [];

  for (const block of clean.split(/<div class="set_box">/i).slice(1)) {
    const pstCode = block.match(/setview\(\s*(\d+)\s*\)/i)?.[1] ?? null;
    if (!pstCode) continue;

    const matchNo = text(
      block.match(/class="no_order[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "",
    ).replace(/^No\s*/i, "");

    const spans = [...block.matchAll(/<span class="t14"[^>]*>([\s\S]*?)<\/span>/gi)].map((match) =>
      text(match[1]),
    );
    const rawStamp = spans.map((value) => normaliseStamp(value)).find(Boolean) ?? null;
    // The table is the short token that is not the stamp and not the heading.
    const table = spans.find((value) => /^[A-Z]{0,2}\d{1,3}$/i.test(value)) ?? null;

    const members = block.match(/matchlayer\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/i);

    const sides: DatedSide[] = [];
    for (const item of block.split(/<li\b/i).slice(1)) {
      // A real side row carries the result marker; the heading row does not.
      if (!/class="t_(name|set)"/i.test(item) || !/class="t_order"/i.test(item)) continue;
      const nameKo = span(item, "name");
      const sets = number(span(item, "set"));
      if (!nameKo || /^player$/i.test(nameKo) || sets === null) continue;
      sides.push({
        nameKo,
        memCode: null,
        sets,
        average: number(span(item, "avg")),
        highRun: number(span(item, "high")),
        won: /class="icon_win"/i.test(item),
      });
    }

    if (sides.length === 0) continue;

    if (members) {
      [members[1], members[2]].forEach((code, index) => {
        if (sides[index]) sides[index].memCode = code || null;
      });
    }

    matches.push({
      pstCode,
      matchNo: matchNo || "—",
      table,
      at: rawStamp,
      day: rawStamp ? rawStamp.slice(0, 10) : null,
      round: roundName(bracketSize),
      bracketSize,
      sides,
    });
  }

  return matches;
}
