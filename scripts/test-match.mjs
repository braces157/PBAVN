// Analytics tests: published markup in, the numbers a reader sees out.
//
//   npm run test:match
//
// The fixture is a real finished match: five sets, race to 15, with the full
// turn record for set one. The reconciliation checks below are the point: every
// derived number has to agree with the score the association published.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import { parseScorecard, parseSetInnings } from "../src/lib/pba/scoreboard-parse.ts";
import {
  analyseSet,
  compareTotals,
  progression,
  setsWon,
  summariseMatch,
} from "../src/lib/match.ts";

const here = dirname(fileURLToPath(import.meta.url));
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

const scorecard = parseScorecard(
  fixture("match-68308.html"),
  fixture("totals-68308.html"),
  "68308",
);

const set = analyseSet(scorecard.sets[0], parseSetInnings(fixture("set-139146.html")));
const [loser, winner] = set.sides;

check("the race target is read from the set format", () => {
  assert.equal(set.target, 15);
  assert.equal(set.gameType, "GP15");
});

check("the set winner is the side that reached the target", () => {
  assert.equal(set.winner, winner.index);
  assert.equal(winner.points, set.target);
  assert.equal(winner.shortBy, 0);
  assert.ok(loser.shortBy > 0);
});

check("every turn is attached to a side", () => {
  assert.equal(loser.turns.length, set.innings);
  assert.equal(winner.turns.length, set.innings);
  assert.equal(set.innings, 17);
});

check("conversions reconcile with the published set score", () => {
  for (const side of set.sides) {
    assert.equal(side.ones + side.twos * 2, side.points, `${side.name} conversions`);
  }
});

check("the published average agrees with the one we can compute", () => {
  for (const side of set.sides) {
    assert.ok(side.average !== null);
    assert.ok(
      Math.abs(side.points / side.innings - side.average) < 0.002,
      `${side.name}: ${side.points}/${side.innings} vs published ${side.average}`,
    );
  }
});

check("empty and scoring turns add up to the innings played", () => {
  for (const side of set.sides) {
    assert.equal(side.emptyTurns + side.scoringTurns, set.innings);
  }
});

check("scoring streaks are counted from the turns, not the total", () => {
  assert.equal(loser.bestStreak, 3);
  assert.equal(winner.bestStreak, 2);
});

check("the best single turn is the high run published on the match page", () => {
  // A turn in carom billiards is a run, not a fixed number of points, so the
  // largest turn in the record has to equal the high run from a different
  // fragment. If either parser drifts, this breaks.
  for (const side of set.sides) {
    const best = Math.max(...side.turns.map((turn) => turn.scored));
    assert.equal(best, side.highRun, `${side.name}: best turn ${best} vs published HR ${side.highRun}`);
    assert.ok(best <= set.target, `${side.name} scored ${best} past a race to ${set.target}`);
  }
});

check("the progression chart spans the whole set and never dips", () => {
  const line = progression(set);
  assert.equal(line.innings, set.innings);
  for (const series of line.series) {
    assert.equal(series.length, set.innings);
    for (let index = 1; index < series.length; index += 1) {
      assert.ok(series[index] >= series[index - 1], `dipped at inning ${index + 1}`);
    }
    assert.equal(series.at(-1), set.sides[line.series.indexOf(series)].points);
  }
});

check("a set without a turn record still describes itself", () => {
  const bare = analyseSet(scorecard.sets[1], null);
  assert.equal(bare.hasTurns, false);
  assert.deepEqual(bare.sides[0].turns, []);
  assert.ok(bare.sides[0].name.length > 0);
  assert.ok(bare.sides[0].points > 0);
});

check("every set awards exactly one win", () => {
  assert.equal(
    scorecard.sets.filter((item) => item.players.filter((player) => player.won).length === 1).length,
    scorecard.sets.length,
  );
});

check("sets won across the match equals the number of sets", () => {
  const won = setsWon(scorecard.sets);
  assert.equal(
    won.reduce((sum, count) => sum + count, 0),
    scorecard.sets.length,
  );
});

const summary = summariseMatch([set]);

check("a format flag is not mistaken for a race target", () => {
  // Set five of this match is published as GP99, a special format, not a race
  // to ninety-nine. Claiming a target would put a 2-1 set on a 99-point axis.
  const decider = analyseSet(scorecard.sets[4], null);
  assert.equal(decider.gameType, "GP99");
  assert.equal(decider.target, null);
  assert.equal(decider.sides[0].shortBy, null);
  // The winner is still known, from the published result rather than the total.
  assert.equal(decider.winner, 0);
  assert.equal(decider.sides[0].won, true);
});

check("match totals aggregate the sets", () => {
  assert.deepEqual(summary.setsWon, [set.sides[0].won ? 1 : 0, set.sides[1].won ? 1 : 0]);
  assert.equal(summary.setsWon[1], 1);
  assert.equal(summary.totalPoints[0], loser.points);
  assert.equal(summary.totalInnings[0], loser.innings);
  assert.equal(summary.coveredSets, 1);
});

check("a match average is points over innings, never a division by zero", () => {
  for (let index = 0; index < summary.average.length; index += 1) {
    const innings = summary.totalInnings[index];
    const average = summary.average[index];
    if (innings === 0) assert.equal(average, null);
    else assert.ok(average !== null && Number.isFinite(average));
  }
});

check("the published comparison table ranks the better side per row", () => {
  const rows = compareTotals(scorecard.totals);
  const average = rows.find((row) => row.label === "Average");
  const highRun = rows.find((row) => row.label === "High run");
  const innings = rows.find((row) => row.label === "Innings");
  assert.equal(average?.better, "right");
  assert.equal(highRun?.better, "left");
  // Both players needed 41 innings, so neither is better.
  assert.equal(innings?.better, "none");
});

check("comparison rows are ordered for reading, not for the upstream table", () => {
  const labels = compareTotals(scorecard.totals).map((row) => row.label);
  assert.ok(labels.indexOf("Average") < labels.indexOf("Innings"));
  assert.equal(labels[0], "Sets");
});

check("no row is duplicated after labels are translated", () => {
  const labels = compareTotals(scorecard.totals).map((row) => row.label);
  assert.equal(new Set(labels).size, labels.length);
});

check("an empty scorecard summarises without throwing", () => {
  const empty = summariseMatch([]);
  assert.deepEqual(empty.setsWon, []);
  assert.deepEqual(empty.average, []);
  assert.equal(empty.coveredSets, 0);
  assert.deepEqual(compareTotals([]), []);
});

console.log(`\n${passed}/${passed + failures.length} match checks passed`);
if (failures.length > 0) {
  console.log(`failing: ${failures.join(", ")}`);
  process.exit(1);
}
