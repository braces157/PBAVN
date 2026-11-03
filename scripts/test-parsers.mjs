// Parser tests for the scoring-terminal boundary.
//
//   npm run test:parsers
//
// Runs the TypeScript parsers directly (node strips the types) against real
// upstream HTML saved under research/fixtures. The fixtures are the contract:
// if the association changes its markup, this fails before a page renders a
// wrong score.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import {
  parseScorecard,
  parseSetInnings,
  parseSets,
  parseTotals,
  parseLiveBoard,
} from "../src/lib/pba/scoreboard-parse.ts";
import { bracketRound, parseBracketRows } from "../src/lib/pba/bracket-parse.ts";
import { parseSearchRows } from "../src/lib/pba/search-parse.ts";
import {
  parseFixtureBouts,
  parseInnings,
  parseRoundFixtures,
  parseTptCodes,
} from "../src/lib/pba/team-matches-parse.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const fixture = (name) => readFileSync(join(here, "..", "tests", "fixtures", name), "utf8");

let passed = 0;
const failures = [];

function check(name, run) {
  try {
    run();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL  ${name}\n      ${String(error.message).split("\n")[0]}`);
  }
}

const scorecardHtml = fixture("match-68308.html");
const setHtml = fixture("set-139146.html");
const totalsHtml = fixture("totals-68308.html");

const scorecard = parseScorecard(scorecardHtml, totalsHtml, "68308");

check("match page yields every set", () => {
  assert.equal(scorecard.sets.length, 5);
});

check("a match page with no totals fragment still yields its sets", () => {
  assert.equal(parseScorecard(scorecardHtml, null, "68308").sets.length, 5);
  assert.deepEqual(parseScorecard(null, totalsHtml, "68308").totals.length > 0, true);
});

check("set parsing is independent of the totals fragment", () => {
  assert.deepEqual(parseSets(scorecardHtml), scorecard.sets);
});

check("set keeps its race format, date and set id", () => {
  const first = scorecard.sets[0];
  assert.equal(first.setNo, 1);
  assert.equal(first.gameType, "GP15");
  assert.equal(first.playedOn, "11-25");
  assert.equal(first.pcgmCode, "139146");
});

check("set order is published order, not document order", () => {
  assert.deepEqual(
    scorecard.sets.map((set) => set.setNo),
    [1, 2, 3, 4, 5],
  );
});

check("both players carry points, innings, average and high run", () => {
  const [first, second] = scorecard.sets[0].players;
  assert.equal(first.name, "황형범");
  assert.equal(first.points, 9);
  assert.equal(first.innings, 17);
  assert.equal(first.average, 0.529);
  assert.equal(first.highRun, 3);
  assert.equal(second.name, "김임권");
  assert.equal(second.points, 15);
  assert.equal(second.innings, 17);
  assert.equal(second.average, 0.882);
});

check("the set winner is the player who reached the race target", () => {
  const [first, second] = scorecard.sets[0].players;
  assert.equal(first.won, false);
  assert.equal(second.won, true);
  assert.equal(second.points, Number(scorecard.sets[0].gameType?.replace("GP", "")));
});

check("match totals are read as value, label, value", () => {
  const average = scorecard.totals.find((row) => row.label === "AVG");
  assert.ok(average, "no AVG row");
  assert.equal(average.left, "1.049");
  assert.equal(average.right, "1.366");
  const innings = scorecard.totals.find((row) => row.label === "이닝");
  assert.ok(innings, "no innings row");
  assert.equal(innings.left, "41");
});

check("match totals never include the player header row", () => {
  assert.ok(!scorecard.totals.some((row) => /^VS$/i.test(row.label)));
});

const innings = parseSetInnings(setHtml);

check("set record names both players and the breaker", () => {
  assert.deepEqual(innings.players, ["황형범", "김임권"]);
  assert.equal(innings.breaker, 0);
});

check("set record has one row per inning", () => {
  assert.ok(innings.rows.length >= 5, `only ${innings.rows.length} innings`);
  assert.deepEqual(
    innings.rows.map((row) => row.inning),
    Array.from({ length: innings.rows.length }, (_, index) => index + 1),
  );
});

check("first inning carries each player's 1P, 2P and score", () => {
  const [first] = innings.rows;
  assert.deepEqual(first.sides[0], { onePoint: 1, twoPoint: 0, total: 1 });
  assert.deepEqual(first.sides[1], { onePoint: 0, twoPoint: 0, total: 0 });
});

check("every inning splits into exactly two player groups", () => {
  for (const row of innings.rows) assert.equal(row.sides.length, 2);
});

check("running score never goes backwards", () => {
  for (const side of [0, 1]) {
    let previous = 0;
    for (const row of innings.rows) {
      assert.ok(
        row.sides[side].total >= previous,
        `side ${side} dropped from ${previous} to ${row.sides[side].total} at inning ${row.inning}`,
      );
      previous = row.sides[side].total;
    }
  }
});

check("innings reconcile with the set score on the match page", () => {
  const [first, second] = scorecard.sets[0].players;
  const last = innings.rows.at(-1);
  assert.equal(last.sides[0].total, first.points);
  assert.equal(last.sides[1].total, second.points);
});

check("per-inning points add up to the running score", () => {
  for (const side of [0, 1]) {
    let scored = 0;
    for (const row of innings.rows) {
      const cell = row.sides[side];
      scored += cell.onePoint + cell.twoPoint * 2;
      assert.ok(
        Math.abs(scored - cell.total) <= 1,
        `side ${side} inning ${row.inning}: ${scored} scored vs ${cell.total} published`,
      );
    }
  }
});

check("a missing response is an empty scorecard, not an exception", () => {
  assert.deepEqual(parseScorecard(null, null, "1"), { pstCode: "1", sets: [], totals: [] });
  assert.deepEqual(parseSetInnings(null), { players: [], breaker: null, rows: [] });
  assert.deepEqual(parseTotals(null), []);
  assert.deepEqual(parseLiveBoard(null), []);
});

check("a column heading is never mistaken for a player", () => {
  for (const set of scorecard.sets) {
    assert.equal(set.players.length, 2, `set ${set.setNo} has ${set.players.length} players`);
    for (const player of set.players) {
      assert.ok(player.points > 0, `set ${set.setNo} player "${player.name}" has no points`);
    }
  }
});

check("unrecognised markup yields nothing rather than a guess", () => {
  assert.deepEqual(parseScorecard("<html><body>maintenance</body></html>", "9").sets, []);
  assert.deepEqual(parseSetInnings("<table><tr><td>1</td></tr></table>").rows, []);
});

check("live board finds the scorecard link when a match is live", () => {
  const fragment = `<a href="#" onclick="javascript:setview(98885);">세트결과</a>`;
  assert.deepEqual(parseLiveBoard(fragment), [{ pstCode: "98885", watchUrl: null }]);
});

check("live board attaches a broadcast link to the match", () => {
  const fragment = `<a onclick="youTubeHelp('https://www.youtube.com/watch?v=abc123XYZ_');">LIVE</a>
    <a href="#" onclick="setview(41);">세트결과</a>`;
  const [match] = parseLiveBoard(fragment);
  assert.equal(match.pstCode, "41");
  assert.equal(match.watchUrl, "https://www.youtube.com/watch?v=abc123XYZ_");
});

check("live board finds a match whichever way the code is carried", () => {
  for (const fragment of [
    `<a href="/mob/contest_new/admin_en/live_info_setview.asp?PSTCode=4101">sheet</a>`,
    `<a href="#" onclick="setview(4101);">세트결과</a>`,
    `<li data-pstcode="4101">table 3</li>`,
  ]) {
    assert.deepEqual(
      parseLiveBoard(fragment).map((match) => match.pstCode),
      ["4101"],
      fragment,
    );
  }
});

check("the idle live board yields no matches", () => {
  assert.deepEqual(parseLiveBoard('<style>\n\t.pt5 { padding: 5px 1px !important; }\n</style>'), []);
});

/* --------------------------------------------------------------- brackets */

const final = parseBracketRows(fixture("bracket-final.html"), 2);
const lastSixteen = parseBracketRows(fixture("bracket-r16.html"), 16);
const englishFinal = parseBracketRows(fixture("bracket-english.html"), 2);

check("the English variant of the same page parses to the same shape", () => {
  assert.equal(englishFinal.length, 1);
  const names = englishFinal[0].sides.map((side) => side.name);
  // Production asks for LangCode=en, so names must survive in Latin script.
  assert.ok(names.every((name) => /^[\x20-\x7E]+$/.test(name)), names.join(", "));
  assert.equal(englishFinal[0].sides.filter((side) => side.won).length, 1);
  assert.ok(englishFinal[0].pstCode.length > 0);
});

check("a bracket row carries the match code that opens its card", () => {
  assert.equal(final.length, 1);
  assert.equal(final[0].pstCode, "68377");
  assert.equal(final[0].matchNo, "127");
  assert.equal(final[0].table, "T1");
  assert.equal(final[0].scheduledAt, "23-11-30 23:47");
  assert.equal(final[0].round, "Final");
});

check("both players come through with their member codes in row order", () => {
  const [loser, winner] = final[0].sides;
  assert.equal(loser.name, "레펀스");
  assert.equal(loser.memCode, "M0017156");
  assert.equal(loser.sets, 1);
  assert.equal(loser.average, 1.581);
  assert.equal(loser.highRun, 7);
  assert.equal(loser.won, false);
  assert.equal(winner.name, "조재호");
  assert.equal(winner.memCode, "M0017784");
  assert.equal(winner.sets, 4);
  assert.equal(winner.won, true);
});

check("a deeper bracket yields one row per drawn match", () => {
  assert.equal(lastSixteen.length, 8);
  assert.ok(lastSixteen.every((match) => match.sides.length === 2));
  assert.ok(lastSixteen.every((match) => match.round === "Round of 16"));
  assert.equal(new Set(lastSixteen.map((match) => match.pstCode)).size, lastSixteen.length);
});

check("every match in a bracket records exactly one winner", () => {
  for (const match of lastSixteen) {
    assert.equal(
      match.sides.filter((side) => side.won).length,
      1,
      `match ${match.matchNo} has ${match.sides.filter((side) => side.won).length} winners`,
    );
  }
});

check("a bracket heading is never mistaken for a player", () => {
  for (const match of [...final, ...lastSixteen]) {
    for (const side of match.sides) {
      assert.ok(side.name.length > 0);
      assert.notEqual(side.name, "Player");
      assert.notEqual(side.memCode, "");
    }
  }
});

check("a round is named from the bracket depth, not the Korean label", () => {
  assert.equal(bracketRound(2), "Final");
  assert.equal(bracketRound(4), "Semi-final");
  assert.equal(bracketRound(8), "Quarter-final");
  assert.equal(bracketRound(128), "Round of 128");
  assert.equal(bracketRound(3), "Bracket of 3");
});

check("a bracket that did not answer yields no matches", () => {
  assert.deepEqual(parseBracketRows(null, 8), []);
  assert.deepEqual(parseBracketRows("<html><body>maintenance</body></html>", 8), []);
});

/* ------------------------------------------------------------ name search */

const searchRows = parseSearchRows(fixture("search-tour271-cho.html"));

check("a name search yields every drawn match of the tour", () => {
  assert.equal(searchRows.length, 16);
});

check("search rows resolve their round from the tit_round headings", () => {
  assert.deepEqual(
    [...new Set(searchRows.map((row) => row.round))],
    ["Final", "Semifinal", "Round 8", "Round 16", "Round 32", "Round 64", "Round 128"],
  );
  assert.equal(searchRows[0].round, "Final");
  assert.equal(searchRows[3].round, "Round 16");
  assert.equal(searchRows[15].round, "Round 128");
});

check("search rows carry both member codes in row order", () => {
  assert.equal(searchRows[0].sides[0].memCode, "M0017111");
  assert.equal(searchRows[0].sides[1].memCode, "M0017113");
  for (const row of searchRows) {
    assert.equal(row.sides.length, 2, `match ${row.matchNo} has ${row.sides.length} sides`);
    for (const side of row.sides) {
      assert.match(side.memCode ?? "", /^M\d+$/, `${row.matchNo}: ${side.name} has no MemCode`);
    }
  }
});

check("every searched match records exactly one winner", () => {
  for (const row of searchRows) {
    assert.equal(
      row.sides.filter((side) => side.won).length,
      1,
      `match ${row.matchNo} has ${row.sides.filter((side) => side.won).length} winners`,
    );
  }
});

check("search rows keep the English names the terminal published", () => {
  for (const row of searchRows) {
    for (const side of row.sides) {
      assert.match(side.name, /^[\x20-\x7E]+$/, row.pstCode);
      assert.ok(side.name.length > 0);
    }
  }
});

check("a search row keeps its card code, match number and kickoff", () => {
  const first = searchRows[0];
  assert.equal(first.pstCode, "98885");
  assert.equal(first.matchNo, "127");
  assert.equal(first.scheduledAt, "00:08");
  const [winner, loser] = first.sides;
  assert.equal(winner.name, "KH Cho");
  assert.equal(winner.sets, 4);
  assert.equal(winner.average, 1.276);
  assert.equal(winner.highRun, 7);
  assert.equal(winner.won, true);
  assert.equal(loser.name, "Martinez");
  assert.equal(loser.sets, 3);
  assert.equal(loser.average, 1.316);
  assert.equal(loser.highRun, 11);
  assert.equal(loser.won, false);
});

check("an empty search body is zero rows, not a crash", () => {
  assert.deepEqual(parseSearchRows(""), []);
  assert.deepEqual(parseSearchRows(null), []);
  assert.deepEqual(parseSearchRows("<html><body>maintenance</body></html>"), []);
});

check("a row without its own heading inherits the round above it", () => {
  const fragment = `
    <div class="set_box">
      <div class="tit_round"><strong class="t18 number0">Quarter-final</strong></div>
      <div class="content_block_set">
        <span class="no_order">No 9</span>
        <a href="#" onclick="javascript:setview(101);">set</a>
        <a href="#" onclick="javascript:matchlayer('M01','M02');">h2h</a>
        <ul class="win_lost_block01_set">
          <li><span class="t_name">Player</span><span class="t_set">Set</span></li>
          <li><span class="t_name">A</span><span class="t_set">4</span><span class="icon_win">W</span></li>
          <li><span class="t_name">B</span><span class="t_set">2</span></li>
        </ul>
      </div>
    </div>
    <div class="set_box">
      <div class="content_block_set">
        <span class="no_order">No 8</span>
        <a href="#" onclick="javascript:setview(102);">set</a>
        <a href="#" onclick="javascript:matchlayer('M03','M04');">h2h</a>
        <ul class="win_lost_block01_set">
          <li><span class="t_name">C</span><span class="t_set">4</span><span class="icon_win">W</span></li>
          <li><span class="t_name">D</span><span class="t_set">1</span></li>
        </ul>
      </div>
    </div>`;
  const rows = parseSearchRows(fragment);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].round, "Quarter-final");
  assert.equal(rows[1].round, "Quarter-final");
  assert.equal(rows[1].pstCode, "102");
});

/* ------------------------------------------------------------ team league */

const playedRound = parseRoundFixtures(fixture("team-fixtures-93.html"));
const scheduledRound = parseRoundFixtures(fixture("team-fixtures-94-scheduled.html"));

check("a played round listing yields every fixture", () => {
  assert.equal(playedRound.length, 45);
  assert.ok(playedRound.every((fixture) => fixture.played));
});

check("a played fixture reads both clubs, their codes and their score columns", () => {
  const first = playedRound[0];
  assert.equal(first.gameNo, "1");
  assert.equal(first.playedAt, "2026-09-14 16:01");
  assert.equal(first.home.clubCode, "T00003");
  assert.equal(first.away.clubCode, "T00002");
  assert.equal(first.home.name, "CROWN HAITAI");
  assert.equal(first.home.sets, 4);
  assert.equal(first.home.average, 2.588);
  assert.equal(first.home.highRun, 11);
  assert.equal(first.home.draws, 0);
  assert.equal(first.home.losses, 0);
  assert.equal(first.home.won, true);
  assert.equal(first.away.sets, 0);
  assert.equal(first.away.average, 0.8);
  assert.equal(first.away.losses, 4);
  assert.equal(first.away.won, false);
});

check("a played round keeps every club code pair", () => {
  for (const fixture of playedRound) {
    assert.match(fixture.home.clubCode ?? "", /^T\d+$/, fixture.gameNo ?? "");
    assert.match(fixture.away.clubCode ?? "", /^T\d+$/, fixture.gameNo ?? "");
  }
});

check("the team column heading row is never a side", () => {
  for (const fixture of [...playedRound, ...scheduledRound]) {
    assert.notEqual(fixture.home.name, "Team");
    assert.notEqual(fixture.away.name, "Team");
    assert.ok(fixture.home.name.length > 0, JSON.stringify(fixture));
    assert.ok(fixture.away.name.length > 0, JSON.stringify(fixture));
  }
});

check("a scheduled block parses with a date, a game number and no score", () => {
  assert.equal(scheduledRound.length, 34);
  assert.ok(scheduledRound.every((fixture) => !fixture.played));
  const first = scheduledRound[0];
  assert.equal(first.gameNo, "6");
  assert.equal(first.playedAt, "2026-11-02 15:00");
  assert.equal(first.home.sets, null);
  assert.equal(first.home.average, null);
  assert.equal(first.home.won, false);
  assert.equal(first.away.sets, null);
});

check("a scheduled block accepts Korean club names and the no_order round label", () => {
  // `no_order` reads "4 Round" where a match number would sit on a played
  // block; the game number still comes from viewResult. Club names arrive in
  // Korean on scheduled blocks — display resolves them through club codes.
  assert.ok(scheduledRound.every((fixture) => /^\d+$/.test(fixture.gameNo ?? "")));
  assert.equal(scheduledRound[0].home.name, "에스와이");
  assert.equal(scheduledRound[0].away.name, "웰컴저축은행");
  assert.equal(scheduledRound[0].home.clubCode, "T00021");
  assert.equal(scheduledRound[0].away.clubCode, "T00002");
});

check("an unrecognised round listing yields no fixtures", () => {
  assert.deepEqual(parseRoundFixtures(null), []);
  assert.deepEqual(parseRoundFixtures("<html><body>maintenance</body></html>"), []);
});

const bouts38 = parseFixtureBouts(fixture("team-bouts-38.html"));

check("the bout fragment reads the score board", () => {
  assert.equal(bouts38.homeName, "하림 용가리즈");
  assert.equal(bouts38.awayName, "하나카드 하나페이");
  assert.match(bouts38.homeLogo ?? "", /T00029_LOGO/);
  assert.match(bouts38.awayLogo ?? "", /T00020_LOGO/);
  assert.equal(bouts38.homeSets, 2);
  assert.equal(bouts38.awaySets, 4);
  assert.equal(bouts38.homeAverage, 1.423);
  assert.equal(bouts38.awayAverage, 2.259);
  assert.equal(bouts38.homeHighRun, 12);
  assert.equal(bouts38.awayHighRun, 12);
  assert.equal(bouts38.winner, "away");
});

check("a played fixture carries one bout per set with its record sheet", () => {
  assert.equal(bouts38.bouts.length, 6);
  assert.deepEqual(
    bouts38.bouts.map((bout) => bout.setNo),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    bouts38.bouts.map((bout) => bout.tgCode),
    ["12657", "12658", "12659", "12660", "12661", "12662"],
  );
  const first = bouts38.bouts[0];
  assert.equal(first.format, "GP11");
  assert.equal(first.playedAt, "2026-09-18 21:06");
  assert.deepEqual(first.sides[0].names, ["P.응우옌", "쩐득민"]);
  assert.deepEqual(first.sides[1].names, ["초클루", "Q.응우옌"]);
  assert.equal(first.sides[0].points, 9);
  assert.equal(first.sides[0].innings, 7);
  assert.equal(first.sides[0].average, 1.286);
  assert.equal(first.sides[1].points, 11);
  assert.equal(first.sides[1].innings, 8);
  assert.equal(first.sides[1].won, true);
  assert.equal(first.sides[0].won, false);
});

check("every bout of a played fixture records exactly one winner", () => {
  for (const bout of bouts38.bouts) {
    assert.equal(
      bout.sides.filter((side) => side.won).length,
      1,
      `set ${bout.setNo}`,
    );
  }
});

check("a live fragment shows the running set with no record sheet", () => {
  const live = parseFixtureBouts(fixture("team-bouts-live.html"));
  assert.ok(live, "live fragment did not parse");
  assert.equal(live.bouts.length, 1);
  const running = live.bouts[0];
  assert.equal(running.setNo, 1);
  assert.equal(running.tgCode, null);
  assert.equal(running.format, "GP11");
  assert.equal(running.sides[0].points, 5);
  assert.equal(running.sides[0].innings, 3);
  assert.equal(live.winner, null);
});

check("an unrecognised bout fragment yields nothing rather than a guess", () => {
  assert.equal(parseFixtureBouts(null), null);
  assert.equal(parseFixtureBouts("<html><body>maintenance</body></html>"), null);
});

const tpt = parseTptCodes(fixture("team-bout-detail-12657.html"));

check("the detail page yields the two TPT codes and the last inning", () => {
  assert.equal(tpt.tptCode1, "25317");
  assert.equal(tpt.tptCode2, "25318");
  assert.equal(tpt.lastInning, 8);
});

check("a detail page without TPT variables yields nothing", () => {
  assert.equal(parseTptCodes(null), null);
  assert.equal(parseTptCodes("<html><body>no sheet here</body></html>"), null);
});

const boutInnings = parseInnings(fixture("team-innings-12657.json"));

check("the innings JSON rows to the longer side", () => {
  assert.equal(boutInnings.maxInnings, 8);
  assert.equal(boutInnings.rows.length, 8);
  assert.equal(boutInnings.rows[7].sides[0], null);
  assert.equal(boutInnings.rows[7].sides[1].total, 11);
});

check("the per-inning score and the running total stay distinct", () => {
  const third = boutInnings.rows[2].sides[0];
  assert.equal(third.score, 3);
  assert.equal(third.total, 5);
  assert.equal(third.onePoint, 3);
  assert.equal(third.twoPoint, 0);
});

check("the running total never decreases on either side", () => {
  for (const side of [0, 1]) {
    let previous = 0;
    for (const row of boutInnings.rows) {
      const cell = row.sides[side];
      if (!cell) continue;
      assert.ok(
        cell.total >= previous,
        `side ${side} dropped from ${previous} to ${cell.total} at inning ${row.inning}`,
      );
      previous = cell.total;
    }
  }
});

check("an unparseable innings answer yields an empty chain", () => {
  assert.deepEqual(parseInnings(null), { maxInnings: 0, rows: [] });
  assert.deepEqual(parseInnings("<html>oops</html>"), { maxInnings: 0, rows: [] });
  assert.deepEqual(parseInnings("{}"), { maxInnings: 0, rows: [] });
});

// A player profile falls back to an older season when the current one is empty.
// That fallback must not fire on an outage, or an unreachable feed is quoted as
// the previous season's figures. The two cases differ upstream: an empty season
// is an envelope with an empty list, an outage is no envelope at all. This test
// reads the page source, because the consequence lives in that branch — a local
// re-statement of the rule would pass even after the guard was deleted.
check("the season fallback is gated on the feed answering, not just on emptiness", () => {
  const page = readFileSync(
    join(root, "src/app/players/[memCode]/page.tsx"),
    "utf8",
  );
  assert.match(
    page,
    /if \(first\.answered && !requestedSeason && !hasStatData/,
    "the older-season fallback must require first.answered",
  );
  assert.match(
    page,
    /seasonUnavailable/,
    "an unanswered current season must render the partial-data notice",
  );
  assert.match(
    page,
    /if \(!probe\.answered\) break/,
    "a failed probe must stop the walk instead of continuing on stale seasons",
  );
});

console.log(`\n${passed}/${passed + failures.length} parser checks passed`);
if (failures.length > 0) {
  console.log(`failing: ${failures.join(", ")}`);
  process.exit(1);
}
