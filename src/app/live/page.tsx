import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
import { getDayBoard } from "@/lib/pba/matches-on-day";
import { normalizeTeam, leagueByCode, leagueShort } from "@/lib/normalize";
import { fmtRange, kstDay, shiftIsoDay, wonCompact } from "@/lib/format";
import { LiveArena, type LiveArenaUpcomingItem } from "@/components/domain/live-arena";
import { StandingsTable } from "@/components/domain/standings-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default async function LivePage() {
  const today = kstDay();
  const [feed, todayBoard, season, teamSeason, tours] = await Promise.all([
    getLiveFeed(),
    getDayBoard(today),
    getCurrentSeason(),
    getActiveTeamSeason(),
    getTourHistory(),
  ]);

  const [snapshot, rawStandings] = await Promise.all([
    getSeasonSnapshot(season.SeasonCode),
    teamSeason
      ? getTeamStandings({
          seasonCode: teamSeason.season.시즌코드,
          leagueCode: String(teamSeason.season.리그코드),
          roundCode: teamSeason.liveRound ? String(teamSeason.liveRound.라운드코드) : "0",
        })
      : Promise.resolve([]),
  ]);

  const standings = rawStandings.map(normalizeTeam);

  const upcomingQueue: LiveArenaUpcomingItem[] = todayBoard.matches
    .filter((m) => m.state === "next")
    .slice(0, 12)
    .map((m) => ({
      key: m.key,
      clock: m.clock ?? "",
      round: m.round || "Scheduled",
      circuit: m.event ? leagueShort(m.event.league) : "PBA",
      eventTitle: m.event?.title ?? "PBA Tour",
      home: m.home,
      away: m.away,
      href: m.href ?? "/schedule",
    }));

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

  const liveCircuit =
    feed.origin === "team-terminal"
      ? "TLG"
      : feed.matches.find((m) => m.circuit)?.circuit ?? null;
  const currentEvent =
    (liveCircuit ? snapshot.live.find((e) => e.league === liveCircuit) : null) ??
    snapshot.current;
  const tomorrow = shiftIsoDay(today, 1);

  return (
    <>
      <LiveArena
        initial={feed}
        upcoming={upcomingQueue}
        eventTitle={currentEvent?.title ?? `PBA ${seasonLabel(season)} Tour`}
        broadcastLabel="Broadcast: SBS Sports, Billiards TV, PBA YouTube"
      />

      <div className="wrap py-6 pb-12">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_328px]">
          <div className="min-w-0 space-y-5">
            <Card className="overflow-hidden" aria-label="Events in progress">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Events in Progress{" "}
                  <span className="mono ml-1 text-xs font-normal text-muted-foreground">
                    {snapshot.live.length}
                  </span>
                </h2>
                <Link href="/schedule" className="text-xs font-medium text-[var(--pba)] hover:underline">
                  Calendar →
                </Link>
              </div>
              {snapshot.live.length > 0 ? (
                <ul className="divide-y divide-border">
                  {snapshot.live.map((event) => (
                    <li key={event.id}>
                      <Link
                        href={`/schedule/${event.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                      >
                        <Badge variant="secondary" className="shrink-0 text-[11px] text-[var(--pba)]">
                          Active
                        </Badge>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {event.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {fmtRange(event.start, event.end)} · {event.venue}
                          </span>
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {leagueShort(event.league)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  No tour event is currently scheduled for today.
                </p>
              )}
            </Card>

            {teamSeason && standings.length > 0 && (
              <Card className="overflow-hidden" aria-label="Team League standings">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    {teamSeason.liveRound
                      ? `Team League · Round ${teamSeason.liveRound.라운드}`
                      : "Team League"}
                  </h2>
                  <Link href="/teams" className="text-xs font-medium text-[var(--pba)] hover:underline">
                    Full standings →
                  </Link>
                </div>
                <StandingsTable rows={standings} limit={10} compact />
              </Card>
            )}

            <Card className="overflow-hidden" aria-label="Recent tournament finals">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent Finals</h2>
                <Link href="/records" className="text-xs font-medium text-[var(--pba)] hover:underline">
                  Roll of honour →
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {recentFinals.map((tour) => (
                  <li key={`${tour.code}-${tour.endDate}`} className="flex items-center gap-3 px-5 py-3">
                    <span className="mono w-[46px] shrink-0 text-xs text-muted-foreground">
                      {tour.endDate?.slice(5).replace("-", "/")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {tour.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {tour.championCode ? (
                          <Link
                            href={`/players/${encodeURIComponent(tour.championCode)}`}
                            className="font-medium text-amber-600 hover:underline dark:text-amber-400"
                          >
                            {tour.champion}
                          </Link>
                        ) : (
                          <span className="font-medium text-amber-600 dark:text-amber-400">{tour.champion}</span>
                        )}{" "}
                        won · {leagueShort(tour.circuit)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <aside className="space-y-5">
            {currentEvent && (
              <Card className="overflow-hidden" aria-label="Current event">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">Current Event</h2>
                  <Link
                    href={`/schedule/${currentEvent.id}`}
                    className="text-xs font-medium text-[var(--pba)] hover:underline"
                  >
                    Open →
                  </Link>
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {currentEvent.title}
                  </p>
                  <p className="mono mt-1 text-xs text-muted-foreground">
                    {fmtRange(currentEvent.start, currentEvent.end)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{currentEvent.venue}</p>
                  <Badge variant="outline" className="mt-3 text-[11px] text-[var(--pba)]">
                    {leagueByCode(currentEvent.league).name}
                  </Badge>
                </div>
              </Card>
            )}

            {teamSeason?.liveRound && (
              <Card className="overflow-hidden" aria-label="Current Team League round">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">Team League Round</h2>
                </div>
                <dl className="divide-y divide-border">
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
                    <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="mono text-right text-xs font-medium text-foreground">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

            <Card className="overflow-hidden" aria-label="Broadcast channels">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Broadcast Channels</h2>
              </div>
              <ul className="divide-y divide-border">
                {BROADCASTERS.map((channel) => (
                  <li key={channel.name}>
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/50 hover:text-[var(--pba)]"
                    >
                      {channel.name}
                      <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="overflow-hidden" aria-label="Upcoming events">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Upcoming</h2>
                <Link
                  href={`/schedule?day=${tomorrow}`}
                  className="text-xs font-medium text-[var(--pba)] hover:underline"
                >
                  Calendar →
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {snapshot.upcoming.slice(0, 5).map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/schedule/${event.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-accent/50"
                    >
                      <span className="mono shrink-0 text-xs text-muted-foreground">
                        {event.start
                          ? event.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          : "TBA"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right text-xs font-medium text-foreground">
                        {event.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
