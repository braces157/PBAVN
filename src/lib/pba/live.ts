/**
 * The live match centre.
 *
 * The live board is a legacy ASP fragment that answers with the CSS-only shell
 * whenever no table is being scored, which is the common case. When something
 * is on, it links to the scorecard of each match in play, and that link is the
 * only thing taken from it. Each match is then read from the same scorecard the
 * match page uses, so the live list and the archive cannot disagree.
 *
 * The fragment's own text is kept alongside, so a board we cannot read
 * structurally is shown as it arrived rather than replaced by an empty state.
 */

import { IN_PLAY, getLiveBoard, getScorecard } from "./scoreboard";
import { analyseSet } from "../match";
import type { AnalysedSet } from "../match";

export interface LiveSide {
  name: string;
  setsWon: number;
  /** Points in the latest set on the table. */
  points: number;
  innings: number;
}

export interface LiveMatch {
  pstCode: string;
  watchUrl: string | null;
  sides: LiveSide[];
  /** The most recent set the scorecard lists, which is the one being played. */
  latestSet: { setNo: number; gameType: string | null; target: number | null };
  /** Completed sets, oldest first, as points per side. */
  completedSets: number[][];
}

export interface LiveFeed {
  available: boolean;
  matches: LiveMatch[];
  /**
   * False when the board did not answer at all. An unreachable scoreboard is
   * not an idle one, and the UI must not print "no match in play" for it.
   */
  reachable: boolean;
  /** Raw text of the board, used only when nothing could be read from it. */
  lines: string[];
  fetchedAt: string;
  source: string;
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

export async function getLiveFeed(tourCode = ""): Promise<LiveFeed> {
  const board = await getLiveBoard(tourCode);
  const selected = board.refs.slice(0, MAX_MATCHES);

  const matches = (
    await Promise.all(
      selected.map(async (ref) => {
        const scorecard = await getScorecard(ref.pstCode, IN_PLAY);
        if (scorecard.sets.length === 0) return null;
        // Turn data is not fetched here: the list is polled every 20 seconds and
        // the scorecard already carries the set scores a live reader needs. The
        // card behind the link has every turn.
        return toLiveMatch(ref.pstCode, ref.watchUrl, scorecard.sets.map((set) => analyseSet(set, null)));
      }),
    )
  ).filter((match): match is LiveMatch => match !== null);

  return {
    available: board.refs.length > 0,
    reachable: board.reachable,
    matches,
    lines: board.lines.slice(0, 40),
    fetchedAt: new Date().toISOString(),
    source: "app.pbatour.org scoring terminal",
  };
}
