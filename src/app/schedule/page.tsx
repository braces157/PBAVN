import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSeason, getSeasonEvents, getSeasonList, getSeasonSnapshot, seasonLabel } from "@/lib/pba/service";
import { LEAGUES, type Event } from "@/lib/normalize";
import { grouped } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { EventRow } from "@/components/domain/event-card";
import { EmptyState, Stat } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Schedule",
  description: "The full PBA and LPBA tour calendar, season by season — venues, dates and prize money.",
};

interface PageProps {
  searchParams: Promise<{ season?: string; league?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { season: seasonParam, league: leagueParam } = await searchParams;
  const seasons = await getSeasonList();
  const currentSeason = await getCurrentSeason();
  const seasonCode = seasonParam && seasons.some((s) => s.SeasonCode === seasonParam)
    ? seasonParam
    : currentSeason.SeasonCode;

  const allEvents = await getSeasonEvents(seasonCode);
  const league = leagueParam ?? "";

  const events = league ? allEvents.filter((event) => event.league === league) : allEvents;
  const snapshot = await getSeasonSnapshot(seasonCode);

  const scoped = {
    live: events.filter((e) => e.status === "live"),
    upcoming: events.filter((e) => e.status === "upcoming"),
    completed: events.filter((e) => e.status === "completed"),
  };

  const seasonRecord = seasons.find((s) => s.SeasonCode === seasonCode);

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Every stop on the tour"
        description={`${seasonLabel(seasonRecord)} — ${allEvents.length} events across the PBA, LPBA, Dream, Challenge and Team League circuits.`}
      >
        <div className="flex flex-col gap-4">
          <FilterRow
            label="Season"
            basePath="/schedule"
            paramKey="season"
            active={seasonCode}
            params={{ league: leagueParam }}
            options={seasons.map((s) => ({ value: s.SeasonCode, label: s.SeasonTitle || s.SeasonCode }))}
          />
          <FilterRow
            label="Circuit"
            basePath="/schedule"
            paramKey="league"
            active={league}
            params={{ season: seasonCode }}
            options={[
              { value: "", label: "All circuits", count: allEvents.length },
              ...LEAGUES.map((l) => ({
                value: l.code,
                label: l.name,
                count: allEvents.filter((e) => e.league === l.code).length,
              })).filter((option) => option.count > 0),
            ]}
          />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid gap-px overflow-hidden rounded-[14px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
          <div className="bg-ink-900 p-4">
            <Stat label="Events" value={grouped(allEvents.length)} />
          </div>
          <div className="bg-ink-900 p-4">
            <Stat label="On now" value={grouped(snapshot.live.length)} accent={snapshot.live.length > 0} />
          </div>
          <div className="bg-ink-900 p-4">
            <Stat label="Upcoming" value={grouped(snapshot.upcoming.length)} />
          </div>
          <div className="bg-ink-900 p-4">
            <Stat label="Completed" value={grouped(snapshot.completed.length)} />
          </div>
        </div>

        {events.length === 0 ? (
          <EmptyState
            className="mt-10"
            title="No events for this filter"
            description="Try a different season or circuit."
            action={
              <Link
                href="/schedule"
                className="mt-1 rounded-md border border-ink-700 px-3 py-1.5 text-[12.5px] text-fog-300 hover:border-ink-500 hover:text-fog-100"
              >
                Reset filters
              </Link>
            }
          />
        ) : (
          <div className="mt-10 space-y-12">
            {scoped.live.length > 0 && (
              <ScheduleGroup title="On now" events={scoped.live} accent />
            )}
            {scoped.upcoming.length > 0 && (
              <ScheduleGroup title="Upcoming" events={scoped.upcoming} />
            )}
            {scoped.completed.length > 0 && (
              <ScheduleGroup title="Results" events={[...scoped.completed].reverse()} muted />
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ScheduleGroup({
  title,
  events,
  accent = false,
  muted = false,
}: {
  title: string;
  events: Event[];
  accent?: boolean;
  muted?: boolean;
}) {
  const byMonth = new Map<string, Event[]>();
  for (const event of events) {
    const key = event.start
      ? event.start.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : "Date to be announced";
    const bucket = byMonth.get(key) ?? [];
    bucket.push(event);
    byMonth.set(key, bucket);
  }

  return (
    <section className="border-t border-ink-800 pt-6 first:border-0 first:pt-0">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-lg font-bold text-fog-100">{title}</h2>
        <span className="tnum text-[11.5px] text-fog-600">{events.length}</span>
        {accent && <span className="live-dot h-1.5 w-1.5 rounded-full bg-live-500" />}
      </div>

      <div className="mt-4 space-y-6">
        {[...byMonth.entries()].map(([month, monthEvents]) => (
          <div key={month}>
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fog-600">
              {month}
            </p>
            <div className={muted ? "opacity-80" : undefined}>
              {monthEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
