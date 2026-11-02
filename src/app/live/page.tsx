import type { Metadata } from "next";
import { getTeamStandings, getTourHistory } from "@/lib/pba/api";
import {
  englishVenue,
  getActiveTeamSeason,
  getCurrentSeason,
  getSeasonSnapshot,
  resolveTourLabels,
  seasonLabel,
} from "@/lib/pba/service";
import { getLiveFeed } from "@/lib/pba/live";
import { normalizeTeam } from "@/lib/normalize";
import { grouped, wonCompact } from "@/lib/format";
import { LiveBoard } from "@/components/domain/live-board";
import { FeaturedEvent, EventRow } from "@/components/domain/event-card";
import { StandingsTable } from "@/components/domain/standings-table";
import { Chip, EmptyState, LiveChip, SectionHeading, TextLink } from "@/components/ui/primitives";
import { PageHeader } from "@/components/domain/filter-bar";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Live match centre",
  description:
    "Live scoreboard, current tournament, team league standings and recent finals from the PBA and LPBA tours.",
};

const BROADCASTERS = [
  { name: "PBA TV (YouTube)", href: "https://www.youtube.com/channel/UCuXTHFVxa6tPC_jmqwpyOUA" },
  { name: "SBS Sports", href: "https://www.sbs.co.kr" },
  { name: "Billiards TV", href: "https://www.pbatour.org/en/index" },
];

export default async function LivePage() {
  const season = await getCurrentSeason();
  const [snapshot, teamSeason, tours, feed] = await Promise.all([
    getSeasonSnapshot(season.SeasonCode),
    getActiveTeamSeason(),
    getTourHistory(),
    getLiveFeed(),
  ]);

  const standings = teamSeason
    ? (
        await getTeamStandings({
          seasonCode: teamSeason.season.시즌코드,
          leagueCode: String(teamSeason.season.리그코드),
          roundCode: teamSeason.liveRound ? String(teamSeason.liveRound.라운드코드) : "0",
        })
      ).map(normalizeTeam)
    : [];

  const finished = tours
    .filter((tour) => tour.우승자 && tour.투어종료일자)
    .sort((a, b) => (a.투어종료일자 < b.투어종료일자 ? 1 : -1))
    .slice(0, 8);

  const recentFinals = (resolveTourLabels(
    finished.map((tour) => ({ title: tour.투어명, champion: tour.우승자, code: tour.투어코드 })),
  )).map((label, index) => ({
    ...label,
    code: finished[index].투어코드,
    endDate: finished[index].투어종료일자,
    circuit: finished[index].PBA타입,
  }));

  const currentEvent = snapshot.current;

  return (
    <>
      <PageHeader
        eyebrow="Match centre"
        title="Live from the table"
        description={`${seasonLabel(season)} season. The scoreboard wire below is read directly from the association's scoring system; everything else on this page is published tour data.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {feed.available ? <LiveChip label="Scoring now" /> : <Chip tone="neutral">No match in play</Chip>}
          {snapshot.live.length > 0 && <Chip tone="live">{snapshot.live.length} event in progress</Chip>}
          <Chip tone="neutral">{grouped(snapshot.upcoming.length)} upcoming</Chip>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:gap-8">
          <div className="space-y-6">
            <LiveBoard
              initial={feed}
              tourCode={teamSeason?.liveRound ? String(teamSeason.liveRound.라운드코드) : undefined}
            />

            {snapshot.live.length > 0 && (
              <section>
                <SectionHeading eyebrow="On now" title="Events in progress" />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {snapshot.live.map((event) => (
                    <FeaturedEvent key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )}

            {teamSeason && standings.length > 0 && (
              <section>
                <SectionHeading
                  eyebrow="Team league"
                  title={
                    teamSeason.liveRound
                      ? `Round ${teamSeason.liveRound.라운드} standings`
                      : "Current standings"
                  }
                  description={
                    teamSeason.liveRound
                      ? `${englishVenue(teamSeason.liveRound.경기장소)} · ${teamSeason.liveRound.시작일자} → ${teamSeason.liveRound.종료일자}`
                      : undefined
                  }
                  action={<TextLink href="/teams">Team league</TextLink>}
                />
                <div className="mt-4 surface overflow-hidden">
                  <StandingsTable rows={standings} limit={10} compact />
                </div>
              </section>
            )}

            <section>
              <SectionHeading
                eyebrow="Results"
                title="Recent finals"
                description="The most recent completed events on the tour, with the champion of each."
                action={<TextLink href="/schedule">Full calendar</TextLink>}
              />
              {recentFinals.length > 0 ? (
                <ul className="mt-4 divide-y divide-ink-800 rounded-[14px] border border-ink-750 bg-ink-900">
                  {recentFinals.map((tour) => (
                    <li key={tour.code} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-16 shrink-0">
                        <p className="tnum text-[10.5px] uppercase tracking-[0.08em] text-fog-600">
                          {tour.endDate?.slice(5).replace("-", "/")}
                        </p>
                        <p className="tnum text-[10.5px] text-fog-600">{tour.endDate?.slice(0, 4)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-fog-100">{tour.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-fog-500">
                          <span className="font-semibold text-gold-400">{tour.champion}</span> won
                          <span className="mx-1.5 text-ink-500">·</span>
                          {tour.circuit}
                        </p>
                      </div>
                      <span className="shrink-0 rounded border border-ink-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fog-500">
                        Final
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="mt-4" title="No completed events yet" />
              )}
            </section>
          </div>

          <aside className="space-y-4">
            {currentEvent ? (
              <FeaturedEvent event={currentEvent} />
            ) : (
              <EmptyState title="No event scheduled" />
            )}

            {teamSeason?.liveRound && (
              <div className="surface p-4">
                <p className="eyebrow">Current round</p>
                <p className="mt-2 font-display text-[15px] font-bold text-fog-100">
                  Round {teamSeason.liveRound.라운드}
                  {teamSeason.liveRound.포스트여부 === "Y" ? " · Postseason" : ""}
                </p>
                <dl className="mt-3 space-y-2 text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fog-500">Venue</dt>
                    <dd className="text-right text-fog-200">{englishVenue(teamSeason.liveRound.경기장소)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fog-500">Window</dt>
                    <dd className="tnum text-right text-fog-200">
                      {teamSeason.liveRound.시작일자} → {teamSeason.liveRound.종료일자}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fog-500">Status</dt>
                    <dd className="text-right text-fog-200">
                      {teamSeason.liveRound.진행상황 === "진행중"
                        ? "In progress"
                        : teamSeason.liveRound.진행상황 === "종료"
                          ? "Completed"
                          : "Scheduled"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fog-500">Prize purse</dt>
                    <dd className="text-right text-lime-400">{wonCompact(teamSeason.season.상금)}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="surface p-4">
              <p className="eyebrow">Where to watch</p>
              <ul className="mt-3 space-y-2">
                {BROADCASTERS.map((channel) => (
                  <li key={channel.name}>
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center justify-between gap-2 rounded-md border border-ink-750 px-3 py-2 text-[12.5px] text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
                    >
                      {channel.name}
                      <span aria-hidden="true" className="text-fog-600">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {snapshot.upcoming.length > 0 && (
              <div className="surface px-4 py-1">
                <p className="eyebrow px-1 pb-1 pt-3">Coming up</p>
                {snapshot.upcoming.slice(0, 4).map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            )}

            <div className="surface p-4">
              <p className="eyebrow">How the wire works</p>
              <p className="mt-2 text-[12px] leading-relaxed text-fog-500">
                Scores come from the association&apos;s own scoring terminal. When no table is active
                the feed returns an empty fragment, so this page reports idle rather than guessing.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
