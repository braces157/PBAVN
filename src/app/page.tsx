import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getPressList, getTeamStandings } from "@/lib/pba/api";
import {
  getActiveTeamSeason,
  getCurrentSeason,
  getLeaders,
  getRankingBoard,
  seasonLabel,
} from "@/lib/pba/service";
import {
  calendarEvents,
  eventsOnDay,
  nextActiveDay,
  previousActiveDay,
  type CalendarEvent,
} from "@/lib/pba/calendar";
import { getLiveFeed, type LiveMatch } from "@/lib/pba/live";
import { LEADER_CATEGORIES, leagueByCode, leagueShort, normalizeArticle, normalizeTeam } from "@/lib/normalize";
import { excerpt, fmtDate, fmtRange, grouped, isoDay, kstDay, percent, pick, relativeDay, shiftIsoDay, wonCompact } from "@/lib/format";
import { asset, isRealAsset } from "@/lib/pba/http";
import { DateRail } from "@/components/domain/date-rail";
import { DateStrip } from "@/components/domain/date-rail";
import { TodayBoard, TodayPanelSkeleton } from "@/components/domain/today-panel";
import { PlayerAvatar, TeamLogo } from "@/components/ui/media";
import { SafeImage } from "@/components/ui/safe-image";
import { Chip, LiveChip, Panel, Stat, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Scores, schedule and standings",
  description:
    "Today's PBA and LPBA matches, the live scoreboard, the full tour calendar, prize-money standings and team-league tables.",
};

export default async function HomePage() {
  const today = kstDay();
  const season = await getCurrentSeason();
  const seasonCode = season.SeasonCode;

  // Everything here is cached well beyond the live terminals' windows, and the
  // standings chain off the team season inside the batch rather than after it —
  // a third sequential stage here is a third stage before first byte.
  // The live wire is deliberately absent: it is the slowest read on the page and
  // every surface that needs it streams below (header chip, status line, wire).
  const teamSeasonPromise = getActiveTeamSeason();
  const [press, pbaRank, lpbaRank, teamSeason, leaders, standings] = await Promise.all([
    getPressList(1, 6),
    getRankingBoard({ kind: "prize", leagueCode: "PBA1", season: seasonCode }),
    getRankingBoard({ kind: "prize", leagueCode: "LPBA1", season: seasonCode }),
    teamSeasonPromise,
    getLeaders(seasonCode, "PBA1"),
    teamSeasonPromise.then((active) =>
      active
        ? getTeamStandings({
            seasonCode: active.season.시즌코드,
            leagueCode: String(active.season.리그코드),
          }).then((rows) => rows.map(normalizeTeam))
        : [],
    ),
  ]);

  const articles = press.list.map(normalizeArticle);

  const events = calendarEvents();
  const liveToday = eventsOnDay(today, events).filter((event) => event.status === "live");
  const startingToday = eventsOnDay(today, events).filter((event) => event.status === "upcoming");
  // "Next up" repeats the in-progress events when today is active, and never
  // leaves them behind; the day search skips live events so the panel shows
  // what has yet to start.
  const nextDay = nextActiveDay(today, liveToday.length ? events.filter((event) => event.status !== "live") : events);
  const upcoming = nextDay ? eventsOnDay(nextDay, events).filter((event) => event.status !== "live") : [];
  // An event that started earlier in the week can still be running; "Last out"
  // lists only what has finished.
  const lastDay = previousActiveDay(today, events.filter((event) => event.status === "completed"));
  const recent = lastDay ? eventsOnDay(lastDay, events).filter((event) => event.status === "completed") : [];
  const featured = liveToday[0] ?? startingToday[0] ?? upcoming[0] ?? recent[0] ?? events[events.length - 1] ?? null;

  // The rail opens a week before today rather than a month: a scoreboard reader
  // is looking at this week, and the selected day has to be visible without
  // scrolling a rail that starts in the past.
  const railFrom = shiftIsoDay(today, -7);
  const railTo = shiftIsoDay(today, 45);
  const railDays = dayWindow(railFrom, railTo);
  const railCounts = new Map<string, number>();
  for (const event of events) {
    const start = isoDay(event.start);
    if (!start) continue;
    railCounts.set(start, (railCounts.get(start) ?? 0) + 1);
  }

  const leaderPicks = LEADER_CATEGORIES.filter((category) =>
    ["에버리지", "하이런", "최다승", "공격성공률"].includes(category.key),
  )
    .map((category) => ({
      category,
      rows: leaders.filter((row) => row.Category === category.key).sort((a, b) => a.Rank - b.Rank).slice(0, 3),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="mx-auto max-w-[1440px] px-3 pb-10 pt-3 sm:px-5 lg:px-6">
      {/* -------------------------------------------------------- page head */}
      <header className="flex flex-wrap items-end justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Suspense fallback={null}>
              <ScoringNowChip />
            </Suspense>
            <Chip tone="neutral">{seasonLabel(season)} season</Chip>
          </div>
          <h1 className="display-sm mt-1.5 text-fog-100">Every table, every frame</h1>
          <p className="mt-1 text-[12px] text-fog-500">
            {relativeDay(today)}
            <Suspense fallback=" · reading the wire…">
              <WireStatus />
            </Suspense>
            {liveToday.length > 0
              ? ` · ${liveToday.length} event${liveToday.length === 1 ? "" : "s"} in progress`
              : nextDay
                ? ` · next event ${relativeDay(nextDay).toLowerCase()}`
                : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/live"
            className="press inline-flex items-center gap-1.5 rounded-md bg-lime-400 px-3 py-1.5 text-[12px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
          >
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-ink-950" />
            Match centre
          </Link>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-1.5 text-[12px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
          >
            Full schedule
          </Link>
        </div>
      </header>

      {/* Day navigation for phones: the desktop rail column below is hidden
          under lg, and this strip is the only picker there. */}
      <div className="mb-4 lg:hidden">
        <DateStrip
          days={railDays}
          counts={railCounts}
          selected={today}
          today={today}
          hrefFor={(day) => `/schedule?day=${day}`}
          label="Dates"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[116px_minmax(0,1fr)_300px]">
        {/* ------------------------------------------------------ date rail */}
        <aside className="hidden lg:block">
          <DateRail
            days={railDays}
            counts={railCounts}
            selected={today}
            today={today}
            hrefFor={(day) => `/schedule?day=${day}`}
            scrollerId="home-rail"
            label="Dates"
          />
        </aside>

        {/* ------------------------------------------------------- main col */}
        <div className="min-w-0 space-y-4">
          {/* Today: every match of the day — played, on the table, and to come —
              streamed because the read fans out over every running event. */}
          <Suspense fallback={<TodayPanelSkeleton day={today} />}>
            <TodayBoard day={today} />
          </Suspense>

          {liveToday.length > 0 && (
            <Panel title="Events in progress" meta={String(liveToday.length)}>
              {liveToday.map((event) => (
                <EventBoardRow key={event.id} event={event} live />
              ))}
            </Panel>
          )}

          {/* Live wire. Streamed: a scoring terminal that answers slowly must
              not hold the rest of the page behind it. */}
          <Suspense fallback={<WireSkeleton />}>
            <LiveWirePanel />
          </Suspense>

          {/* Next up */}
          {upcoming.length > 0 && (
            <Panel
              title="Next up"
              meta={relativeDay(nextDay)}
              action={
                <Link
                  href={`/schedule?day=${nextDay}`}
                  className="text-[11.5px] font-medium text-fog-400 hover:text-lime-300"
                >
                  All events →
                </Link>
              }
            >
              <div className="divide-y divide-ink-800/70">
                {upcoming.slice(0, 5).map((event) => (
                  <EventBoardRow key={event.id} event={event} showDate />
                ))}
              </div>
            </Panel>
          )}

          {/* Results */}
          {recent.length > 0 && (
            <Panel
              title="Last out"
              meta={relativeDay(lastDay)}
              action={
                <Link
                  href={`/schedule?day=${lastDay}`}
                  className="text-[11.5px] font-medium text-fog-400 hover:text-lime-300"
                >
                  Results →
                </Link>
              }
            >
              <div className="divide-y divide-ink-800/70">
                {recent.map((event) => (
                  <EventBoardRow key={event.id} event={event} showDate />
                ))}
              </div>
            </Panel>
          )}

          {/* Rankings */}
          <div className="grid gap-4 md:grid-cols-2">
            <Panel
              title="Prize money · PBA"
              action={<TextLink href="/rankings?league=PBA1">All</TextLink>}
            >
              <RankList rows={pbaRank.slice(0, 8)} />
            </Panel>
            <Panel
              title="Prize money · LPBA"
              action={<TextLink href="/rankings?league=LPBA1">All</TextLink>}
            >
              <RankList rows={lpbaRank.slice(0, 8)} />
            </Panel>
          </div>

          {/* Team league */}
          {standings.length > 0 && (
            <Panel
              title={teamSeason ? `Team League · Round ${teamSeason.liveRound?.라운드 ?? "—"}` : "Team League"}
              meta={`${standings.length} clubs`}
              action={<TextLink href="/teams">All clubs</TextLink>}
            >
              <ul className="divide-y divide-ink-800/70">
                {standings.slice(0, 8).map((team, index) => (
                  <li key={team.code || index}>
                    <Link href={`/teams/${encodeURIComponent(team.code)}`} className="row-hover flex items-center gap-2.5 px-3 py-[7px]">
                      <span className="tnum w-4 shrink-0 text-right text-[11px] font-bold text-fog-600">
                        {index + 1}
                      </span>
                      <TeamLogo src={team.logo} name={team.name} size="xs" className="!h-[18px] !w-[18px] !rounded-[3px] !p-0.5" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-fog-200">{team.name}</span>
                      <span className="tnum shrink-0 text-[10.5px] text-fog-550">
                        {team.wins}–{team.losses}
                      </span>
                      <span className="tnum w-6 shrink-0 text-right font-display text-[12px] font-bold text-lime-400">
                        {team.points}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Leaders */}
          {leaderPicks.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {leaderPicks.map(({ category, rows }) => (
                <Panel key={category.key} title={category.label} meta="PBA">
                  <ul className="divide-y divide-ink-800/70">
                    {rows.map((row) => (
                      <li key={`${category.key}-${row.MemCode}-${row.Rank}`}>
                        <Link href={`/players/${row.MemCode}`} className="row-hover flex items-center gap-2 px-3 py-[6px]">
                          <span className="tnum w-3 shrink-0 text-[10.5px] text-fog-600">{row.Rank}</span>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-fog-200">
                            {row.MemNameEn || row.MemName}
                          </span>
                          <span className="tnum shrink-0 font-display text-[12px] font-bold text-fog-100">
                            {formatLeaderValue(category.unit, row.Value)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )}

          {/* News */}
          {articles.length > 0 && (
            <Panel title="Newsroom" meta="Korean-language source" action={<TextLink href="/news">All news</TextLink>}>
              <ul className="divide-y divide-ink-800/70">
                {articles.slice(0, 4).map((article) => (
                  <li key={article.seq}>
                    <Link href={`/news/${article.seq}`} className="row-hover flex items-center gap-3 px-3 py-2">
                      <span className="h-[44px] w-[66px] shrink-0 overflow-hidden rounded-[4px] bg-ink-800">
                        <SafeImage
                          src={article.image}
                          alt=""
                          className="h-full w-full object-cover"
                          fallback={<span className="block h-full w-full bg-ink-850" />}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-fog-100">
                          {article.title}
                        </span>
                        <span className="tnum mt-0.5 block text-[10.5px] text-fog-600">
                          {fmtDate(article.date)} · {excerpt(article.body, 70)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* ----------------------------------------------------------- rail
            Last in the DOM and last on a phone: the day's matches are the
            reason the page opens; the featured card is seasoning. On desktop
            the grid parks it in the third column. */}
        <aside className="space-y-4">
          {featured && <FeaturedCard event={featured} />}

          <Panel title="Tour calendar" action={<TextLink href="/schedule">Open</TextLink>}>
            <ul className="divide-y divide-ink-800/70">
              {upcoming.length === 0
                ? recent.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      <CompactEventRow event={event} />
                    </li>
                  ))
                : events
                    .filter((event) => (isoDay(event.start) ?? "") >= today)
                    .slice(0, 8)
                    .map((event) => (
                      <li key={event.id}>
                        <CompactEventRow event={event} />
                      </li>
                    ))}
            </ul>
          </Panel>

          <Panel title="Season at a glance">
            <dl className="grid grid-cols-2 gap-px bg-ink-750">
              <div className="bg-ink-900 p-3">
                <Stat label="Events" value={grouped(events.filter((e) => e.season === seasonCode).length)} />
              </div>
              <div className="bg-ink-900 p-3">
                <Stat label="Clubs" value={grouped(standings.length)} />
              </div>
              <div className="bg-ink-900 p-3">
                <Stat
                  label="Purse"
                  value={teamSeason ? wonCompact(teamSeason.season.상금) : "—"}
                  accent
                />
              </div>
              <div className="bg-ink-900 p-3">
                <Stat label="Ranked" value={grouped(pbaRank.length + lpbaRank.length)} />
              </div>
            </dl>
          </Panel>

          {pbaRank[0] && <PrizeLeader row={pbaRank[0]} />}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/**
 * The header's live chip, table count and wire panel all read the same feed.
 * Each sits behind its own Suspense boundary so the shell never waits on the
 * scoring terminals, and the three reads share one `getLiveFeed` flight (the
 * wire does not answer three times for one page view).
 */

async function ScoringNowChip() {
  const feed = await getLiveFeed();
  return feed.available ? <LiveChip label="Scoring now" /> : null;
}

async function WireStatus() {
  const feed = await getLiveFeed();
  return (
    <>
      {" · "}
      {!feed.reachable ? "match status unavailable" : feed.matches.length > 0
        ? `${feed.matches.length} table${feed.matches.length === 1 ? "" : "s"} live`
        : "no matches live"}
    </>
  );
}

async function LiveWirePanel() {
  const feed = await getLiveFeed();
  return (
    <Panel
      title="Live match scores"
      // The source string is long; on a phone it would squeeze the title to
      // nothing, so it shows from `sm` up. The full footer lives on /live.
      meta={<span className="hidden sm:inline">{feed.source}</span>}
      action={
        <Link href="/live" className="text-[11.5px] font-medium text-fog-400 hover:text-lime-300">
          Open match centre →
        </Link>
      }
    >
      {feed.matches.length > 0 ? (
        <ul className="divide-y divide-ink-800/70">
          {feed.matches.map((match) => (
            <li key={match.key}>
              <LiveWireRow match={match} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
          <p className="text-[12px] text-fog-450">
            {feed.reachable
              ? "No match is being scored right now."
              : "The scoring terminal did not answer this time."}
          </p>
          <Link href="/live" className="text-[11.5px] font-medium text-fog-400 hover:text-lime-300">
            Watch the wire →
          </Link>
        </div>
      )}
      <p className="border-t border-ink-800 px-3 py-2 text-[11px] text-fog-400">
        Checked {new Date(feed.fetchedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })} KST · <Link href="/live" className="underline hover:text-fog-100">Live scores refresh in match centre</Link>
      </p>
    </Panel>
  );
}

/** Matches the arriving panel's frame so the swap does not jump the page. */
function WireSkeleton() {
  return (
    <Panel title="Scoreboard wire" meta="reading the terminal…">
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
  );
}

/**
 * One match on the live wire.
 *
 * A tour match links to its scorecard. A Team League fixture has no scorecard on
 * the tour terminal (`pstCode` is empty), so its row carries no link at all —
 * `/matches/${""}` would be a bare `/matches`, which is not a route and lands the
 * reader on the not-found page.
 */
function LiveWireRow({ match }: { match: LiveMatch }) {
  const body = (
    <span className="flex items-start gap-3">
      <span className="flex w-[42px] shrink-0 flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-live-400">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
          Live
        </span>
        <span className="tnum text-[10.5px] text-fog-500">
          {match.latestSet.setNo > 0 ? `Set ${match.latestSet.setNo}` : "In play"}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        {match.sides.map((side, index) => (
          <span key={`${side.name}-${index}`} className="flex h-[21px] items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fog-100">
              {side.name || `Player ${index + 1}`}
            </span>
            {match.fixtureScore && match.players?.[index] && (
              <span className="hidden shrink-0 truncate text-[10px] text-fog-500 sm:inline">
                {match.players[index]}
              </span>
            )}
            {!match.fixtureScore && side.innings !== null && side.innings !== undefined && (
              <span className="tnum shrink-0 text-[10px] text-fog-550">{side.innings} inn</span>
            )}
          </span>
        ))}
      </span>
      <span className="flex w-[26px] shrink-0 flex-col items-end">
        {match.sides.map((side, index) => (
          <span
            key={`p-${index}`}
            className="score-cell flex h-[21px] items-center text-[13px] text-live-400"
          >
            {match.fixtureScore ? match.fixtureScore[index] : side.points}
          </span>
        ))}
      </span>
    </span>
  );

  if (!match.pstCode) {
    return <div className="px-3 py-2">{body}</div>;
  }
  return (
    <Link href={`/matches/${match.pstCode}?live=1`} className="row-hover block px-3 py-2">
      {body}
    </Link>
  );
}

/** One event as a scoreboard line: crest, title, circuit, dates, state. */
function EventBoardRow({
  event,
  live = false,
  showDate = false,
}: {
  event: CalendarEvent;
  live?: boolean;
  showDate?: boolean;
}) {
  const league = leagueByCode(event.league);
  return (
    <Link href={`/schedule/${event.id}`} className="row-hover flex items-center gap-2.5 px-3 py-2">
      <span className="flex w-[42px] shrink-0 flex-col items-start gap-0.5">
        {live ? (
          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-live-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Event on
          </span>
        ) : (
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fog-550">
            {showDate && event.start
              ? event.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
              : "Upcoming"}
          </span>
        )}
        <span className={cn("text-[9px] font-bold uppercase tracking-[0.06em]", league.tone === "rose" ? "text-rose-450" : league.tone === "violet" ? "text-violet-450" : league.tone === "cyan" ? "text-cyan-450" : league.tone === "amber" ? "text-amber-450" : "text-lime-400")}>
          {leagueShort(event.league)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-fog-100">{event.title}</span>
        <span className="mt-0.5 block truncate text-[10.5px] text-fog-550">
          {fmtRange(event.start, event.end)}
          <span className="mx-1 text-ink-600">·</span>
          {event.venue}
        </span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <span className="block text-[10px] text-fog-600">Prize</span>
        <span className="tnum block text-[11px] text-fog-300">{compactPrize(event.prizePool)}</span>
      </span>
    </Link>
  );
}

function CompactEventRow({ event }: { event: CalendarEvent }) {
  const league = leagueByCode(event.league);
  const start = event.start
    ? event.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "TBA";
  return (
    <Link href={`/schedule/${event.id}`} className="row-hover flex items-center gap-2 px-3 py-[7px]">
      <span className="tnum w-[44px] shrink-0 text-[11px] font-semibold text-fog-400">{start}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] text-fog-200">{event.title}</span>
        <span className={cn("block text-[9.5px] font-semibold uppercase tracking-[0.06em]", toneText(league.tone))}>
          {league.name}
        </span>
      </span>
      {event.status === "live" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-live-500" aria-label="Live" />}
    </Link>
  );
}

function FeaturedCard({ event }: { event: CalendarEvent }) {
  const league = leagueByCode(event.league);
  return (
    <Panel title="In focus" action={<TextLink href={`/schedule/${event.id}`}>Open</TextLink>}>
      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          {event.status === "live" ? <LiveChip label="Event in progress" /> : <Chip tone={league.tone}>{league.name}</Chip>}
        </div>
        <p className="mt-2 font-display text-[15px] font-bold leading-snug text-fog-100">{event.title}</p>
        <p className="tnum mt-1 text-[11.5px] text-fog-450">{fmtRange(event.start, event.end)}</p>
        <p className="mt-0.5 text-[11px] text-fog-550">{event.venue}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-800 pt-2.5">
          <div>
            <dt className="micro-label">Prize pool</dt>
            <dd className="tnum mt-0.5 text-[11.5px] text-fog-200">{compactPrize(event.prizePool)}</dd>
          </div>
          <div>
            <dt className="micro-label">Defending champion</dt>
            <dd className="mt-0.5 truncate text-[11.5px] text-fog-200">
              {event.defendingChampion !== "—" ? event.defendingChampion : "TBD"}
            </dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}

function PrizeLeader({ row }: { row: Awaited<ReturnType<typeof getRankingBoard>>[number] }) {
  return (
    <Panel title="Prize-money leader">
      <Link href={`/players/${row.MemCode}`} className="row-hover flex items-center gap-2.5 px-3 py-2.5">
        <PlayerAvatar
          path={row.ImgURL}
          src={isRealAsset(row.ImgURL) ? asset(row.ImgURL) : null}
          name={pick(row.PlayerNameEN, row.PlayerNameKO)}
          size="sm"
          ring
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-fog-100">
            {pick(row.PlayerNameEN, row.PlayerNameKO)}
          </span>
          <span className="tnum block text-[10.5px] text-fog-550">
            {row.PlayerNameKO} · {grouped(row.RankingPoint)} pts
          </span>
        </span>
        <span className="tnum shrink-0 font-display text-[13px] font-bold text-lime-400">
          {compactPrize(String(row.Prize))}
        </span>
      </Link>
    </Panel>
  );
}

function RankList({ rows }: { rows: Awaited<ReturnType<typeof getRankingBoard>> }) {
  if (rows.length === 0) {
    return <p className="px-3 py-3 text-[11.5px] text-fog-500">No ranking published for this season yet.</p>;
  }
  return (
    <ul className="divide-y divide-ink-800/70">
      {rows.map((row, index) => (
        <li key={`${row.MemCode}-${row.Rank}-${index}`}>
          <Link href={`/players/${row.MemCode}`} className="row-hover flex items-center gap-2 px-3 py-[6px]">
            <span className="tnum w-4 shrink-0 text-right text-[10.5px] font-bold text-fog-600">
              {row.Rank || index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-fog-200">
              {pick(row.PlayerNameEN, row.PlayerNameKO)}
            </span>
            <span className="tnum shrink-0 text-[9.5px] uppercase text-fog-600">{row.NationCode}</span>
            <span className="tnum w-[54px] shrink-0 text-right font-display text-[11.5px] font-bold text-fog-100">
              {compactPrize(String(row.Prize))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ utils */

function dayWindow(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  for (let index = 0; index < 60 && cursor <= to; index += 1) {
    days.push(cursor);
    cursor = shiftIsoDay(cursor, 1);
  }
  return days;
}

/** "KRW 250 Million", "2억 5천만원", "₩250,000,000" → "₩250M" or the raw words. */
function compactPrize(value: string): string {
  const text = value.trim();
  if (!text || text === "—") return "—";
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  if (/^\d+$/.test(text.replace(/\s/g, "")) && Number.isFinite(numeric) && numeric > 1000) {
    if (numeric >= 1_000_000_000) return `₩${(numeric / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
    if (numeric >= 1_000_000) return `₩${(numeric / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  // The feed already writes these in words ("Final Winner: KRW 100 million");
  // the winner figure is the one people quote.
  const winner = text.match(/(?:winner|우승)[^\d]*([\d.,]+\s*(?:million|billion|억원?|만원?))/i);
  if (winner) {
    const amount = winner[1].replace(/million/i, "M").replace(/billion/i, "B");
    return /KRW|₩/i.test(text) ? `₩${amount.replace(/\s+/g, "")}` : amount;
  }
  return text.length > 22 ? `${text.slice(0, 20)}…` : text;
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

function formatLeaderValue(unit: "avg" | "int" | "pct", value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return percent(n);
  return grouped(n);
}
