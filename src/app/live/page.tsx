import type { Metadata } from "next";
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
import { fmtRange, grouped, isoDay, kstDay, shiftIsoDay, wonCompact } from "@/lib/format";
import { LiveBoard, LiveMatchBoards } from "@/components/domain/live-board";
import { StandingsTable } from "@/components/domain/standings-table";
import { LiveChip, Panel, TextLink } from "@/components/ui/primitives";

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
    <div className="mx-auto max-w-[1440px] px-3 pb-10 pt-3 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1 pb-3">
        <div>
          <p className="micro-label">Match centre</p>
          <h1 className="display-sm mt-1 text-fog-100">Live from the table</h1>
          <p className="mt-1 text-[12px] text-fog-500">
            {seasonLabel(season)} season · the wire below is read from the association's scoring
            terminal every 20 seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {feed.available ? <LiveChip label="Scoring now" /> : null}
          {snapshot.live.length > 0 && (
            <span className="rounded-full border border-live-500/40 bg-live-500/10 px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-live-400">
              {snapshot.live.length} event in progress
            </span>
          )}
          <span className="rounded-full border border-ink-700 bg-ink-850 px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fog-450">
            {grouped(snapshot.upcoming.length)} upcoming
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* The match being scored is the reason the page was opened, so it is
              the first and largest thing on it, and the poll keeps it current.
              Everything below is reference. */}
          {feed.matches.length > 0 ? (
            <LiveMatchBoards
              initial={feed}
              tourCode={teamSeason?.liveRound ? String(teamSeason.liveRound.라운드코드) : undefined}
            />
          ) : (
            <LiveBoard
              initial={feed}
              tourCode={teamSeason?.liveRound ? String(teamSeason.liveRound.라운드코드) : undefined}
            />
          )}

          <Panel
            title="Events in progress"
            meta={snapshot.live.length ? String(snapshot.live.length) : "none"}
            action={<TextLink href="/schedule">Calendar</TextLink>}
          >
            {snapshot.live.length > 0 ? (
              <ul className="divide-y divide-ink-800/70">
                {snapshot.live.map((event) => (
                  <li key={event.id}>
                    <Link href={`/schedule/${event.id}`} className="row-hover flex items-center gap-2.5 px-3 py-2">
                      <span className="w-[42px] shrink-0">
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-live-400">
                          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
                          Live
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-fog-100">
                          {event.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-fog-550">
                          {fmtRange(event.start, event.end)}
                          <span className="mx-1 text-ink-600">·</span>
                          {event.venue}
                        </span>
                      </span>
                      <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.06em] text-lime-400">
                        {leagueShort(event.league)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-[12px] text-fog-500">
                No tour event is between its dates right now.
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
                <li key={`${tour.code}-${tour.endDate}`} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="tnum w-[46px] shrink-0 text-[10.5px] uppercase text-fog-550">
                    {tour.endDate?.slice(5).replace("-", "/")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-fog-100">{tour.title}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-fog-550">
                      <span className="font-semibold text-gold-400">{tour.champion}</span> won
                      <span className="mx-1 text-ink-500">·</span>
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
              <div className="px-3 py-3">
                <p className="font-display text-[14px] font-bold leading-snug text-fog-100">
                  {currentEvent.title}
                </p>
                <p className="tnum mt-1 text-[11.5px] text-fog-450">
                  {fmtRange(currentEvent.start, currentEvent.end)}
                </p>
                <p className="mt-0.5 text-[11px] text-fog-550">{currentEvent.venue}</p>
                <p className="mt-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-lime-400">
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
                  <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-[7px]">
                    <dt className="micro-label">{row.label}</dt>
                    <dd className="tnum text-right text-[11.5px] text-fog-200">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          <Panel title="Where to watch">
            <ul className="divide-y divide-ink-800/70">
              {BROADCASTERS.map((channel) => (
                <li key={channel.name}>
                  <a
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="row-hover flex items-center justify-between gap-2 px-3 py-[7px] text-[12px] text-fog-200"
                  >
                    {channel.name}
                    <span aria-hidden="true" className="text-fog-600">
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
                  <Link href={`/schedule/${event.id}`} className="row-hover block px-3 py-[7px]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="tnum shrink-0 text-[10.5px] text-fog-450">
                        {event.start
                          ? event.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          : "TBA"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-fog-200">
                        {event.title}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="How the wire works">
            <p className="px-3 py-2.5 text-[11.5px] leading-relaxed text-fog-500">
              Scores come from the association's own scoring terminal. When no table is active the
              feed returns an empty fragment, so this page reports idle rather than guessing.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
