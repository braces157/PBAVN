/**
 * Pure parser for the scoring terminal's bracket rows.
 *
 * No imports, so the markup contract is testable on its own. `./bracket` adds
 * the transport.
 */

export interface BracketSide {
  name: string;
  /** Member code, when the row carries one. */
  memCode: string | null;
  /** Sets won in the match. */
  sets: number | null;
  average: number | null;
  highRun: number | null;
  won: boolean;
}

export interface BracketMatch {
  pstCode: string;
  matchNo: string;
  /** Table the match was assigned to. */
  table: string | null;
  /** Published as `YY-MM-DD HH:MM`, in the association's local time. */
  scheduledAt: string | null;
  round: string;
  bracketSize: number;
  sides: BracketSide[];
}

const ROUNDS: Record<number, string> = {
  2: "Final",
  4: "Semi-final",
  8: "Quarter-final",
  16: "Round of 16",
  32: "Round of 32",
  64: "Round of 64",
  128: "Round of 128",
  256: "Round of 256",
};

/** The round a bracket depth represents. */
export function bracketRound(bracketSize: number): string {
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

/**
 * Rows from one bracket page.
 *
 * `bracketSize` is passed in rather than read from the markup: the round is a
 * property of the request, and the on-page label is a Korean abbreviation
 * ("결승", "32R") that would need translating.
 */
export function parseBracketRows(html: string | null, bracketSize: number): BracketMatch[] {
  if (!html) return [];

  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ");

  const matches: BracketMatch[] = [];

  for (const block of clean.split(/<div class="set_box">/i).slice(1)) {
    const pstCode = block.match(/setview\(\s*(\d+)\s*\)/i)?.[1] ?? null;
    if (!pstCode) continue;

    const noLabel = block.match(/class="no_order[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const matchNo = text(noLabel).replace(/^No\s*/i, "").trim();

    // The table and the kickoff are both plain `t14` spans; the kickoff is the
    // one that looks like a timestamp.
    const spans = [...block.matchAll(/<span class="t14"[^>]*>([\s\S]*?)<\/span>/gi)].map((match) =>
      text(match[1]),
    );
    const scheduledAt = spans.find((value) => /^\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(value)) ?? null;
    const table = spans.find((value) => /^[A-Z]{0,2}\d{1,3}$/i.test(value)) ?? null;

    const members = [...block.matchAll(/matchlayer\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/gi)][0];

    const sides: BracketSide[] = [];
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

    if (members) {
      // matchlayer names the two players in row order.
      [members[1], members[2]].forEach((code, index) => {
        if (sides[index]) sides[index].memCode = code || null;
      });
    }

    matches.push({
      pstCode,
      matchNo: matchNo || "—",
      table,
      scheduledAt,
      round: bracketRound(bracketSize),
      bracketSize,
      sides,
    });
  }

  return matches;
}
