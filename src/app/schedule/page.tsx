import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  calendarEvents,
  calendarForSeason,
  calendarSeasons,
  eventsOnDay,
  nextActiveDay,
  previousActiveDay,
  type CalendarEvent,
} from "@/lib/pba/calendar";
import { getCurrentSeason } from "@/lib/pba/service";
import { LEAGUES, leagueByCode, leagueShort } from "@/lib/normalize";
import { fmtRange, grouped, isoDay, kstDay, relativeDay, shiftIsoDay } from "@/lib/format";
import { DateRail, DateStrip } from "@/components/domain/date-rail";
import { Panel, EmptyState, LiveChip, Stat, cn } from "@/components/ui/primitives";
import { TodayMatches } from "@/components/domain/today-matches";
import { boardSummary } from "@/components/domain/today-panel";
import { getDayBoard } from "@/lib/pba/matches-on-day";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "The full PBA and LPBA tour calendar — every event of every season, by date, with venue and prize money.",
};

interface PageProps {
  searchParams: Promise<{ season?: string; league?: string; day?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const season = await getCurrentSeason();
  const seasons = calendarSeasons();
  const seasonCode = params.season && seasons.some((s) => s.code === params.season) ? params.season : season.SeasonCode;
  const today = kstDay();

  const all = calendarEvents();
  const seasonEvents = calendarForSeason(seasonCode);
  const league = params.league ?? "";
  const scoped = league ? seasonEvents.filter((event) => event.league === league) : seasonEvents;

  // A day is selected only when the URL asks for one; otherwise the page opens
  // on "what is on now", which is the question a calendar is opened with.
  const requestedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const focusDay =
    requestedDay ?? nextActiveDay(today, scoped) ?? previousActiveDay(today, scoped) ?? today;

  // `eventsOnDay` answers "which events are running on this day" — an event that
  // started on Saturday is still on today. Day headers that list starts would
  // repeat the same multi-day event under every day of its run.
  const onFocus = eventsOnDay(focusDay, scoped);
  const liveNow = scoped.filter((event) => event.status === "live");
  const upcoming = scoped.filter((event) => (isoDay(event.start) ?? "") >= today);
  const done = scoped.filter((event) => event.status === "completed").reverse();

  const railFrom = shiftIsoDay(today, -14);
  const railTo = shiftIsoDay(today, 60);
  const railDays = daysBetween(railFrom, railTo);
  // Count each rail day with the same day-in-range rule the selected-day panel
  // uses, so a day inside a multi-day event carries the event's marker too.
  const counts = new Map<string, number>();
  for (const day of railDays) {
    const onDay = eventsOnDay(day, scoped).length;
    if (onDay > 0) counts.set(day, onDay);
  }

  const query = (next: { season?: string; league?: string; day?: string }) => {
    const search = new URLSearchParams();
    const finalSeason = next.season ?? seasonCode;
    const finalLeague = next.league ?? league;
    if (finalSeason) search.set("season", finalSeason);
    if (finalLeague) search.set("league", finalLeague);
    if (next.day) search.set("day", next.day);
    const qs = search.toString();
    return qs ? `/schedule?${qs}` : "/schedule";
  };

  return (
    <div className="mx-auto max-w-[1440px] px-3 pb-10 pt-3 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1 pb-3">
        <div>
          <p className="micro-label">Calendar</p>
          <h1 className="display-sm mt-1 text-fog-100">
            {seasonCode}-{Number(seasonCode) + 1} tour
          </h1>
          <p className="mt-1 text-[12px] text-fog-500">
            {scoped.length} events
            {league ? ` on the ${leagueByCode(league).name}` : " across every circuit"}
            {" · "}
            {liveNow.length > 0 ? `${liveNow.length} live now` : "nothing live right now"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip href={query({ league: "" })} active={!league} label="All" count={seasonEvents.length} />
          {LEAGUES.map((entry) => {
            const count = seasonEvents.filter((event) => event.league === entry.code).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={entry.code}
                href={query({ league: entry.code })}
                active={league === entry.code}
                label={entry.name}
                count={count}
              />
            );
          })}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 px-1">
        <span className="micro-label mr-1">Season</span>
        {seasons.map((entry) => (
          <Link
            key={entry.code}
            href={query({ season: entry.code })}
            aria-current={entry.code === seasonCode ? "page" : undefined}
            className={cn(
              "tnum rounded border px-2 py-0.5 text-[11.5px] font-medium transition-colors",
              entry.code === seasonCode
                ? "border-lime-400/45 bg-lime-400/10 text-lime-300"
                : "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
            )}
          >
            {entry.code}
          </Link>
        ))}
      </div>

      {/* Day navigation for phones: the desktop rail column below is hidden
          under lg, and this strip is the only picker there. */}
      <div className="mb-3 lg:hidden">
        <DateStrip
          days={railDays}
          counts={counts}
          selected={focusDay}
          today={today}
          hrefFor={(day) => query({ day })}
          label="Dates"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[116px_minmax(0,1fr)_300px]">
        <aside className="hidden lg:block">
          <DateRail
            days={railDays}
            counts={counts}
            selected={focusDay}
            today={today}
            hrefFor={(day) => query({ day })}
            label="Dates"
            scrollerId="schedule-rail"
          />
        </aside>

        <div className="min-w-0 space-y-4">
          <Panel
            title={relativeDay(focusDay)}
            meta={`${focusDay} · ${onFocus.length} event${onFocus.length === 1 ? "" : "s"}`}
            action={
              focusedIsPast(focusDay, today) ? (
                <Link
                  href={query({ day: today })}
                  className="text-[11.5px] font-medium text-fog-400 transition-colors hover:text-lime-300"
                >
                  Jump to today →
                </Link>
              ) : null
            }
          >
            {onFocus.length > 0 ? (
              <ul className="divide-y divide-ink-800/70">
                {onFocus.map((event) => (
                  <li key={event.id}>
                    <EventRow event={event} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-[12px] text-fog-500">
                No event runs on this date. Pick another day on the rail, or scroll to the season list
                below.
              </p>
            )}
          </Panel>

          {/* The matches recorded on the selected day, which is what a reader
              opening a calendar on a given date actually came to see. */}
          <Suspense
            fallback={
              <Panel title="Matches on this day" meta="reading the day's fixtures…">
                <div className="space-y-px py-1" aria-hidden="true">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="h-[10px] w-[34px] rounded bg-ink-800" />
                      <span className="h-[10px] flex-1 rounded bg-ink-800" />
                      <span className="h-[10px] w-[14px] rounded bg-ink-800" />
                    </div>
                  ))}
                </div>
              </Panel>
            }
          >
            <DayMatchesPanel day={focusDay} events={scoped} />
          </Suspense>

          {liveNow.length > 0 && (
            <Panel title="Live now" meta={String(liveNow.length)}>
              <ul className="divide-y divide-ink-800/70">
                {liveNow.map((event) => (
                  <li key={event.id}>
                    <EventRow event={event} live />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Upcoming" meta={String(upcoming.length)}>
            {upcoming.length > 0 ? (
              <SeasonList events={upcoming} />
            ) : (
              <EmptyState className="border-0" title="Nothing upcoming" description="This season has no events left to play." />
            )}
          </Panel>

          <Panel title="Results" meta={String(done.length)}>
            {done.length > 0 ? (
              <SeasonList events={done} />
            ) : (
              <EmptyState className="border-0" title="No completed events yet" />
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Season at a glance">
            <dl className="grid grid-cols-2 gap-px bg-ink-750">
              <div className="bg-ink-900 p-3">
                <Stat label="Events" value={grouped(seasonEvents.length)} />
              </div>
              <div className="bg-ink-900 p-3">
                <Stat label="Live" value={grouped(liveNow.length)} accent={liveNow.length > 0} />
              </div>
              <div className="bg-ink-900 p-3">
                <Stat label="Upcoming" value={grouped(upcoming.length)} />
              </div>
              <div className="bg-ink-900 p-3">
                <Stat label="Completed" value={grouped(done.length)} />
              </div>
            </dl>
          </Panel>

          <Panel title="Circuits">
            <ul className="divide-y divide-ink-800/70">
              {LEAGUES.map((entry) => {
                const count = seasonEvents.filter((event) => event.league === entry.code).length;
                return (
                  <li key={entry.code}>
                    <Link
                      href={query({ league: entry.code })}
                      className={cn("row-hover flex items-center justify-between gap-2 px-3 py-[7px]", league === entry.code && "bg-ink-850")}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", toneDot(entry.tone))} />
                        <span className="text-[12px] text-fog-200">{entry.name}</span>
                      </span>
                      <span className="tnum text-[11px] text-fog-550">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {all.length > 0 && (
            <Panel title="All seasons">
              <ul className="divide-y divide-ink-800/70">
                {seasons.map((entry) => (
                  <li key={entry.code}>
                    <Link
                      href={`/schedule?season=${entry.code}`}
                      className="row-hover flex items-center justify-between gap-2 px-3 py-[7px]"
                      aria-current={entry.code === seasonCode ? "page" : undefined}
                    >
                      <span className={cn("tnum text-[12px]", entry.code === seasonCode ? "text-lime-300" : "text-fog-200")}>
                        {entry.code}-{Number(entry.code) + 1}
                      </span>
                      <span className="tnum text-[11px] text-fog-550">{entry.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/** The matches recorded on the selected day, streamed so the calendar paints first. */
async function DayMatchesPanel({ day, events }: { day: string; events: CalendarEvent[] }) {
  const board = await getDayBoard(day, events);
  return (
    <Panel title="Matches on this day" meta={boardSummary(board)}>
      <TodayMatches board={board} />
      {board.partial && (
        <p className="border-t border-ink-800 px-3 py-1.5 text-[10px] text-amber-450">
          Part of this day could not be read; the list may be missing matches.
        </p>
      )}
    </Panel>
  );
}

function EventRow({ event, live = false }: { event: CalendarEvent; live?: boolean }) {
  const league = leagueByCode(event.league);
  const start = event.start;
  const running = live || event.status === "live";
  const gutterTop = running
    ? "Live"
    : start
      ? start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : "TBA";

  return (
    <Link href={`/schedule/${event.id}`} className="row-hover flex items-center gap-2.5 px-3 py-2">
      <span className="flex w-[46px] shrink-0 flex-col items-start gap-0.5">
        <span
          className={cn(
            "tnum text-[10px] font-semibold uppercase tracking-[0.06em]",
            running ? "text-live-400" : "text-fog-450",
          )}
        >
          {gutterTop}
        </span>
        <span className={cn("text-[9px] font-bold uppercase tracking-[0.06em]", toneText(league.tone))}>
          {leagueShort(event.league)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-fog-100">{event.title}</span>
        <span className="mt-0.5 block truncate text-[10.5px] text-fog-550">
          {event.status === "completed" ? "Final" : fmtRange(event.start, event.end)}
          <span className="mx-1 text-ink-600">·</span>
          {event.venue}
        </span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <span className="block text-[10px] text-fog-600">Pool</span>
        <span className="tnum block text-[11px] text-fog-300">{shortPrize(event.prizePool)}</span>
      </span>
      {running ? <LiveChip /> : null}
    </Link>
  );
}

function SeasonList({ events }: { events: CalendarEvent[] }) {
  const months: { key: string; label: string; rows: CalendarEvent[] }[] = [];
  for (const event of events) {
    const start = event.start;
    if (!start) continue;
    const key = `${start.getFullYear()}-${String(start.getMonth()).padStart(2, "0")}`;
    const label = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const bucket = months.find((month) => month.key === key);
    if (bucket) bucket.rows.push(event);
    else months.push({ key, label, rows: [event] });
  }

  return (
    <div>
      {months.map((month) => (
        <div key={month.key}>
          <p className="bg-ink-850/60 px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fog-500">
            {month.label}
          </p>
          <ul className="divide-y divide-ink-800/70">
            {month.rows.map((event) => (
              <li key={event.id}>
                <EventRow event={event} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "border-lime-400/45 bg-lime-400/10 text-lime-300"
          : "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
      )}
    >
      {label}
      <span className="tnum ml-1.5 text-[10px] text-fog-600">{count}</span>
    </Link>
  );
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  for (let index = 0; index < 80 && cursor <= to; index += 1) {
    days.push(cursor);
    cursor = shiftIsoDay(cursor, 1);
  }
  return days;
}

function focusedIsPast(day: string, today: string): boolean {
  return day < today;
}

function shortPrize(value: string): string {
  const text = value.trim();
  if (!text || text === "—") return "—";
  return text.length > 20 ? `${text.slice(0, 18)}…` : text;
}

function toneText(tone: string): string {
  const map: Record<string, string> = {
    lime: "text-lime-400",
    rose: "text-rose-450",
    cyan: "text-cyan-450",
    amber: "text-amber-450",
    violet: "text-violet-450",
  };
  return map[tone] ?? "text-fog-500";
}

function toneDot(tone: string): string {
  const map: Record<string, string> = {
    lime: "bg-lime-400",
    rose: "bg-rose-450",
    cyan: "bg-cyan-450",
    amber: "bg-amber-450",
    violet: "bg-violet-450",
  };
  return map[tone] ?? "bg-fog-600";
}
