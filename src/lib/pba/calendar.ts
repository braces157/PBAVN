/**
 * The event calendar as the console reads it.
 *
 * `data/calendar.json` is every event the association has published, all eight
 * seasons, normalised once at build time (`npm run build-calendar`). It exists
 * because the console puts the whole season on one screen — a date rail, a
 * scoreboard of the day, a season picker — and the schedule feed only answers
 * one season per request.
 *
 * This module is the one place that knows the difference between a *calendar
 * entry* (cheap, pre-shared, immutable between refreshes) and the *live detail*
 * of an event (match code, winner, broadcast list), which `/schedule/[seq]`
 * still reads from the feed. Anything that changes during a tournament must
 * come from the feed, never from here.
 */

import raw from "./data/calendar.json";
import { eventArtUrl } from "../event-art";
import { eventStatus, type Event, type EventStatus } from "../normalize";
import { parseIsoDay, isoDay } from "../format";

interface CalendarRow {
  id: string;
  title: string;
  league: string;
  season: string;
  start: string | null;
  end: string | null;
  venue: string | null;
  sponsor: string | null;
  prizePool: string | null;
  championPrize: string | null;
  defendingChampion: string | null;
  players: number | null;
  teams: number | null;
  /** Upstream asset path under `/resources/upload`, with a leading slash. */
  logoPath: string | null;
  guideUrl: string | null;
  top: boolean;
}

/**
 * A calendar event. Structurally an `Event`, so everything that already renders
 * an event keeps working — `raw` is the one field a calendar entry cannot fill,
 * because the feed has fields (`MATCH_CODE`, `BROADCAST`) that move daily.
 */
export interface CalendarEvent extends Omit<Event, "raw"> {
  /** True when the association pinned this event to the top of its schedule. */
  top: boolean;
}

const ROWS = raw as CalendarRow[];

/**
 * The crest for an event, sized for a 56 px header or a 44 px row.
 *
 * Sponsor artwork is a 20–80 KB plate; the proxy re-encodes it to a 128 px
 * WebP, which is why this is a URL and not the original path.
 */
function crest(logoPath: string | null): string | null {
  if (!logoPath) return null;
  return eventArtUrl(`https://pbatour.org/resources/upload${logoPath}`, 128);
}

function toEvent(row: CalendarRow, now = new Date()): CalendarEvent {
  const start = parseIsoDay(row.start);
  const end = parseIsoDay(row.end ?? row.start);
  const status: EventStatus = eventStatus(start, end, now);
  return {
    id: row.id,
    title: row.title,
    league: row.league,
    season: row.season,
    start,
    end,
    venue: row.venue ?? "Venue to be announced",
    sponsor: row.sponsor ?? "—",
    prizePool: row.prizePool ?? "—",
    championPrize: row.championPrize ?? "—",
    broadcast: "—",
    defendingChampion: row.defendingChampion ?? "—",
    table: "—",
    ball: "—",
    cloth: "—",
    entrants: { players: row.players, teams: row.teams },
    logo: crest(row.logoPath),
    hasDetail: row.top,
    guideUrl: row.guideUrl,
    status,
    top: row.top,
  };
}

/** Every event, chronological. */
export function calendarEvents(): CalendarEvent[] {
  return ROWS.map((row) => toEvent(row));
}

/** The seasons the calendar covers, newest first, with their event counts. */
export function calendarSeasons(): { code: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of ROWS) counts.set(row.season, (counts.get(row.season) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.code.localeCompare(a.code));
}

/** One season's events, chronological. */
export function calendarForSeason(season: string): CalendarEvent[] {
  return ROWS.filter((row) => row.season === season).map((row) => toEvent(row));
}

/** One event by its schedule sequence number. */
export function calendarEvent(id: string): CalendarEvent | null {
  const row = ROWS.find((entry) => entry.id === id);
  return row ? toEvent(row) : null;
}

/** Season labels read "2026-2027"; the calendar stores the opening year. */
export function seasonTitle(code: string): string {
  const seasons = calendarSeasons();
  const index = seasons.findIndex((season) => season.code === code);
  if (index === -1) return code;
  return `${code}-${Number(code) + 1}`;
}

/* ------------------------------------------------------------ day queries */

/** Events overlapping one calendar day (`YYYY-MM-DD`). */
export function eventsOnDay(day: string, events = calendarEvents()): CalendarEvent[] {
  return events.filter((event) => {
    const start = isoDay(event.start);
    const end = isoDay(event.end) ?? start;
    if (!start) return false;
    return day >= start && day <= (end ?? start);
  });
}

/** Every day from `from` to `to` that has at least one event on it. */
export function daysWithEvents(from: string, to: string, events = calendarEvents()): string[] {
  const days = new Set<string>();
  for (const event of events) {
    const start = isoDay(event.start);
    const end = isoDay(event.end) ?? start;
    if (!start) continue;
    if (end! < from || start > to) continue;
    let cursor = start < from ? from : start;
    const last = end! > to ? to : end!;
    while (cursor <= last) {
      days.add(cursor);
      const next = parseIsoDay(cursor);
      if (!next) break;
      next.setDate(next.getDate() + 1);
      cursor = isoDay(next) as string;
    }
  }
  return [...days].sort();
}

/** The next day on or after `day` that has an event. */
export function nextActiveDay(day: string, events = calendarEvents()): string | null {
  return (
    daysWithEvents(day, "9999-12-31", events).find((candidate) => candidate >= day) ?? null
  );
}

/** The most recent day before `day` that had an event. */
export function previousActiveDay(day: string, events = calendarEvents()): string | null {
  const past = daysWithEvents("0000-01-01", day, events).filter((candidate) => candidate < day);
  return past.length > 0 ? past[past.length - 1] : null;
}
