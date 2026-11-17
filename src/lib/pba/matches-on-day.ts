/**
 * Every match of a calendar day — played, in play, and still to play.
 *
 * This is the question a scoreboard index exists to answer: "what is on today".
 * An event that runs eight days says nothing about which of its 45 fixtures fall
 * on the day being looked at; the terminal knows exactly. Three states matter and
 * all three belong on the page:
 *
 *   up next   a fixture with a kickoff later today
 *   live      kicked off, no final result recorded yet
 *   final     a recorded result
 *
 * ## Where the dates come from
 *
 * Two different feeds, chosen by circuit:
 *
 *   Team League   fixture rows on the team terminal carry `YYYY-MM-DD HH:MM`,
 *                 already in English ("Huons", "CROWN HAITAI LAON").
 *   Tour events   the scoring terminal's bracket rows. Only the Korean variant
 *                 publishes the match **date** (the English one cuts the stamp to
 *                 a bare clock and drops the win/loss mark), so the bracket is
 *                 read twice — Korean for the day and the result, English for the
 *                 names — and the two join on the match code, never on a name.
 *
 * ## Why page one is enough
 *
 * Each bracket is served 20 rows to a page, newest first. A reader looking at a
 * day only needs the most recent 20 matches of each bracket, so page one is read
 * for depths 2–32 and the loop stops at the first page whose rows all predate the
 * day. A 128-draw's earliest rounds are days behind and are never fetched.
 *
 * ## The stamp is local time
 *
 * The association publishes `YY-MM-DD HH:MM` in its own timezone, and it is
 * compared as written: a 23:19 result belongs to the evening it was played, not
 * to the next day in a viewer's timezone.
 */

import { fetchDatedHtmlFragment, fetchHtmlFragment } from "./http";
import { getTournamentDetail } from "./api";
import { parseBracketRows, type BracketMatch } from "./bracket-parse";
import { parseDatedBracketRows, type DatedMatch } from "./bracket-dated-parse";
import { calendarEvents, type CalendarEvent } from "./calendar";
import { getEventTeamFixtures, getPlayerNameIndex, resolveKoreanName } from "./service";
import { clockLabel, isoDay, stampDay } from "../format";
import type { TeamFixture } from "./team-matches";

/** A day that is over does not change; today is re-read within the minute. */
const PAST_TTL = 600;
const TODAY_TTL = 60;

/** Bracket depths read from page one. See the module note. */
const SHALLOW_DEPTHS = [2, 4, 8, 16, 32, 64, 128] as const;

export type MatchState = "final" | "live" | "next";

export interface DayMatch {
  /** The match code (tour) or fixture number (team league). Stable per match. */
  key: string;
  pstCode: string;
  state: MatchState;
  /** Display names, Latin script. */
  home: string;
  away: string;
  homeMemCode: string | null;
  awayMemCode: string | null;
  homeSets: number | null;
  awaySets: number | null;
  homeWon: boolean;
  awayWon: boolean;
  homeAverage: number | null;
  awayAverage: number | null;
  homeHighRun: number | null;
  awayHighRun: number | null;
  /** `YYYY-MM-DD HH:MM`; null when the feed published none. */
  at: string | null;
  /** `HH:MM` for the gutter. */
  clock: string | null;
  round: string;
  matchNo: string;
  /** Where the row opens: its scorecard, or its fixture card. */
  href: string | null;
  /** The event this match belongs to, when the calendar can place it. */
  event: CalendarEvent | null;
}

export interface DayBoard {
  day: string;
  matches: DayMatch[];
  /** Events running that day, including ones with no fixture published yet. */
  events: CalendarEvent[];
  /** True when at least one read failed, so the list may be incomplete. */
  partial: boolean;
}

interface EventMatches {
  matches: DayMatch[];
  failed: boolean;
}

function ttlFor(day: string, today: string): number {
  return day >= today ? TODAY_TTL : PAST_TTL;
}

/* --------------------------------------------------------------- team league */

function fixtureState(fixture: TeamFixture, day: string, now: string): MatchState {
  if (fixture.played) return "final";
  const at = fixture.playedAt;
  if (!at) return "next";
  // A fixture whose kickoff has passed but whose score the terminal has not
  // closed is on the table, not "upcoming".
  if (stampDay(at) === day && at <= now) return "live";
  return "next";
}

function fixtureToDayMatch(
  fixture: TeamFixture,
  event: CalendarEvent,
  day: string,
  now: string,
): DayMatch {
  const state = fixtureState(fixture, day, now);
  return {
    key: `fixture-${fixture.gameNo ?? `${event.id}-${fixture.playedAt ?? ""}`}`,
    pstCode: fixture.gameNo ?? "",
    state,
    home: fixture.home.name,
    away: fixture.away.name,
    homeMemCode: null,
    awayMemCode: null,
    homeSets: state === "final" ? fixture.home.sets : null,
    awaySets: state === "final" ? fixture.away.sets : null,
    homeWon: state === "final" && fixture.home.won,
    awayWon: state === "final" && fixture.away.won,
    homeAverage: state === "final" ? fixture.home.average : null,
    awayAverage: state === "final" ? fixture.away.average : null,
    homeHighRun: state === "final" ? fixture.home.highRun : null,
    awayHighRun: state === "final" ? fixture.away.highRun : null,
    at: fixture.playedAt,
    clock: clockLabel(fixture.playedAt),
    round: "Team League",
    matchNo: fixture.gameNo ?? "—",
    href: fixture.gameNo
      ? `/teams/matches/${fixture.gameNo}?season=${encodeURIComponent(event.season)}`
      : null,
    event,
  };
}

async function teamLeagueMatches(
  event: CalendarEvent,
  day: string,
  now: string,
): Promise<EventMatches> {
  const tour = await eventTourCode(event.id);
  if (tour.failed) return { matches: [], failed: true };
  if (!tour.code) return { matches: [], failed: false };
  const roundCode = tour.code;

  const teamEvent = await getEventTeamFixtures({ matchCode: roundCode, seasonCode: event.season });
  if (!teamEvent) return { matches: [], failed: true };

  const matches = teamEvent.fixtures
    .filter((fixture) => stampDay(fixture.playedAt) === day)
    .map((fixture) => fixtureToDayMatch(fixture, event, day, now));
  return { matches, failed: false };
}

/* ---------------------------------------------------------------- tour events */

/** The Latin names for a bracket, keyed by match code. */
async function englishNames(tourCode: string, depth: number, revalidate: number) {
  const html = await fetchHtmlFragment(
    `/mob/contest_new/code_behind/contest_result_sur.asp?TourCode=${encodeURIComponent(tourCode)}&iBLCode=${depth}&iPage=1&txt_Search=&LangCode=en`,
    { revalidate, timeoutMs: 12_000 },
  );
  const rows: BracketMatch[] = parseBracketRows(html, depth);
  const byPst = new Map<string, string[]>();
  for (const row of rows) byPst.set(row.pstCode, row.sides.map((side) => side.name));
  return { names: byPst, reachable: html !== null };
}

/** The dated rows for one bracket depth, walking back through the pages until
 * the day is covered. A page holds the 20 newest rows, so a deep draw's first
 * round needs several pages before its oldest row predates `day`. */
async function datedRows(tourCode: string, depth: number, revalidate: number, day: string) {
  const rows: DatedMatch[] = [];
  for (let page = 1; page <= 8; page++) {
    const html = await fetchDatedHtmlFragment(
      `/mob/contest_new/code_behind/contest_result_sur.asp?TourCode=${encodeURIComponent(tourCode)}&iBLCode=${depth}&iPage=${page}&txt_Search=`,
      { revalidate, timeoutMs: 12_000 },
    );
    if (html === null) return { rows, reachable: false };
    const pageRows = parseDatedBracketRows(html, depth);
    if (pageRows.length === 0) break;
    rows.push(...pageRows);
    // Rows arrive newest first: once the oldest row on this page predates the
    // day, later pages cannot contain it.
    const oldest = pageRows
      .map((row) => row.at)
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    if (oldest && oldest.slice(0, 10) < day) break;
  }
  return { rows, reachable: true };
}

/** An unplayed row is live once its own kickoff has passed, otherwise up next. */
function datedState(row: DatedMatch, now: string): MatchState {
  const decided = row.sides.some((side) => side.won);
  if (decided) return "final";
  return row.at && row.at <= now ? "live" : "next";
}

function datedToDayMatch(
  row: DatedMatch,
  names: string[] | undefined,
  event: CalendarEvent,
  now: string,
): DayMatch {
  const korean = getPlayerNameIndex();
  // The English names arrive per side, in row order; the index is the fallback
  // for a player the English response did not name.
  const [home, away] = row.sides.map(
    (side, index) => names?.[index] ?? resolveKoreanName(side.nameKo, korean),
  );
  const [a, b] = row.sides;
  const state = datedState(row, now);
  return {
    key: `match-${row.pstCode}`,
    pstCode: row.pstCode,
    state,
    home: home ?? "—",
    away: away ?? "—",
    homeMemCode: a?.memCode ?? null,
    awayMemCode: b?.memCode ?? null,
    homeSets: state === "final" ? (a?.sets ?? null) : null,
    awaySets: state === "final" ? (b?.sets ?? null) : null,
    homeWon: state === "final" && Boolean(a?.won),
    awayWon: state === "final" && Boolean(b?.won),
    homeAverage: state === "final" ? (a?.average ?? null) : null,
    awayAverage: state === "final" ? (b?.average ?? null) : null,
    homeHighRun: state === "final" ? (a?.highRun ?? null) : null,
    awayHighRun: state === "final" ? (b?.highRun ?? null) : null,
    at: row.at,
    clock: clockLabel(row.at),
    round: row.round,
    matchNo: row.matchNo,
    href: `/matches/${row.pstCode}`,
    event,
  };
}

async function tourMatches(event: CalendarEvent, day: string, now: string): Promise<EventMatches> {
  const tour = await eventTourCode(event.id);
  if (tour.failed) return { matches: [], failed: true };
  if (!tour.code) return { matches: [], failed: false };
  const tourCode = tour.code;

  const revalidate = ttlFor(day, now.slice(0, 10));

  // The depths fan out rather than queue: each one already walks its own pages
  // in order (a page only says whether the next is needed once it is parsed), so
  // the parallelism between depths is free, and serially this loop can cost a
  // dozen-plus round trips before the first row of the day renders.
  const perDepth = await Promise.all(
    SHALLOW_DEPTHS.map(async (depth) => {
      const dated = await datedRows(tourCode, depth, revalidate, day);
      if (!dated.reachable) return { matches: [] as DayMatch[], failed: true };
      if (dated.rows.length === 0) return { matches: [] as DayMatch[], failed: false };

      const onDay = dated.rows.filter((row) => row.day === day);
      if (onDay.length === 0) return { matches: [] as DayMatch[], failed: false };

      const english = await englishNames(tourCode, depth, revalidate);
      return {
        matches: onDay.map((row) =>
          datedToDayMatch(row, english.names.get(row.pstCode), event, now),
        ),
        failed: !english.reachable,
      };
    }),
  );

  return {
    matches: perDepth.flatMap((depth) => depth.matches),
    failed: perDepth.some((depth) => depth.failed),
  };
}

/* --------------------------------------------------------------------- glue */

/**
 * The tour code behind an event sequence number.
 *
 * The schedule feed publishes it as `MATCH_CODE` on the event's own row; the
 * committed calendar leaves it out because it is assigned when a draw is made.
 */
async function eventTourCode(seq: string): Promise<{ code: string | null; failed: boolean }> {
  const detail = await getTournamentDetail(seq);
  // A read that never answered is a failure worth warning about; an answer
  // without a match code just means the draw is not made yet.
  if (detail === null) return { code: null, failed: true };
  const code = detail.MATCH_CODE ?? "";
  return { code: /^\d+$/.test(code) ? code : null, failed: false };
}

const STATE_ORDER: Record<MatchState, number> = { live: 0, next: 1, final: 2 };

export async function getDayBoard(
  day: string,
  universe: CalendarEvent[] = calendarEvents(),
): Promise<DayBoard> {
  const now = normaliseNow(new Date());
  const today = now.slice(0, 10);

  const events = universe.filter((event) => {
    const start = event.start ? isoDay(event.start) : null;
    const end = event.end ? isoDay(event.end) : start;
    if (!start) return false;
    return day >= start && day <= (end ?? start);
  });

  const results = await Promise.all(
    events.map((event) =>
      event.league === "TLG" ? teamLeagueMatches(event, day, now) : tourMatches(event, day, now),
    ),
  );

  const matches = results.flatMap((result) => result.matches);
  matches.sort((a, b) => {
    const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (byState !== 0) return byState;
    // Played history reads newest first; what is still to come reads soonest first.
    return a.state === "final"
      ? (b.at ?? "").localeCompare(a.at ?? "")
      : (a.at ?? "").localeCompare(b.at ?? "");
  });

  return {
    day,
    matches,
    events,
    partial: results.some((result) => result.failed),
  };
}

/** `YYYY-MM-DD HH:MM` on the Korea clock, the same clock the terminal stamps
 * with; a server-local read would class every KST evening match as up next. */
function normaliseNow(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ((acc[part.type] = part.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
