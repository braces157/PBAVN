/**
 * Per-match scorecard from the association's scoring terminal.
 *
 * The tour API (`./api`) publishes results in aggregate: sets won, average,
 * high run. The record of what actually happened on the table lives in the live
 * scoring system, a legacy ASP application on `app.pbatour.org` that answers
 * with HTML fragments rather than JSON:
 *
 *   /mob/contest_new/admin_en/live_info_setview.asp?PSTCode=     match page
 *   /mob/contest_new/code_behind/contest_result_set_record.asp   one set
 *   /mob/contest_new/code_behind/contest_result_set_help.asp     match totals
 *   /mob/contest_new/code_behind/live_info.asp?TourCode=         live board
 *
 * The match page embeds one `PCGMCode` per set, and the set endpoint answers
 * with one row per inning holding both players' 1-point and 2-point conversions
 * and their running score. That is the turn-by-turn record.
 *
 * Parsing lives in `./scoreboard-parse`, which has no imports so it can be
 * tested against saved markup. This module only moves bytes.
 */

import { fetchHtmlFragment } from "./http";
import {
  parseLiveBoard,
  parseScorecard,
  parseSetInnings,
  visibleLines,
  type LiveMatchRef,
  type Scorecard,
  type SetInnings,
} from "./scoreboard-parse";

export type {
  InningRow,
  InningSide,
  LiveMatchRef,
  MatchSet,
  MatchTotalRow,
  Scorecard,
  SetInnings,
  SetPlayer,
} from "./scoreboard-parse";

export {
  parseLiveBoard,
  parseScorecard,
  parseSetInnings,
  parseSets,
  parseTotals,
  visibleLines,
} from "./scoreboard-parse";

/** An archived match never changes once its set list is read. */
const ARCHIVE = 86_400;
/** A match still on the table can change between reads. */
const IN_PLAY = 30;
/** The live board itself. */
const LIVE = 10;

const EMPTY_SCORECARD = (pstCode: string): Scorecard => ({ pstCode, sets: [], totals: [] });
const EMPTY_INNINGS: SetInnings = { players: [], breaker: null, rows: [] };

/**
 * `revalidate` is a parameter rather than a constant because the same read
 * serves two very different callers: an archived match card, and the live
 * board, which is polled every twenty seconds.
 */
export async function getScorecard(pstCode: string, revalidate = ARCHIVE): Promise<Scorecard> {
  if (!/^\d+$/.test(pstCode)) return EMPTY_SCORECARD(pstCode);

  const [matchHtml, totalsHtml] = await Promise.all([
    fetchHtmlFragment(
      `/mob/contest_new/admin_en/live_info_setview.asp?PSTCode=${encodeURIComponent(pstCode)}&LangCode=en`,
      { revalidate, timeoutMs: 15_000 },
    ),
    fetchHtmlFragment(
      `/mob/contest_new/code_behind/contest_result_set_help.asp?PSTCode=${encodeURIComponent(pstCode)}&LangCode=en`,
      { revalidate, timeoutMs: 12_000 },
    ),
  ]);

  return parseScorecard(matchHtml, totalsHtml, pstCode);
}

export async function getSetInnings(
  pcgmCode: string | null,
  revalidate = ARCHIVE,
): Promise<SetInnings> {
  if (!pcgmCode || !/^\d+$/.test(pcgmCode)) return EMPTY_INNINGS;
  const html = await fetchHtmlFragment(
    `/mob/contest_new/code_behind/contest_result_set_record.asp?PCGMCode=${encodeURIComponent(pcgmCode)}&LangCode=en`,
    { revalidate, timeoutMs: 12_000 },
  );
  return parseSetInnings(html);
}

/** The live board: the matches in play, plus the fragment's own text. */
export interface LiveBoard {
  refs: LiveMatchRef[];
  lines: string[];
  /** False when the board did not answer at all, which is not the same as idle. */
  reachable: boolean;
}

export async function getLiveBoard(tourCode = ""): Promise<LiveBoard> {
  const html = await fetchHtmlFragment(
    `/mob/contest_new/code_behind/live_info.asp?TourCode=${encodeURIComponent(tourCode)}&LangCode=en`,
    { revalidate: LIVE, timeoutMs: 7_000 },
  );
  return { refs: parseLiveBoard(html), lines: visibleLines(html), reachable: html !== null };
}

export { IN_PLAY };
