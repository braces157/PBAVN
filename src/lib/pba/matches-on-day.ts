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

import { unstable_cache } from "next/cache";
import { fetchDatedHtmlFragment, fetchHtmlFragment } from "./http";
import { getTournamentDetail } from "./api";
import { parseBracketRows, type BracketMatch } from "./bracket-parse";
import { parseDatedBracketRows, type DatedMatch } from "./bracket-dated-parse";
import {
  parseLiveTourCards,
  parseUpcomingTourCards,
  type LiveTourCard,
  type UpcomingTourCard,
} from "./day-cards-parse";
import { calendarEvents, type CalendarEvent } from "./calendar";
import { getEventTeamFixtures, getPlayerNameIndex, resolveKoreanName } from "./service";
import { cleanPlayerName, clockLabel, isoDay, stampDay } from "../format";
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

const PARSED_CACHE_LIMIT = 300;
const parsedCache = new Map<string, { value: unknown; expires: number }>();

function readParsedCache<T>(key: string): T | undefined {
  const hit = parsedCache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    parsedCache.delete(key);
    return undefined;
  }
  parsedCache.delete(key);
  parsedCache.set(key, hit);
  return hit.value as T;
}

function writeParsedCache(key: string, value: unknown, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  while (parsedCache.size >= PARSED_CACHE_LIMIT) {
    const oldest = parsedCache.keys().next().value;
    if (oldest === undefined) break;
    parsedCache.delete(oldest);
  }
  parsedCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

/** The Latin names for a bracket across `1..pages`, keyed by match code. */
async function englishNames(tourCode: string, depth: number, revalidate: number, pages: number) {
  const pageCount = Math.max(1, Math.min(8, pages));
  const memKey = `en:${tourCode}:${depth}:${revalidate}:p${pageCount}`;
  const hot = readParsedCache<[string, string[]][]>(memKey);
  if (hot) return { names: new Map<string, string[]>(hot), reachable: true };

  const read = unstable_cache(
    async (code: string, bracketDepth: number, ttl: number, maxPage: number) => {
      const htmls = await Promise.all(
        Array.from({ length: maxPage }, (_, index) =>
          fetchHtmlFragment(
            `/mob/contest_new/code_behind/contest_result_sur.asp?TourCode=${encodeURIComponent(code)}&iBLCode=${bracketDepth}&iPage=${index + 1}&txt_Search=&LangCode=en`,
            { revalidate: ttl, timeoutMs: 12_000, allowEmpty: true },
          ),
        ),
      );
      const pairs: [string, string[]][] = [];
      for (let index = 0; index < htmls.length; index++) {
        const html = htmls[index];
        if (html === null) {
          if (index === 0) throw new Error("UNREACHABLE");
          break;
        }
        const rows: BracketMatch[] = parseBracketRows(html, bracketDepth);
        if (rows.length === 0) break;
        for (const row of rows) {
          pairs.push([row.pstCode, row.sides.map((side) => side.name)]);
        }
      }
      writeParsedCache(memKey, pairs, ttl);
      return pairs;
    },
    ["pba-day-english-names", `ttl-${revalidate}`],
    { revalidate },
  );

  try {
    const pairs = await read(tourCode, depth, revalidate, pageCount);
    return { names: new Map<string, string[]>(pairs), reachable: true };
  } catch {
    return { names: new Map<string, string[]>(), reachable: false };
  }
}

/** The dated rows for one bracket depth, walking back through the pages until
 * the day is covered. A page holds the 20 newest rows, so a deep draw's first
 * round needs several pages before its oldest row predates `day`. */
async function datedRows(tourCode: string, depth: number, revalidate: number, day: string) {
  const memKey = `dr:${tourCode}:${depth}:${revalidate}:${day}`;
  const hot = readParsedCache<{ rows: DatedMatch[]; pagesRead: number }>(memKey);
  if (hot) return { ...hot, reachable: true };

  const read = unstable_cache(
    async (code: string, bracketDepth: number, ttl: number, targetDay: string) => {
      const rows: DatedMatch[] = [];
      let pagesRead = 0;
      for (let page = 1; page <= 8; page++) {
        const html = await fetchDatedHtmlFragment(
          `/mob/contest_new/code_behind/contest_result_sur.asp?TourCode=${encodeURIComponent(code)}&iBLCode=${bracketDepth}&iPage=${page}&txt_Search=`,
          { revalidate: ttl, timeoutMs: 12_000, allowEmpty: true },
        );
        if (html === null) throw new Error("UNREACHABLE");
        pagesRead = page;
        const pageRows = parseDatedBracketRows(html, bracketDepth);
        if (pageRows.length === 0) break;
        rows.push(...pageRows);
        // Rows arrive newest first: once the oldest row on this page predates the
        // day, later pages cannot contain it.
        const oldest = pageRows
          .map((row) => row.at)
          .filter((value): value is string => Boolean(value))
          .sort()[0];
        if (oldest && oldest.slice(0, 10) < targetDay) break;
      }
      const result = { rows, pagesRead: Math.max(1, pagesRead) };
      writeParsedCache(memKey, result, ttl);
      return result;
    },
    ["pba-day-dated-rows", `ttl-${revalidate}`],
    { revalidate },
  );

  try {
    const result = await read(tourCode, depth, revalidate, day);
    return { ...result, reachable: true };
  } catch {
    return { rows: [] as DatedMatch[], pagesRead: 1, reachable: false };
  }
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

function liveCardToDayMatch(card: LiveTourCard, event: CalendarEvent, now: string): DayMatch {
  const [a, b] = card.sides;
  return {
    key: `match-${card.pstCode}`,
    pstCode: card.pstCode,
    state: "live",
    home: cleanPlayerName(a?.name) || "—",
    away: cleanPlayerName(b?.name) || "—",
    homeMemCode: a?.memCode ?? null,
    awayMemCode: b?.memCode ?? null,
    homeSets: a?.sets ?? null,
    awaySets: b?.sets ?? null,
    homeWon: false,
    awayWon: false,
    homeAverage: a?.average ?? null,
    awayAverage: b?.average ?? null,
    homeHighRun: a?.highRun ?? null,
    awayHighRun: b?.highRun ?? null,
    at: now,
    clock: null,
    round: card.round || "Live",
    matchNo: card.matchNo,
    href: `/matches/${card.pstCode}?live=1`,
    event,
  };
}

function upcomingCardToDayMatch(
  card: UpcomingTourCard,
  tourCode: string,
  event: CalendarEvent,
  day: string,
): DayMatch {
  const [a, b] = card.sides;
  const homeMem = a?.memCode ?? null;
  const awayMem = b?.memCode ?? null;
  const href =
    homeMem && awayMem
      ? `/compare?a=${encodeURIComponent(homeMem)}&b=${encodeURIComponent(awayMem)}`
      : `/schedule/${event.id}`;
  return {
    key: `next-${tourCode}-${card.matchNo}-${homeMem ?? a?.name ?? "a"}-${awayMem ?? b?.name ?? "b"}`,
    pstCode: "",
    state: "next",
    home: cleanPlayerName(a?.name) || "—",
    away: cleanPlayerName(b?.name) || "—",
    homeMemCode: homeMem,
    awayMemCode: awayMem,
    homeSets: null,
    awaySets: null,
    homeWon: false,
    awayWon: false,
    homeAverage: null,
    awayAverage: null,
    homeHighRun: null,
    awayHighRun: null,
    at: card.clock ? `${day} ${card.clock}` : null,
    clock: card.clock,
    round: card.round || "Scheduled",
    matchNo: card.matchNo,
    href,
    event,
  };
}

async function liveTourMatches(
  tourCode: string,
  event: CalendarEvent,
  now: string,
): Promise<EventMatches> {
  const html = await fetchHtmlFragment(
    `/mob/contest_new/code_behind/live_info.asp?TourCode=${encodeURIComponent(tourCode)}&LangCode=en`,
    { revalidate: 15, timeoutMs: 8_000, allowEmpty: true },
  );
  if (html === null) return { matches: [], failed: true };
  const cards = parseLiveTourCards(html).filter((card) => !card.tourCode || card.tourCode === tourCode);
  return {
    matches: cards.map((card) => liveCardToDayMatch(card, event, now)),
    failed: false,
  };
}

async function upcomingTourMatches(
  tourCode: string,
  event: CalendarEvent,
  day: string,
  revalidate: number,
): Promise<EventMatches> {
  const html = await fetchHtmlFragment(
    `/mob/contest_new/code_behind/next_game_new2.asp?txt_Search=&TourCode=${encodeURIComponent(tourCode)}&LangCode=en`,
    { revalidate, timeoutMs: 12_000, allowEmpty: true },
  );
  if (html === null) return { matches: [], failed: true };
  const targetMonthDay = day.slice(5, 10);
  const cards = parseUpcomingTourCards(html).filter(
    (card) => card.monthDay === targetMonthDay && (!card.tourCode || card.tourCode === tourCode),
  );
  return {
    matches: cards.map((card) => upcomingCardToDayMatch(card, tourCode, event, day)),
    failed: false,
  };
}

function matchPairKey(match: DayMatch): string {
  const pair =
    match.homeMemCode && match.awayMemCode
      ? [match.homeMemCode, match.awayMemCode]
      : [match.home.trim().toLowerCase(), match.away.trim().toLowerCase()];
  return pair.sort().join("::");
}

async function tourMatches(event: CalendarEvent, day: string, now: string): Promise<EventMatches> {
  const tour = await eventTourCode(event.id);
  if (tour.failed) return { matches: [], failed: true };
  if (!tour.code) return { matches: [], failed: false };
  const tourCode = tour.code;

  const today = now.slice(0, 10);
  const revalidate = ttlFor(day, today);

  // Read all three terminal surfaces in parallel:
  //   1. ended bracket rows (`contest_result_sur.asp`) for recorded results
  //   2. live tables (`live_info.asp`) when looking at today
  //   3. scheduled fixtures (`next_game_new2.asp`) for today and upcoming days
  const [perDepth, liveResult, upcomingResult] = await Promise.all([
    Promise.all(
      SHALLOW_DEPTHS.map(async (depth) => {
        const dated = await datedRows(tourCode, depth, revalidate, day);
        if (!dated.reachable) return { matches: [] as DayMatch[], failed: true };
        if (dated.rows.length === 0) return { matches: [] as DayMatch[], failed: false };

        const onDay = dated.rows.filter((row) => row.day === day);
        if (onDay.length === 0) return { matches: [] as DayMatch[], failed: false };

        const english = await englishNames(tourCode, depth, revalidate, dated.pagesRead);
        return {
          matches: onDay.map((row) =>
            datedToDayMatch(row, english.names.get(row.pstCode), event, now),
          ),
          failed: !english.reachable,
        };
      }),
    ),
    day === today
      ? liveTourMatches(tourCode, event, now)
      : Promise.resolve<EventMatches>({ matches: [], failed: false }),
    day >= today
      ? upcomingTourMatches(tourCode, event, day, revalidate)
      : Promise.resolve<EventMatches>({ matches: [], failed: false }),
  ]);

  const bracketMatches = perDepth.flatMap((depth) => depth.matches);
  // Only finalized bracket rows are authoritative over live table cards.
  // An undecided dated row (e.g., partial scores without a winner) must yield
  // to the live card so live scores and `?live=1` links are preserved.
  const finalPst = new Set(
    bracketMatches
      .filter((match) => match.state === "final")
      .map((match) => match.pstCode)
      .filter(Boolean),
  );

  const livePst = new Set<string>();
  const livePairs = new Set<string>();
  const live = liveResult.matches.filter((match) => {
    if (match.pstCode && finalPst.has(match.pstCode)) return false;
    if (match.pstCode && livePst.has(match.pstCode)) return false;
    if (match.pstCode) livePst.add(match.pstCode);
    livePairs.add(matchPairKey(match));
    return true;
  });

  const ended = bracketMatches.filter((match) => {
    if (match.state === "final") return true;
    if (match.pstCode && livePst.has(match.pstCode)) return false;
    if (livePairs.has(matchPairKey(match))) return false;
    return true;
  });

  const seenPairs = new Set<string>([...livePairs, ...ended.map(matchPairKey)]);
  const upcoming = upcomingResult.matches.filter((match) => {
    const key = matchPairKey(match);
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  return {
    matches: [...live, ...upcoming, ...ended],
    failed: perDepth.some((depth) => depth.failed) || liveResult.failed || upcomingResult.failed,
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
