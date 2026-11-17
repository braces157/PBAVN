import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
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
import { normalizeTeam, leagueByCode, leagueShort } from "@/lib/normalize";
import { fmtRange, grouped, kstDay, shiftIsoDay, wonCompact } from "@/lib/format";
import { LiveBoard, LiveMatchBoards } from "@/components/domain/live-board";
import { StandingsTable } from "@/components/domain/standings-table";
import { Chip, LiveChip, Panel, TextLink } from "@/components/ui/primitives";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Live match centre",
  description:
    "Live 3-cushion scoreboard, current tournament, Team League standings and recent finals from the PBA and LPBA tours.",
};

const BROADCASTERS = [
  { name: "PBA TV (YouTube)", href: "https://www.youtube.com/channel/UCuXTHFVxa6tPC_jmqwpyOUA" },
  { name: "SBS Sports", href: "https://www.sbs.co.kr" },
  { name: "Billiards TV", href: "https://www.pbatour.org/en/index" },
];

async function ScoringNowBadge() {
  const feed = await getLiveFeed();
  return feed.available ? <LiveChip label="Scoring now" /> : null;
}

async function LiveWireSection({ tourCode }: { tourCode?: string }) {
  const feed = await getLiveFeed();
  return feed.matches.length > 0 ? (
    <LiveMatchBoards initial={feed} tourCode={tourCode} />
  ) : (
    <LiveBoard initial={feed} tourCode={tourCode} />
  );
}

function LiveWireSkeleton() {
  return (
    <div className="surface p-5" aria-hidden="true">
      <div className="h-4 w-36 bg-[var(--paper-2)]" />
      <div className="mt-4 space-y-2.5">
        <div className="h-12 bg-[var(--paper-2)]" />
        <div className="h-12 bg-[var(--paper-2)]" />
      </div>
    </div>
  );
}

export default async function LivePage() {
  const season = await getCurrentSeason();
  const [snapshot, teamSeason, tours] = await Promise.all([
    getSeasonSnapshot(season.SeasonCode),
    getActiveTeamSeason(),
    getTourHistory(),
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

  const recentFinals = resolveTourLabels(
    finished.map((tour) => ({ title: tour.투어명, champion: tour.우승자, code: tour.투어코드 })),
  ).map((label, index) => ({
    ...label,
    code: finished[index].투어코드,
    endDate: finished[index].투어종료일자,
    circuit: finished[index].PBA타입,
  }));

  const currentEvent = snapshot.current;
  const tomorrow = shiftIsoDay(kstDay(), 1);

  return (
    <>
      <header className="border-b border-ink-800 bg-ink-900/60">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="eyebrow">Match centre</p>
              <span aria-hidden="true" className="text-ink-600">
                /
              </span>
              <p className="text-[12.5px] text-fog-450">
                {seasonLabel(season)} tour · live scoreboard updates every 20 seconds
              </p>
            </div>
            <h1 className="display-md mt-1 text-fog-100">Live Matches</h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Suspense fallback={null}>
              <ScoringNowBadge />
            </Suspense>
            {snapshot.live.length > 0 && (
              <Chip tone="live">{snapshot.live.length} event in progress</Chip>
            )}
            <Chip tone="neutral">{grouped(snapshot.upcoming.length)} upcoming</Chip>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_316px]">
          <div className="min-w-0 space-y-5">
            <Suspense fallback={<LiveWireSkeleton />}>
              <LiveWireSection
                tourCode={teamSeason?.liveRound ? String(teamSeason.liveRound.라운드코드) : undefined}
              />
            </Suspense>

            <Panel
              title="Events in progress"
              meta={snapshot.live.length ? String(snapshot.live.length) : "0"}
              action={<TextLink href="/schedule">Calendar</TextLink>}
            >
              {snapshot.live.length > 0 ? (
                <ul className="divide-y divide-ink-800/70">
                  {snapshot.live.map((event) => (
                    <li key={event.id}>
                      <Link href={`/schedule/${event.id}`} className="row-hover flex items-center gap-3 px-3.5 py-2.5">
                        <span className="w-[46px] shrink-0">
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.06em] text-live-400">
                            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
                            Live
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-fog-100">
                            {event.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-fog-500">
                            {fmtRange(event.start, event.end)}
                            <span className="mx-1.5 text-ink-600">·</span>
                            {event.venue}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-carom-300">
                          {leagueShort(event.league)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3.5 py-4 text-[12.5px] text-fog-450">
                  No tour event is currently scheduled for today.
                </p>
              )}
            </Panel>

            {teamSeason && standings.length > 0 && (
              <Panel
                title={
                  teamSeason.liveRound
                    ? `Team League · Round ${teamSeason.liveRound.라운드}`
                    : "Team League"
                }
                meta={teamSeason.liveRound ? englishVenue(teamSeason.liveRound.경기장소) : undefined}
                action={<TextLink href="/teams">Team league</TextLink>}
              >
                <StandingsTable rows={standings} limit={10} compact />
              </Panel>
            )}

            <Panel title="Recent finals" meta={String(recentFinals.length)}>
              <ul className="divide-y divide-ink-800/70">
                {recentFinals.map((tour) => (
                  <li key={`${tour.code}-${tour.endDate}`} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="tnum w-[46px] shrink-0 text-[10.5px] font-semibold uppercase text-fog-500">
                      {tour.endDate?.slice(5).replace("-", "/")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-fog-100">{tour.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-fog-500">
                        <span className="font-semibold text-gold-300">{tour.champion}</span> won
                        <span className="mx-1.5 text-ink-600">·</span>
                        {tour.circuit}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <aside className="space-y-4">
            {currentEvent && (
              <Panel title="Current event" action={<TextLink href={`/schedule/${currentEvent.id}`}>Open</TextLink>}>
                <div className="px-3.5 py-3">
                  <p className="font-display text-[14.5px] font-bold leading-snug text-fog-100">
                    {currentEvent.title}
                  </p>
                  <p className="tnum mt-1 text-[11.5px] text-fog-400">
                    {fmtRange(currentEvent.start, currentEvent.end)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-fog-500">{currentEvent.venue}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-carom-300">
                    {leagueByCode(currentEvent.league).name}
                  </p>
                </div>
              </Panel>
            )}

            {teamSeason?.liveRound && (
              <Panel title="Current round">
                <dl className="divide-y divide-ink-800/70">
                  {[
                    {
                      label: "Round",
                      value: `${teamSeason.liveRound.라운드}${teamSeason.liveRound.포스트여부 === "Y" ? " · Postseason" : ""}`,
                    },
                    { label: "Venue", value: englishVenue(teamSeason.liveRound.경기장소) },
                    { label: "Window", value: `${teamSeason.liveRound.시작일자} → ${teamSeason.liveRound.종료일자}` },
                    {
                      label: "Status",
                      value:
                        teamSeason.liveRound.진행상황 === "진행중"
                          ? "In progress"
                          : teamSeason.liveRound.진행상황 === "종료"
                            ? "Completed"
                            : "Scheduled",
                    },
                    { label: "Purse", value: wonCompact(teamSeason.season.상금) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 px-3.5 py-2">
                      <dt className="micro-label">{row.label}</dt>
                      <dd className="tnum text-right text-[12px] text-fog-200">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            )}

            <Panel title="Broadcast channels">
              <ul className="divide-y divide-ink-800/70">
                {BROADCASTERS.map((channel) => (
                  <li key={channel.name}>
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="row-hover flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12.5px] font-medium text-fog-200 hover:text-carom-300"
                    >
                      {channel.name}
                      <span aria-hidden="true" className="text-fog-550">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Upcoming" action={<TextLink href={`/schedule?day=${tomorrow}`}>Calendar</TextLink>}>
              <ul className="divide-y divide-ink-800/70">
                {snapshot.upcoming.slice(0, 5).map((event) => (
                  <li key={event.id}>
                    <Link href={`/schedule/${event.id}`} className="row-hover block px-3.5 py-2">
                      <span className="flex items-center justify-between gap-2">
                        <span className="tnum shrink-0 text-[11px] font-semibold text-fog-400">
                          {event.start
                            ? event.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                            : "TBA"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right text-[12px] text-fog-200">
                          {event.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}
