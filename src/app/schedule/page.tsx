import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  calendarForSeason,
  calendarSeasons,
  eventsOnDay,
  nextActiveDay,
  previousActiveDay,
  type CalendarEvent,
} from "@/lib/pba/calendar";
import { getCurrentSeason } from "@/lib/pba/service";
import { LEAGUES, leagueByCode, leagueShort } from "@/lib/normalize";
import { fmtRange, grouped, isoDay, kstDay, parseIsoDay, relativeDay, shiftIsoDay } from "@/lib/format";
import { ArrowRight } from "lucide-react";
import { DateRail, DateStrip } from "@/components/domain/date-rail";
import { Panel, EmptyState, LiveChip, Stat, cn } from "@/components/ui/primitives";
import { boardSummary, TodayMatches } from "@/components/domain/today-matches";
import { getDayBoard } from "@/lib/pba/matches-on-day";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "The full PBA and LPBA 3-cushion tour calendar — every event of every season, by date, with venue and prize money.",
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

  const seasonEvents = calendarForSeason(seasonCode);
  const league = params.league && LEAGUES.some((entry) => entry.code === params.league) ? params.league : "";
  const scoped = league ? seasonEvents.filter((event) => event.league === league) : seasonEvents;

  const requestedDay = params.day && parseIsoDay(params.day) ? params.day : null;
  const focusDay =
    requestedDay ?? nextActiveDay(today, scoped) ?? previousActiveDay(today, scoped) ?? today;

  const onFocus = eventsOnDay(focusDay, scoped);
  const onFocusIds = new Set(onFocus.map((event) => event.id));
  const liveNow = scoped.filter((event) => event.status === "live");
  const liveExtra = liveNow.filter((event) => !onFocusIds.has(event.id));
  const upcoming = scoped.filter((event) => event.status === "upcoming");
  const done = scoped.filter((event) => event.status === "completed").reverse();

  const defaultFrom = shiftIsoDay(today, -14);
  const defaultTo = shiftIsoDay(today, 60);
  const railAnchor = focusDay >= defaultFrom && focusDay <= defaultTo ? today : focusDay;
  const railFrom = shiftIsoDay(railAnchor, -14);
  const railTo = shiftIsoDay(railAnchor, 60);
  const railDays = daysBetween(railFrom, railTo);
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
    <>
      <header className="border-b border-border bg-card">
        <div className="wrap py-5 sm:py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono font-medium uppercase tracking-wider">Calendar</span>
                <span aria-hidden="true" className="text-border">
                  /
                </span>
                <span>
                  {scoped.length} events
                  {league ? ` on ${leagueByCode(league).name}` : " across all circuits"}
                  {" · "}
                  {liveNow.length > 0 ? `${liveNow.length} live now` : "none live"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {seasonCode}–{Number(seasonCode) + 1} Tour Schedule
              </h1>
            </div>

            <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-1">
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
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Season</span>
            <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-1">
              {seasons.map((entry) => (
                <Link
                  key={entry.code}
                  href={query({ season: entry.code })}
                  aria-current={entry.code === seasonCode ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition-colors hover:no-underline",
                    entry.code === seasonCode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.code}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="wrap pb-10 pt-5">
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[118px_minmax(0,1fr)_308px]">
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

          <div className="min-w-0 space-y-5">
            <Panel
              title={relativeDay(focusDay)}
              meta={`${focusDay} · ${onFocus.length} event${onFocus.length === 1 ? "" : "s"}`}
              action={
                focusedIsPast(focusDay, today) ? (
                  <Link
                    href={query({ day: today })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:no-underline"
                  >
                    Today
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : null
              }
            >
              {onFocus.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {onFocus.map((event) => (
                    <li key={event.id}>
                      <EventRow event={event} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                  No event scheduled on this date. Pick another day on the rail, or browse the season list below.
                </p>
              )}
            </Panel>

            <Suspense
              key={`${focusDay}-${league}`}
              fallback={
                <Panel title="Matches on this day" meta="loading fixtures…">
                  <div className="space-y-1 py-2" aria-hidden="true">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="h-3 w-10 rounded bg-secondary" />
                        <span className="h-3 flex-1 rounded bg-secondary" />
                        <span className="h-3 w-6 rounded bg-secondary" />
                      </div>
                    ))}
                  </div>
                </Panel>
              }
            >
              <DayMatchesPanel day={focusDay} events={scoped} />
            </Suspense>

            {liveExtra.length > 0 && (
              <Panel title="Other live events" meta={String(liveExtra.length)}>
                <ul className="divide-y divide-border/60">
                  {liveExtra.map((event) => (
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

            <Panel title="Completed" meta={String(done.length)}>
              {done.length > 0 ? (
                <SeasonList events={done} />
              ) : (
                <EmptyState className="border-0" title="No completed events yet" />
              )}
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Season summary">
              <dl className="grid grid-cols-2 gap-px bg-border/70">
                <div className="bg-card p-3.5">
                  <Stat label="Events" value={grouped(scoped.length)} />
                </div>
                <div className="bg-card p-3.5">
                  <Stat label="Live" value={grouped(liveNow.length)} accent={liveNow.length > 0} />
                </div>
                <div className="bg-card p-3.5">
                  <Stat label="Upcoming" value={grouped(upcoming.length)} />
                </div>
                <div className="bg-card p-3.5">
                  <Stat label="Completed" value={grouped(done.length)} />
                </div>
              </dl>
            </Panel>

            <Panel title="Circuits">
              <ul className="divide-y divide-border/60">
                {LEAGUES.map((entry) => {
                  const count = seasonEvents.filter((event) => event.league === entry.code).length;
                  return (
                    <li key={entry.code}>
                      <Link
                        href={query({ league: entry.code })}
                        className={cn(
                          "flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-accent/50 hover:no-underline",
                          league === entry.code && "bg-secondary/70",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", toneDot(entry.tone))} />
                          <span className="text-[13px] font-medium text-foreground">{entry.name}</span>
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {seasons.length > 0 && (
              <Panel title="Seasons">
                <ul className="divide-y divide-border/60">
                  {seasons.map((entry) => (
                    <li key={entry.code}>
                      <Link
                        href={query({ season: entry.code })}
                        className={cn(
                          "flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-accent/50 hover:no-underline",
                          entry.code === seasonCode && "bg-secondary/70",
                        )}
                        aria-current={entry.code === seasonCode ? "page" : undefined}
                      >
                        <span
                          className={cn(
                            "font-mono text-xs tabular-nums",
                            entry.code === seasonCode ? "font-semibold text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {entry.code}–{Number(entry.code) + 1}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{entry.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

async function DayMatchesPanel({ day, events }: { day: string; events: CalendarEvent[] }) {
  const board = await getDayBoard(day, events);
  return (
    <Panel title="Matches on this day" meta={boardSummary(board)}>
      <TodayMatches board={board} />
      {board.partial && (
        <p className="border-t border-ink-800 px-3.5 py-2 text-[11px] text-gold-300">
          Part of this day could not be read; the list may be incomplete.
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
    <Link
      href={`/schedule/${event.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 hover:no-underline"
    >
      <span className="flex w-12 shrink-0 flex-col items-start gap-0.5">
        <span
          className={cn(
            "font-mono text-[10.5px] font-semibold uppercase tabular-nums",
            running ? "text-rose-500" : "text-muted-foreground",
          )}
        >
          {gutterTop}
        </span>
        <span className={cn("font-mono text-[10px] font-semibold uppercase tracking-wide", toneText(league.tone))}>
          {leagueShort(event.league)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-foreground">{event.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {event.status === "completed" ? "Final" : fmtRange(event.start, event.end)}
          <span className="mx-1.5 text-border">·</span>
          {event.venue}
        </span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Prize</span>
        <span className="block font-mono text-xs font-medium tabular-nums text-foreground">{shortPrize(event.prizePool)}</span>
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
          <p className="border-y border-border/60 bg-secondary/50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:border-t-0">
            {month.label}
          </p>
          <ul className="divide-y divide-border/60">
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
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors hover:no-underline",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-70">{count}</span>
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
    lime: "text-carom-300",
    rose: "text-rose-450",
    cyan: "text-cyan-450",
    amber: "text-amber-450",
    violet: "text-violet-450",
  };
  return map[tone] ?? "text-fog-500";
}

function toneDot(tone: string): string {
  const map: Record<string, string> = {
    lime: "bg-carom-400",
    rose: "bg-rose-450",
    cyan: "bg-cyan-450",
    amber: "bg-amber-450",
    violet: "bg-violet-450",
  };
  return map[tone] ?? "bg-fog-550";
}
