/**
 * The live match centre.
 *
 * Two circuits publish "what is on the table right now", on two different
 * hosts, and an earlier version of this module only knew about one of them:
 *
 *   PBA / LPBA tours   app.pbatour.org live board → scorecards by PSTCode
 *   Team League        team.pbatour.org/mob/ko/live.asp → a fixture block with
 *                      club names, sets won, the points in the set being played,
 *                      the player on the table and the broadcast link
 *
 * The tour board answers an empty fragment for a team-league round, so a site
 * that reads only that board reports "no match in play" while a franchise
 * fixture is running. Both surfaces are therefore read, and whichever has a
 * match supplies the feed. The result is a single list of `LiveMatch`, so the
 * board component does not need to know which host answered.
 *
 * Nothing is inferred: a side that the terminal has not named stays unnamed, and
 * a score the page did not publish is null rather than zero.
 */

import { IN_PLAY, getLiveBoard, getScorecard } from "./scoreboard";
import { fetchTeamFragment } from "./http";
import { parseLiveTeamFixtures, type LiveBout, type LiveTeamFixture } from "./team-live-parse";
import { getPlayerNameIndex, resolveKoreanName } from "./service";
import { analyseSet } from "../match";
import type { AnalysedSet } from "../match";

export interface LiveSide {
  name: string;
  setsWon: number;
  /** Points in the latest set on the table. */
  points: number | null;
  innings: number | null;
  average?: number | null;
  highRun?: number | null;
  logo?: string | null;
}

/** Which feed answered, so the page can say where the numbers come from. */
export type LiveSource = "tour-terminal" | "team-terminal" | "none";

export interface LiveMatch {
  /** A stable key for lists: the scorecard code, or a team fixture identifier. */
  key: string;
  /** The scorecard code for a tour match; empty for a team fixture. */
  pstCode: string;
  watchUrl: string | null;
  sides: LiveSide[];
  /** The set being played, when the feed says which one. */
  latestSet: { setNo: number; gameType: string | null; target: number | null };
  /** Completed sets, oldest first, as points per side. */
  completedSets: number[][];
  /** "Team League" when the fixture came from the team terminal. */
  competition?: string;
  venue?: string | null;
  /** The player (or doubles pair) on the table for each side, when published. */
  players?: (string | null)[];
  /**
   * Games won so far, for a match scored as a series of bouts (a team fixture).
   * Absent for an individual match, whose `setsWon` already is that figure.
   */
  fixtureScore?: number[];
  /** Every bout of a team fixture the terminal lists, newest first. */
  bouts?: LiveBout[];
}

export interface LiveFeed {
  available: boolean;
  matches: LiveMatch[];
  /**
   * False when neither board answered at all. An unreachable scoreboard is not
   * an idle one, and the UI must not print "no match in play" for it.
   */
  reachable: boolean;
  /** Raw text of the tour board, used only when nothing could be read from it. */
  lines: string[];
  fetchedAt: string;
  source: string;
  /** Which surface the matches came from. */
  origin: LiveSource;
}

/** Enough to cover a multi-table session without hammering the terminal. */
const MAX_MATCHES = 4;

function toLiveMatch(
  pstCode: string,
  watchUrl: string | null,
  analysed: AnalysedSet[],
): LiveMatch | null {
  if (analysed.length === 0) return null;

  const latest = analysed[analysed.length - 1];
  const won = analysed.reduce<number[]>((acc, set) => {
    set.sides.forEach((side) => {
      if (side.won) acc[side.index] = (acc[side.index] ?? 0) + 1;
    });
    return acc;
  }, []);

  return {
    key: `match-${pstCode}`,
    pstCode,
    watchUrl,
    sides: latest.sides.map((side, index) => ({
      name: side.name,
      setsWon: won[index] ?? 0,
      points: side.points,
      innings: side.innings,
    })),
    latestSet: { setNo: latest.setNo, gameType: latest.gameType, target: latest.target },
    completedSets: analysed.slice(0, -1).map((set) => set.sides.map((side) => side.points)),
  };
}

/** A team-league live fixture as the same shape a tour scorecard produces. */
function teamFixtureToLiveMatch(
  fixture: LiveTeamFixture,
  clubs: ClubIndex,
  playerNames: Map<string, string>,
): LiveMatch {
  return {
    key: `team-${fixture.sides.map((side) => side.clubCode ?? side.nameKo).join("-")}-${fixture.setNo ?? 0}`,
    pstCode: "",
    watchUrl: fixture.watchUrl,
    sides: fixture.sides.map((side) => ({
      // The team terminal names clubs in Korean, and its club ids (`25501`) are a
      // different key space from the standings' `T000xx`. The logo file name
      // carries the standings code, so that is the join when there is one; the
      // published Korean name is the fallback, never a guess.
      name: clubs.nameFor(side.nameKo, side.logo) ?? side.nameKo,
      setsWon: side.sets ?? 0,
      points: side.points,
      innings: fixture.innings,
      average: side.average,
      highRun: side.highRun,
      logo: side.logo,
    })),
    // A team fixture is scored over six bouts, and this is the bout on the table.
    latestSet: { setNo: fixture.setNo ?? 0, gameType: null, target: null },
    // What the scoreboard's right-hand column shows: games won so far. The set
    // counts below are individual bouts and would read as 0–0 at the start of
    // every bout, which is not the state of the fixture.
    fixtureScore: fixture.sides.map((side) => side.sets ?? 0),
    completedSets: [],
    competition: "Team League",
    venue: fixture.venue,
    players: fixture.sides.map((side) => (side.player ? resolveKoreanName(side.player, playerNames) : null)),
    bouts: fixture.bouts.map((bout) => ({
      ...bout,
      // A doubles pair arrives as one string ("김재근,임정숙"); each name is
      // translated on its own so the separator survives.
      sides: bout.sides.map((side) => ({
        ...side,
        name: side.name
          .split(",")
          .map((part) => resolveKoreanName(part.trim(), playerNames))
          .join(", "),
      })),
    })),
  };
}

interface ClubIndex {
  /** English name for a club, matched on its standings code or its Korean name. */
  nameFor: (koreanName: string, logo: string | null) => string | null;
}

/**
 * How the live page's clubs map onto the site's English club names.
 *
 * Three hops, because no single feed carries both spellings:
 *
 *   1. the live page publishes a Korean club name and, for some clubs, a logo
 *      file whose name carries the standings code (`T00020_LOGO_300.png`);
 *   2. the Korean standings table maps that Korean name to its `T000xx` code;
 *   3. the English standings table (the site's ordinary read) maps the code to
 *      the English name it already prints in every table.
 *
 * A club that cannot be traced through all three keeps the name the live page
 * published. Nothing is guessed from a similarity.
 */
async function clubIndex(): Promise<ClubIndex> {
  const englishByCode = new Map<string, string>();
  const codeByKorean = new Map<string, string>();
  try {
    const { getTeamLeagueRounds, getTeamLeagueSeasons, getTeamStandings, getTeamStandingsKorean } =
      await import("./api");

    const seasons = await getTeamLeagueSeasons();
    const season = seasons[0];
    if (!season) throw new Error("no team season");

    const rounds = await getTeamLeagueRounds(season.리그코드);
    const ordered = [
      ...rounds.filter((round) => round.진행상황 === "진행중"),
      ...rounds.filter((round) => round.진행상황 !== "진행중").reverse(),
    ].slice(0, 2);

    for (const round of ordered) {
      const roundCode = String(round.라운드코드);
      const [english, korean] = await Promise.all([
        getTeamStandings({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
        getTeamStandingsKorean({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
      ]);

      for (const raw of english) {
        const code = (raw.팀코드 ?? "").toUpperCase();
        if (code) englishByCode.set(code, (raw.팀단축명 || raw.이름 || "").trim());
      }
      for (const raw of korean) {
        const code = (raw.팀코드 ?? "").toUpperCase();
        if (!code) continue;
        for (const spelling of [raw.이름, raw.팀단축명]) {
          const korean2 = (spelling ?? "").trim();
          if (korean2) codeByKorean.set(korean2, code);
        }
      }
      if (englishByCode.size > 0) break;
    }
  } catch {
    // An unreachable standings read leaves the published Korean names in place.
  }

  return {
    nameFor(koreanName, logo) {
      const logoCode = logo ? /T\d{5}/i.exec(logo)?.[0]?.toUpperCase() : null;
      const code = logoCode && englishByCode.has(logoCode) ? logoCode : codeByKorean.get(koreanName) ?? null;
      const english = code ? englishByCode.get(code) : null;
      return english || null;
    },
  };
}

/**
 * Korean → English for everyone on a team-league scoresheet.
 *
 * Two sources, because they cover different people: the committed directory
 * index holds the PBA members (1,700 names, no network), and the team-league
 * roster feed holds the club squads — which is where the LPBA players on a
 * doubles pairing are found. The index wins where it already knows the name, so
 * a PBA member keeps the spelling the rest of the site prints.
 */
async function teamPlayerNames(): Promise<Map<string, string>> {
  const index = getPlayerNameIndex();
  try {
    const { getTeamLeagueSeasons, getTeamPlayerStats } = await import("./api");
    const seasons = await getTeamLeagueSeasons();
    const season = seasons[0];
    if (!season) return index;
    const rows = await getTeamPlayerStats({
      seasonCode: season.시즌코드,
      leagueCode: String(season.리그코드),
      roundCode: "0",
    });
    for (const row of rows) {
      const korean = (row.외국이름 ?? "").trim();
      const english = (row.이름 ?? "").trim();
      if (korean && english && !index.has(korean)) index.set(korean, english);
    }
  } catch {
    // A missing roster leaves the names as published.
  }
  return index;
}

/** What the team terminal is publishing right now, if anything. */
async function getTeamLive(): Promise<{ matches: LiveMatch[]; reachable: boolean }> {
  const html = await fetchTeamFragment("/mob/ko/live.asp", {
    method: "GET",
    revalidate: 20,
    timeoutMs: 10_000,
  });
  if (html === null) return { matches: [], reachable: false };
  const fixtures = parseLiveTeamFixtures(html);
  if (fixtures.length === 0) return { matches: [], reachable: true };

  const [clubs, players] = await Promise.all([clubIndex(), teamPlayerNames()]);
  return {
    matches: fixtures.slice(0, MAX_MATCHES).map((fixture) => teamFixtureToLiveMatch(fixture, clubs, players)),
    reachable: true,
  };
}

export async function getLiveFeed(tourCode = ""): Promise<LiveFeed> {
  // Both surfaces are read together: which one has a match is not known in
  // advance, and they cost one request each.
  const [board, team] = await Promise.all([getLiveBoard(tourCode), getTeamLive()]);

  const selected = board.refs.slice(0, MAX_MATCHES);
  const tourMatches = (
    await Promise.all(
      selected.map(async (ref) => {
        const scorecard = await getScorecard(ref.pstCode, IN_PLAY);
        if (scorecard.sets.length === 0) return null;
        // Turn data is not fetched here: the list is polled every 20 seconds and
        // the scorecard already carries the set scores a live reader needs.
        return toLiveMatch(ref.pstCode, ref.watchUrl, scorecard.sets.map((set) => analyseSet(set, null)));
      }),
    )
  ).filter((match): match is LiveMatch => match !== null);

  const origin: LiveSource =
    tourMatches.length > 0 ? "tour-terminal" : team.matches.length > 0 ? "team-terminal" : "none";

  // Both terminals can answer at once; the label names every surface that has
  // matches on the wire, not just the first one.
  const surfaces = [
    ...(tourMatches.length > 0 ? ["app.pbatour.org scoring terminal"] : []),
    ...(team.matches.length > 0 ? ["team.pbatour.org live board"] : []),
  ];

  return {
    available: tourMatches.length > 0 || team.matches.length > 0,
    reachable: board.reachable || team.reachable,
    matches: [...tourMatches, ...team.matches],
    lines: board.lines.slice(0, 40),
    fetchedAt: new Date().toISOString(),
    source: surfaces.length > 0 ? surfaces.join(" + ") : "app.pbatour.org scoring terminal",
    origin,
  };
}
