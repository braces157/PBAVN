/**
 * Team-league fixtures and bouts from the terminal at team.pbatour.org.
 *
 * Four endpoints, all legacy ASP on a plain-HTTP host, all answered by
 * `fetchTeamFragment` (whose in-process cache is the primary path, since
 * POSTs never reach Next's data cache). Parsing lives in
 * `./team-matches-parse`, which has no imports; this module only moves bytes.
 *
 *   POST /mob/code_behind/getPlanDetailEnd_new2.asp   one round's fixtures
 *   POST /mob/code_behind/getPlanResult_new.asp       one fixture's bouts
 *   GET  /mob/ko/planResultDetail.asp?TGCode=         one bout's TPT codes
 *   POST /mob/code_behind/getPlanResultDetail.asp     one bout's innings JSON
 *
 * `RoundNumber` must be the display string "N Round"; a bare number answers
 * "no such record", and an `LCTCode` parameter, even empty, empties the reply.
 */

import { fetchTeamFragment } from "./http";
import {
  parseFixtureBouts,
  parseInnings,
  parseRoundFixtures,
  parseTptCodes,
  type BoutInnings,
  type FixtureBouts,
  type TeamFixture,
} from "./team-matches-parse";

export type {
  Bout,
  BoutInnings,
  BoutSide,
  FixtureBouts,
  FixtureSide,
  InningSide,
  TeamFixture,
} from "./team-matches-parse";
export {
  parseFixtureBouts,
  parseInnings,
  parseRoundFixtures,
  parseTptCodes,
} from "./team-matches-parse";

/** A finished round changes rarely; the round in play is re-read within the minute. */
const ARCHIVE = 1_800;
const IN_PLAY = 60;

export { ARCHIVE as FIXTURES_ARCHIVE_TTL, IN_PLAY as FIXTURES_IN_PLAY_TTL };

/** The innings chain is a closed record once a bout has finished. */
const SHEET = 3_600;

function formBody(pairs: [string, string][]): string {
  // `RoundNumber` encodes as "3%20Round", which is exactly the form the
  // terminal's own front end posts.
  return pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

export async function getRoundFixtures(
  roundCode: string,
  roundNumber: number,
  revalidate = ARCHIVE,
): Promise<TeamFixture[]> {
  if (!/^\d+$/.test(roundCode) || !Number.isFinite(roundNumber)) return [];

  const body = formBody([
    ["RoundCode", roundCode],
    ["RoundNumber", `${roundNumber} Round`],
    ["LangCode", "en"],
  ]);
  const html = await fetchTeamFragment("/mob/code_behind/getPlanDetailEnd_new2.asp", {
    method: "POST",
    body,
    revalidate,
    timeoutMs: 20_000,
  });
  return parseRoundFixtures(html);
}

export async function getFixtureBouts(
  roundCode: string,
  roundNumber: number,
  gameNo: string,
  revalidate = ARCHIVE,
): Promise<FixtureBouts | null> {
  if (!/^\d+$/.test(roundCode) || !/^\d+$/.test(gameNo) || !Number.isFinite(roundNumber)) {
    return null;
  }

  const body = formBody([
    ["RoundCode", roundCode],
    ["RoundNumber", `${roundNumber} Round`],
    ["TeamGameNO", gameNo],
    ["LangCode", "en"],
  ]);
  const html = await fetchTeamFragment("/mob/code_behind/getPlanResult_new.asp", {
    method: "POST",
    body,
    revalidate,
    timeoutMs: 20_000,
  });
  return parseFixtureBouts(html);
}

/**
 * One bout's per-inning chain: the detail page names the two TPT codes, the
 * JSON endpoint answers with the innings. `null` covers both a bout with no
 * record sheet yet (upstream publishes TGCodes only once a bout is finished)
 * and a transport failure — the caller renders the no-sheet note either way,
 * and only the transport case lands in the partial-data notice.
 */
export async function getBoutInnings(tgCode: string | null): Promise<BoutInnings | null> {
  if (!tgCode || !/^\d+$/.test(tgCode)) return null;

  const page = await fetchTeamFragment(
    `/mob/ko/planResultDetail.asp?TGCode=${encodeURIComponent(tgCode)}`,
    { method: "GET", revalidate: SHEET, timeoutMs: 20_000 },
  );
  const codes = parseTptCodes(page);
  if (!codes) return null;

  const json = await fetchTeamFragment("/mob/code_behind/getPlanResultDetail.asp", {
    method: "POST",
    body: `TPTCode1=${encodeURIComponent(codes.tptCode1)}&TPTCode2=${encodeURIComponent(codes.tptCode2)}`,
    revalidate: SHEET,
    timeoutMs: 20_000,
  });
  if (!json) return null;
  return parseInnings(json);
}
