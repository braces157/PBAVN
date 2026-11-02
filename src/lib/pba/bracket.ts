/**
 * Event brackets: every match in a tournament, with a way into its card.
 *
 * The scoring terminal renders one row per drawn match, grouped by bracket
 * depth, and each row carries the match code that opens the turn-by-turn card:
 *
 *   GET /mob/contest_new/code_behind/contest_result_sur.asp
 *       ?TourCode=&iBLCode=<bracket size>&iPage=1&txt_Search=
 *
 * `iBLCode` is the bracket size (2 final, 4 semi-final, 8 quarter-final, and so
 * on), twenty rows to a page, and `txt_Search` must be present or the service
 * refuses the request. Rows are the only place the tour API and the scoring
 * terminal meet: the tour code comes from the schedule feed, the match code
 * only exists here.
 */

import { fetchHtmlFragment } from "./http";
import { parseBracketRows, type BracketMatch } from "./bracket-parse";

export type { BracketMatch, BracketSide } from "./bracket-parse";
export { parseBracketRows, bracketRound } from "./bracket-parse";

/** Deepest bracket the association has run. */
export const BRACKET_SIZES = [128, 64, 32, 16, 8, 4, 2] as const;

/** A bracket page holds twenty rows. */
const PAGE_SIZE = 20;
/** How far to page within one bracket before giving up on a partial event. */
const MAX_PAGES = 8;

/** Finished events change rarely; a live one is re-read within minutes. */
const REVALIDATE = 600;

async function fetchBracketPage(
  tourCode: string,
  bracketSize: number,
  page: number,
): Promise<BracketMatch[]> {
  const html = await fetchHtmlFragment(
    // `LangCode=en` publishes player names in Latin script. `txt_Search` must be
    // present even when empty or the service refuses the request.
    `/mob/contest_new/code_behind/contest_result_sur.asp?TourCode=${encodeURIComponent(tourCode)}&iBLCode=${bracketSize}&iPage=${page}&txt_Search=&LangCode=en`,
    { revalidate: REVALIDATE, timeoutMs: 12_000 },
  );
  return parseBracketRows(html, bracketSize);
}

/** One bracket, paged until a short page or the page cap. */
async function fetchBracket(tourCode: string, bracketSize: number): Promise<BracketMatch[]> {
  const first = await fetchBracketPage(tourCode, bracketSize, 1);
  if (first.length < PAGE_SIZE) return first;

  const matches = [...first];
  for (let page = 2; page <= MAX_PAGES; page += 1) {
    const next = await fetchBracketPage(tourCode, bracketSize, page);
    matches.push(...next);
    if (next.length < PAGE_SIZE) break;
  }
  return matches;
}

/**
 * Every match of an event, final first.
 *
 * The final is the match people came for, so the deepest bracket is listed
 * last rather than first. A bracket that never ran answers with no rows, so
 * nothing has to be guessed about which depths an event used. One upstream
 * request per bracket page, all sizes fanned out together, cached for ten
 * minutes.
 */
export async function getEventMatches(tourCode: string): Promise<BracketMatch[]> {
  if (!/^\d+$/.test(tourCode)) return [];

  const bySize = await Promise.all(BRACKET_SIZES.map((size) => fetchBracket(tourCode, size)));

  return bySize
    .flat()
    .sort((a, b) => {
      if (a.bracketSize !== b.bracketSize) return a.bracketSize - b.bracketSize;
      return a.matchNo.localeCompare(b.matchNo, "en", { numeric: true });
    });
}
