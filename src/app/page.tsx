import type { Metadata } from "next";
import Link from "next/link";
import { getPlayerCached, getActiveTeamSeason, getCurrentSeason, getLeaders, getPlayerNameIndex, getRankingBoard, resolveKoreanName, seasonLabel } from "@/lib/pba/service";
import { getPressList, getTeamStandings } from "@/lib/pba/api";
import { getDayBoard, type DayMatch } from "@/lib/pba/matches-on-day";
import { getLiveFeed, type LiveMatch } from "@/lib/pba/live";
import { getRoundFixtures, getFixtureBouts, FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, type TeamFixture, type FixtureBouts } from "@/lib/pba/team-matches";
import {
  calendarEvents,
  eventsOnDay,
  nextActiveDay,
  previousActiveDay,
  type CalendarEvent,
} from "@/lib/pba/calendar";
import {
  LEADER_CATEGORIES,
  leagueByCode,
  leagueShort,
  normalizeArticle,
  normalizePlayer,
  normalizeTeam,
  winRate,
} from "@/lib/normalize";
import {
  cleanDisplayText,
  cleanPlayerName,
  dateParts,
  fmtDate,
  fmtRange,
  grouped,
  hasHangul,
  isoDay,
  kstDay,
  percent,
  relativeDay,
  shiftIsoDay,
  wonCompact,
} from "@/lib/format";
import { photoUrl } from "@/lib/photo";
import { SafeImage } from "@/components/ui/safe-image";
import { clubBadge, flagClass, leagueTagClass } from "@/components/ui/media";
import { translateArticleTitles } from "@/lib/translate";
import { cn } from "@/components/ui/primitives";
import type { RawRankingRow, RawTop5Row } from "@/lib/pba/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Today — Matches, Live Scores & Standings",
  description:
    "Live 3-cushion carom scores, PBA and LPBA tournament schedules, match cards, prize rankings and Team League standings.",
};

interface HomePageProps {
  searchParams?: Promise<{ day?: string; mtab?: string; rtab?: string }>;
}

const VALID_MTAB = ["live", "today", "upcoming"] as const;
const VALID_RTAB = ["pba", "lpba", "money"] as const;

type MTab = (typeof VALID_MTAB)[number];
type RTab = (typeof VALID_RTAB)[number];

function shortClock(value: string | null | undefined): string {
  if (!value) return "—";
  const m = value.match(/(\d{1,2}:\d{2})$/);
  return m ? m[1] : value;
}

function shortDayLabel(value: string | null | undefined): string {
  if (!value) return "";
  const parts = dateParts(value);
  return parts.day !== "—" ? `${Number(parts.day)} ${parts.month.slice(0, 1)}${parts.month.slice(1).toLowerCase()}` : value.slice(5, 10);
}

function parseSetsList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter(Boolean).slice(0, 4);
}

function shortClubName(name: string): string {
  const cleaned = cleanDisplayText(name);
  const low = cleaned.toLowerCase();
  if (low.includes("huons")) return "Huons Legend";
  if (low.includes("nonghyup") || low.includes("nh pay")) return "NH Pay";
  if (low.includes("crown")) return "Crown Haitai";
  if (low.includes("builders") || low.startsWith("sy ")) return "SY Builders";
  if (low.includes("harim")) return "Harim";
  if (low.includes("woori")) return "Woori Won";
  if (low.includes("welcome")) return "Welcome Phoenix";
  if (low.includes("high1")) return "High1 Winners";
  if (low.includes("hana")) return "HanaPay";
  if (low.includes("breakers")) return "Breakers";
  return cleaned.length > 18 ? `${cleaned.slice(0, 17).trimEnd()}…` : cleaned;
}

function detectPressTag(title: string): { label: string; cls: string } {
  const lower = title.toLowerCase();
  if (lower.includes("팀리그") || lower.includes("team")) return { label: "Team", cls: "t-team" };
  if (lower.includes("lpba")) return { label: "LPBA", cls: "t-lpba" };
  if (lower.includes("드림") || lower.includes("dream")) return { label: "Dream", cls: "t-dream" };
  return { label: "PBA", cls: "t-pba" };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const today = kstDay();
  const focusDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;

  const rtab: RTab = VALID_RTAB.includes(params.rtab as RTab) ? (params.rtab as RTab) : "pba";

  const season = await getCurrentSeason();
  const seasonCode = season.SeasonCode;

  const events = calendarEvents();
  const liveEvents = events.filter((event) => event.status === "live");
  const upcomingEvents = events.filter(
    (event) => event.status === "upcoming" && (isoDay(event.start) ?? "") >= today,
  );
  const completedEvents = events.filter((event) => event.status === "completed").reverse();

  const nextDay = nextActiveDay(
    shiftIsoDay(focusDay, 1),
    focusDay === today && liveEvents.length ? events.filter((e) => e.status !== "live") : events,
  );
  const lastDay = previousActiveDay(focusDay, events);

  const [feed, dayBoard, recentDayBoard, press, pbaPointsRank, lpbaPointsRank, prizeRank, teamSeason, leaders] =
    await Promise.all([
      getLiveFeed(),
      getDayBoard(focusDay),
      lastDay ? getDayBoard(lastDay) : Promise.resolve(null),
      getPressList(1, 9),
      getRankingBoard({ kind: "point", leagueCode: "PBA1", season: seasonCode }),
      getRankingBoard({ kind: "point", leagueCode: "LPBA1", season: seasonCode }),
      rtab === "money"
        ? getRankingBoard({ kind: "prize", leagueCode: "PBA1", season: seasonCode })
        : Promise.resolve(null),
      getActiveTeamSeason(),
      getLeaders(seasonCode, "PBA1"),
    ]);

  const activeRank = rtab === "money" ? (prizeRank ?? []) : rtab === "lpba" ? lpbaPointsRank : pbaPointsRank;
  const spotlightRow = pbaPointsRank[0] ?? lpbaPointsRank[0] ?? null;

  const liveRound = teamSeason?.liveRound ?? null;
  const [standings, roundFixtures, spotlightRaw] = await Promise.all([
    teamSeason
      ? getTeamStandings({
          seasonCode: teamSeason.season.시즌코드,
          leagueCode: String(teamSeason.season.리그코드),
          roundCode: liveRound ? String(liveRound.라운드코드) : "0",
        }).then((rows) => rows.map(normalizeTeam))
      : Promise.resolve([]),
    teamSeason && liveRound
      ? getRoundFixtures(
          String(liveRound.라운드코드),
          liveRound.라운드,
          liveRound.진행상황 === "진행중" ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL,
        )
      : Promise.resolve([] as TeamFixture[]),
    spotlightRow ? getPlayerCached(spotlightRow.MemCode).catch(() => null) : Promise.resolve(null),
  ]);

  const defaultMTab: MTab = feed.matches.length > 0 ? "live" : dayBoard.matches.length > 0 ? "today" : "upcoming";
  const mtab: MTab = VALID_MTAB.includes(params.mtab as MTab) ? (params.mtab as MTab) : defaultMTab;

  // Lookup map of nation codes and player codes from rankings
  const playerNationByName = new Map<string, string>();
  const playerCodeByName = new Map<string, string>();
  for (const row of [...pbaPointsRank, ...lpbaPointsRank]) {
    const cleanEn = cleanPlayerName(row.PlayerNameEN);
    const cleanShort = cleanPlayerName(row.PlayerNameENShort);
    if (row.NationCode) {
      if (cleanEn) playerNationByName.set(cleanEn.toLowerCase(), row.NationCode);
      if (cleanShort) playerNationByName.set(cleanShort.toLowerCase(), row.NationCode);
      if (row.MemCode) playerNationByName.set(row.MemCode, row.NationCode);
    }
    if (row.MemCode && cleanEn) {
      playerCodeByName.set(cleanEn.toLowerCase(), row.MemCode);
    }
  }

  const spotlightPlayer = spotlightRaw ? normalizePlayer(spotlightRaw) : null;

  // Determine featured Team League fixture bouts if we don't have a live feed match with bouts
  const liveLead = feed.matches[0] ?? null;
  const playedFixtures = [...roundFixtures].filter((f) => f.played).reverse();
  const upcomingFixtures = roundFixtures.filter((f) => !f.played);
  const featuredTeamFixture = !liveLead && playedFixtures[0]?.gameNo && liveRound ? playedFixtures[0] : null;
  const [featuredBouts, articles] = await Promise.all([
    featuredTeamFixture?.gameNo && liveRound
      ? getFixtureBouts(String(liveRound.라운드코드), liveRound.라운드, featuredTeamFixture.gameNo).catch(() => null)
      : Promise.resolve(null),
    translateArticleTitles(press.list.map(normalizeArticle), { budgetMs: 1_500 }),
  ]);
  const nameIndex = getPlayerNameIndex();

  const resolveLeaderName = (row: RawTop5Row) => {
    const raw = cleanPlayerName(row.MemNameEn || row.MemName);
    return hasHangul(raw) ? resolveKoreanName(raw, nameIndex) : raw;
  };

  const leaderPicks = LEADER_CATEGORIES.filter((category) =>
    ["에버리지", "하이런", "최다승", "공격성공률", "뱅크샷성공률"].includes(category.key),
  )
    .map((category) => {
      const top = leaders
        .filter((row) => row.Category === category.key && Number(row.Value) > 0)
        .sort((a, b) => a.Rank - b.Rank)[0];
      return top ? { category, row: top } : null;
    })
    .filter((item): item is { category: (typeof LEADER_CATEGORIES)[number]; row: RawTop5Row } => item !== null);

  // Ticker strip events (live first, 1 latest completed, upcoming fill up to 6)
  const tickerEvents: CalendarEvent[] = [];
  const seenIds = new Set<string>();
  for (const ev of [...liveEvents, ...completedEvents.slice(0, 1), ...upcomingEvents]) {
    if (seenIds.has(ev.id)) continue;
    seenIds.add(ev.id);
    tickerEvents.push(ev);
    if (tickerEvents.length >= 6) break;
  }

  const featuredEvent =
    dayBoard.events[0] ??
    liveEvents[0] ??
    eventsOnDay(today, events)[0] ??
    upcomingEvents[0] ??
    completedEvents[0] ??
    null;

  const standingMap = new Map(standings.map((s) => [s.code, s]));

  const buildHomeHref = (next: { day?: string; mtab?: string; rtab?: string }) => {
    const qs = new URLSearchParams();
    const d = next.day ?? (focusDay !== today ? focusDay : "");
    const m = next.mtab ?? (mtab !== defaultMTab ? mtab : "");
    const r = next.rtab ?? (rtab !== "pba" ? rtab : "");
    if (d) qs.set("day", d);
    if (m) qs.set("mtab", m);
    if (r) qs.set("rtab", r);
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  };

  // Matches & Results helpers
  const tourResults = (dayBoard.matches.some((m) => m.state === "final")
    ? dayBoard.matches.filter((m) => m.state === "final")
    : recentDayBoard?.matches.filter((m) => m.state === "final") ?? []
  ).slice(0, 4);

  const recentTeamResults = playedFixtures.slice(0, 3);
  const todayScheduled = dayBoard.matches.filter((m) => m.state === "next").slice(0, 6);

  const rankDisplayRows = activeRank.slice(0, 10);
  const clubTableRows = standings.slice(0, 8);
  const upcomingStrip = upcomingEvents.slice(0, 5);

  const nationFor = (memCode: string | null | undefined, name: string | null | undefined) => {
    if (memCode && playerNationByName.has(memCode)) return playerNationByName.get(memCode) ?? null;
    if (name) return playerNationByName.get(name.toLowerCase()) ?? null;
    return null;
  };

  return (
    <>
      {/* ============================================================ EVENT STRIP */}
      <div className="events">
        <div className="wrap">
          {tickerEvents.map((ev) => (
            <Link key={ev.id} href={`/schedule/${ev.id}`} className="ev">
              <span className={cn("tag", leagueTagClass(ev.league))}>{leagueShort(ev.league)}</span>
              <div>
                <div className="t">{ev.title}</div>
                <div className="s">
                  {ev.status === "live" ? (
                    <>
                      <span className="lv">● LIVE</span> · {fmtRange(ev.start, ev.end)}
                      {ev.venue && ev.venue !== "Venue to be announced" ? ` · ${ev.venue}` : ""}
                    </>
                  ) : ev.status === "completed" ? (
                    <>
                      Finished
                      {ev.defendingChampion && ev.defendingChampion !== "—" ? ` · Champion: ${ev.defendingChampion}` : ""}
                    </>
                  ) : (
                    <>
                      Starts {shortDayLabel(isoDay(ev.start))}
                      {ev.championPrize && ev.championPrize !== "—"
                        ? ` · ${ev.championPrize} to winner`
                        : ev.entrants.players
                          ? ` · ${ev.entrants.players} players`
                          : ""}
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ============================================================ 3-COL GRID */}
      <div className="wrap info-grid">
        {/* -------------------------------------------------------- LEFT COL */}
        <aside className="col left">
          <section className="p" aria-label="Matches">
            <div className="ph">
              <h2>Matches</h2>
              <Link className="more" href="/schedule">
                All matches
              </Link>
            </div>
            <div className="tabs" role="tablist" aria-label="Match filter">
              <Link
                href={buildHomeHref({ mtab: "live" })}
                className={mtab === "live" ? "on" : undefined}
              >
                Live{feed.matches.length > 0 && <span className="c">{feed.matches.length}</span>}
              </Link>
              <Link
                href={buildHomeHref({ mtab: "today" })}
                className={mtab === "today" ? "on" : undefined}
              >
                Today
              </Link>
              <Link
                href={buildHomeHref({ mtab: "upcoming" })}
                className={mtab === "upcoming" ? "on" : undefined}
              >
                Upcoming
              </Link>
            </div>

            {mtab === "live" ? (
              feed.matches.length > 0 ? (
                <>
                  <div className="sub">
                    <span className="tag t-team">{feed.matches[0]?.competition ? "Team" : "Tour"}</span>
                    In play now
                    {feed.matches[0]?.venue && <span className="r">{feed.matches[0].venue}</span>}
                  </div>
                  {feed.matches.map((match) => (
                    <LiveSidebarRow key={match.key} match={match} nationFor={nationFor} />
                  ))}
                  {upcomingFixtures.length > 0 && (
                    <>
                      <div className="sub">Later today · Round {liveRound?.라운드}</div>
                      {upcomingFixtures.slice(0, 4).map((fix) => (
                        <TeamSidebarRow key={`${fix.home.name}-${fix.away.name}-${fix.playedAt}`} fixture={fix} round={liveRound?.라운드} seasonCode={teamSeason?.season.시즌코드} roundCode={liveRound ? String(liveRound.라운드코드) : undefined} />
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div className="px-2.5 py-4 text-[12px] text-[var(--muted)]">
                  No matches live on the scoring wire right now.
                </div>
              )
            ) : mtab === "today" ? (
              dayBoard.matches.length > 0 ? (
                <>
                  <div className="sub">
                    {relativeDay(focusDay)}
                    <span className="r">{dayBoard.matches.length} matches</span>
                  </div>
                  {dayBoard.matches.slice(0, 7).map((match) => (
                    <DaySidebarRow key={match.key} match={match} nationFor={nationFor} />
                  ))}
                </>
              ) : upcomingFixtures.length > 0 ? (
                <>
                  <div className="sub">
                    <span className="tag t-team">Team</span>Round {liveRound?.라운드}
                  </div>
                  {upcomingFixtures.slice(0, 5).map((fix) => (
                    <TeamSidebarRow key={`${fix.home.name}-${fix.away.name}-${fix.playedAt}`} fixture={fix} round={liveRound?.라운드} seasonCode={teamSeason?.season.시즌코드} roundCode={liveRound ? String(liveRound.라운드코드) : undefined} />
                  ))}
                </>
              ) : (
                <div className="px-2.5 py-4 text-[12px] text-[var(--muted)]">
                  No matches scheduled for {relativeDay(focusDay).toLowerCase()}.
                </div>
              )
            ) : upcomingFixtures.length > 0 ? (
              <>
                <div className="sub">
                  <span className="tag t-team">Team</span>Next fixtures · Round {liveRound?.라운드}
                </div>
                {upcomingFixtures.slice(0, 5).map((fix) => (
                  <TeamSidebarRow key={`${fix.home.name}-${fix.away.name}-${fix.playedAt}`} fixture={fix} round={liveRound?.라운드} seasonCode={teamSeason?.season.시즌코드} roundCode={liveRound ? String(liveRound.라운드코드) : undefined} />
                ))}
              </>
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.slice(0, 5).map((ev) => (
                <Link key={ev.id} href={`/schedule/${ev.id}`} className="m">
                  <span className="tm">
                    <b>{shortDayLabel(isoDay(ev.start))}</b>
                    {leagueShort(ev.league)}
                  </span>
                  <span className="pl">
                    <span className="font-semibold text-[var(--text)]">{ev.title}</span>
                    <span className="text-[11.5px] text-[var(--muted)]">{ev.venue}</span>
                  </span>
                  <span className="sc muted">→</span>
                </Link>
              ))
            ) : (
              <div className="px-2.5 py-4 text-[12px] text-[var(--muted)]">
                No upcoming fixtures posted yet.
              </div>
            )}

            <Link className="foot" href="/schedule">
              Full schedule →
            </Link>
          </section>

          <section className="p" aria-label="Results">
            <div className="ph">
              <h2>Results</h2>
              <Link className="more" href="/teams/matches">
                More
              </Link>
            </div>

            {tourResults.length > 0 && (
              <>
                <div className="sub">
                  <span className={cn("tag", leagueTagClass(tourResults[0].event?.league))}>
                    {leagueShort(tourResults[0].event?.league ?? "") || "Tour"}
                  </span>
                  {tourResults[0].event?.title ? shortClubName(tourResults[0].event.title) : "Recent finals"}
                  {tourResults[0].at && <span className="r">{shortDayLabel(isoDay(tourResults[0].at))}</span>}
                </div>
                {tourResults.map((match) => (
                  <DaySidebarRow key={match.key} match={match} nationFor={nationFor} />
                ))}
              </>
            )}

            {recentTeamResults.length > 0 && (
              <>
                <div className="sub">
                  <span className="tag t-team">Team</span>Round {liveRound?.라운드 ?? ""}
                  {recentTeamResults[0]?.playedAt && (
                    <span className="r">{shortDayLabel(recentTeamResults[0].playedAt.slice(0, 10))}</span>
                  )}
                </div>
                {recentTeamResults.map((fix) => (
                  <TeamSidebarRow
                    key={`${fix.gameNo ?? fix.home.name}-${fix.away.name}`}
                    fixture={fix}
                    round={liveRound?.라운드}
                    seasonCode={teamSeason?.season.시즌코드}
                    roundCode={liveRound ? String(liveRound.라운드코드) : undefined}
                  />
                ))}
              </>
            )}

            {tourResults.length === 0 && recentTeamResults.length === 0 && (
              <div className="px-2.5 py-4 text-[12px] text-[var(--muted)]">
                Recent results appear here after each tour or Team League session.
              </div>
            )}

            <Link className="foot" href="/teams/matches">
              All results →
            </Link>
          </section>
        </aside>

        {/* -------------------------------------------------------- CENTER COL */}
        <div className="col center">
          <FeaturedMatchPanel
            liveMatch={liveLead}
            teamFixture={featuredTeamFixture}
            bouts={featuredBouts}
            round={liveRound?.라운드}
            roundCode={liveRound ? String(liveRound.라운드코드) : undefined}
            seasonCode={teamSeason?.season.시즌코드}
            standingsMap={standingMap}
            dayMatch={dayBoard.matches[0] ?? recentDayBoard?.matches[0] ?? null}
            featuredEvent={featuredEvent}
            nationFor={nationFor}
          />

          <section className="p" aria-label="Fixtures">
            <div className="ph">
              <h2>
                {relativeDay(focusDay)} · {shortDayLabel(focusDay)}
              </h2>
              <span className="more flex items-center gap-2">
                {lastDay && <Link href={buildHomeHref({ day: lastDay })}>‹ Prev</Link>}
                {nextDay && <Link href={buildHomeHref({ day: nextDay })}>Next ›</Link>}
              </span>
            </div>

            {dayBoard.matches.length > 0 ? (
              <>
                <div className="sub">
                  <span className={cn("tag", leagueTagClass(dayBoard.matches[0].event?.league))}>
                    {leagueShort(dayBoard.matches[0].event?.league ?? "") || "Tour"}
                  </span>
                  {dayBoard.matches[0].event?.title ?? "Scheduled matches"}
                  <span className="r">{dayBoard.matches.length} matches</span>
                </div>
                <div>
                  {dayBoard.matches.slice(0, 8).map((match) => (
                    <CenterFixtureRow key={match.key} match={match} nationFor={nationFor} />
                  ))}
                </div>
              </>
            ) : dayBoard.partial ? (
              <div className="px-3 py-4 text-[12.5px] text-[var(--muted)]">
                Schedule data could not be loaded for {relativeDay(focusDay).toLowerCase()}.
              </div>
            ) : null}

            {(dayBoard.matches.length === 0 || todayScheduled.length === 0) && recentTeamResults.length > 0 && (
              <>
                <div className="sub">
                  <span className="tag t-team">Team</span>
                  {teamSeason ? `PBA Team League ${teamSeason.season.시즌명}` : "Team League"} · Round{" "}
                  {liveRound?.라운드}
                  <span className="r">{roundFixtures.length} fixtures</span>
                </div>
                <div>
                  {[...upcomingFixtures.slice(0, 2), ...recentTeamResults].slice(0, 5).map((fix) => (
                    <CenterTeamRow
                      key={`${fix.gameNo ?? fix.home.name}-${fix.away.name}`}
                      fixture={fix}
                      roundCode={liveRound ? String(liveRound.라운드코드) : undefined}
                      seasonCode={teamSeason?.season.시즌코드}
                    />
                  ))}
                </div>
              </>
            )}

            {dayBoard.matches.length === 0 && (recentDayBoard?.matches.length ?? 0) > 0 && (
              <>
                <div className="sub">
                  <span className={cn("tag", leagueTagClass(recentDayBoard!.matches[0].event?.league))}>
                    {leagueShort(recentDayBoard!.matches[0].event?.league ?? "") || "Tour"}
                  </span>
                  {recentDayBoard!.matches[0].event?.title ?? "Latest session"}
                  <span className="r">
                    {lastDay ? `${relativeDay(lastDay)} · finished` : "Finished"}
                  </span>
                </div>
                <div>
                  {recentDayBoard!.matches.slice(0, 5).map((match) => (
                    <CenterFixtureRow key={match.key} match={match} nationFor={nationFor} />
                  ))}
                </div>
              </>
            )}

            <Link className="foot" href={`/schedule?day=${focusDay}`}>
              Open full match list →
            </Link>
          </section>

          <section className="p" aria-label="News">
            <div className="ph">
              <h2>News</h2>
              <Link className="more" href="/news">
                News archive
              </Link>
            </div>

            {articles.length >= 2 && (
              <div className="newsfeat">
                {articles.slice(0, 2).map((article, index) => {
                  const tag = detectPressTag(article.title);
                  return (
                    <Link key={article.seq} href={`/news/${article.seq}`} className="nf">
                      <div className={cn("img", index === 1 && "b", !article.image && "ph-ball")}>
                        {article.image && (
                          <SafeImage
                            src={article.image}
                            alt=""
                            className="h-full w-full object-cover"
                            fallback={<span className="block h-full w-full" />}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className={cn("tag", tag.cls)}>{tag.label}</span>
                        <h3 className="line-clamp-2">{article.title}</h3>
                        <p>
                          {fmtDate(article.date)}
                          {article.views > 0 ? ` · ${grouped(article.views)} views` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {articles.length > 2 && (
              <>
                <div className="sub">Latest press</div>
                <div>
                  {articles.slice(2, 9).map((article) => {
                    const tag = detectPressTag(article.title);
                    return (
                      <Link key={article.seq} href={`/news/${article.seq}`} className="nw">
                        <span className="ic">
                          <span className={cn("tag", tag.cls)}>{tag.label}</span>
                        </span>
                        <span className="tt">{article.title}</span>
                        <span className="ago">{shortDayLabel(isoDay(article.date))}</span>
                        <span className="cm n">
                          {article.views > 0 ? grouped(article.views) : "—"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            <Link className="foot" href="/news">
              More news →
            </Link>
          </section>
        </div>

        {/* -------------------------------------------------------- RIGHT COL */}
        <aside className="col right">
          <section className="p" aria-label="Rankings">
            <div className="ph">
              <h2>Ranking · {rtab === "lpba" ? "LPBA" : rtab === "money" ? "Money" : "PBA"}</h2>
              <Link className="more" href="/rankings">
                Full ranking
              </Link>
            </div>
            <div className="tabs" role="tablist" aria-label="Ranking circuit">
              <Link href={buildHomeHref({ rtab: "pba" })} className={rtab === "pba" ? "on" : undefined}>
                PBA
              </Link>
              <Link href={buildHomeHref({ rtab: "lpba" })} className={rtab === "lpba" ? "on" : undefined}>
                LPBA
              </Link>
              <Link href={buildHomeHref({ rtab: "money" })} className={rtab === "money" ? "on" : undefined}>
                Money
              </Link>
            </div>

            <table className="rk n">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>{rtab === "money" ? "Prize" : "Pts"}</th>
                </tr>
              </thead>
              <tbody>
                {rankDisplayRows.map((row, index) => {
                  const displayName = cleanPlayerName(row.PlayerNameEN) || resolveKoreanName(row.PlayerNameKO, nameIndex);
                  const rank = row.Rank || index + 1;
                  const val = rtab === "money" ? wonCompact(row.Prize) : grouped(row.RankingPoint);
                  return (
                    <tr key={`${row.MemCode}-${index}`}>
                      <td className="pos">{rank}</td>
                      <td className="nm">
                        <Link href={`/players/${row.MemCode}`}>
                          <span>
                            <i className={flagClass(row.NationCode)} aria-hidden="true" />
                            <span className="min-w-0 truncate">{displayName}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="v">{val}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <Link className="foot" href="/rankings">
              {seasonLabel(season)} ranking · full list →
            </Link>
          </section>

          {clubTableRows.length > 0 && (
            <section className="p" aria-label="Team League standings">
              <div className="ph">
                <h2>Team League</h2>
                <Link className="more" href="/teams">
                  Table
                </Link>
              </div>
              <table className="rk has-wl n">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Club</th>
                    <th>W–L</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {clubTableRows.map((team, index) => {
                    const badge = clubBadge(team.name, index);
                    return (
                      <tr key={team.code}>
                        <td className="pos">{team.rank || index + 1}</td>
                        <td className="nm">
                          <Link href={`/teams/${encodeURIComponent(team.code)}`}>
                            <span>
                              <i className={cn("cr", badge.cls)} aria-hidden="true">
                                {badge.code}
                              </i>
                              <span className="min-w-0 truncate">{shortClubName(team.name)}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="wl text-[var(--text-2)]">
                          {team.wins}–{team.losses}
                        </td>
                        <td className="v">{team.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {spotlightPlayer && (
            <section className="p" aria-label="Player spotlight">
              <div className="ph">
                <h2>Player spotlight</h2>
                <Link className="more" href={`/players/${spotlightPlayer.code}`}>
                  Profile
                </Link>
              </div>
              <Link href={`/players/${spotlightPlayer.code}`} className="spot hover:bg-[var(--hover)]">
                <div className="ph2">
                  {spotlightPlayer.photoPath || spotlightPlayer.photoLarge || spotlightPlayer.photo ? (
                    <SafeImage
                      src={photoUrl(spotlightPlayer.photoPath, 160) ?? spotlightPlayer.photoLarge ?? spotlightPlayer.photo}
                      alt={spotlightPlayer.name}
                      loading="eager"
                      className="h-full w-full object-cover object-top"
                      fallback={<i aria-hidden="true" />}
                    />
                  ) : (
                    <i aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate">{spotlightPlayer.name}</h3>
                  <div className="m2">
                    <i className={flagClass(spotlightPlayer.nation)} aria-hidden="true" />
                    <span>
                      {spotlightPlayer.nation} · {leagueByCode(spotlightPlayer.league).name}
                    </span>
                  </div>
                  <div className="m2 mt-1.5">
                    {spotlightPlayer.wins} wins, {spotlightPlayer.losses} losses · Rank #
                    {spotlightPlayer.pointsRank || spotlightPlayer.prizeRank || 1}
                  </div>
                </div>
              </Link>
              <dl className="kv n">
                <div>
                  <dt>Avg</dt>
                  <dd className="hi">{spotlightPlayer.average ? spotlightPlayer.average.toFixed(3) : "—"}</dd>
                </div>
                <div>
                  <dt>HR</dt>
                  <dd>{spotlightPlayer.highRun || "—"}</dd>
                </div>
                <div>
                  <dt>Win %</dt>
                  <dd>{percent(winRate(spotlightPlayer))}</dd>
                </div>
                <div>
                  <dt>Bank %</dt>
                  <dd>{percent(spotlightPlayer.bankShotRate)}</dd>
                </div>
              </dl>
            </section>
          )}

          {upcomingStrip.length > 0 && (
            <section className="p" aria-label="Upcoming events">
              <div className="ph">
                <h2>Upcoming events</h2>
                <Link className="more" href="/schedule">
                  Calendar
                </Link>
              </div>
              {upcomingStrip.map((ev) => {
                const dp = dateParts(ev.start);
                return (
                  <Link key={ev.id} href={`/schedule/${ev.id}`} className="el">
                    <span className="d n">
                      {dp.day}
                      <small>{dp.month}</small>
                    </span>
                    <span className="t">
                      <span className={cn("tag", leagueTagClass(ev.league))}>{leagueShort(ev.league)}</span>{" "}
                      {ev.title}
                    </span>
                    <span className="pz">
                      <b>{ev.championPrize !== "—" ? ev.championPrize : ev.prizePool}</b>
                      {ev.championPrize !== "—" ? "winner" : "purse"}
                    </span>
                    <span className="s">
                      {ev.venue}
                      {ev.entrants.players ? ` · ${ev.entrants.players} players` : ""}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}

          {leaderPicks.length > 0 && (
            <section className="p" aria-label="Season leaders">
              <div className="ph">
                <h2>Season leaders</h2>
                <Link className="more" href="/records">
                  Stats
                </Link>
              </div>
              <table className="rk n">
                <tbody>
                  {leaderPicks.map(({ category, row }) => {
                    const name = resolveLeaderName(row);
                    const href = row.MemCode
                      ? `/players/${row.MemCode}`
                      : playerCodeByName.get(name.toLowerCase())
                        ? `/players/${playerCodeByName.get(name.toLowerCase())}`
                        : null;
                    const nation = nationFor(row.MemCode, name);
                    const val = category.unit === "avg"
                      ? Number(row.Value).toFixed(3)
                      : category.unit === "pct"
                        ? `${Number(row.Value).toFixed(1)}%`
                        : grouped(Number(row.Value));
                    return (
                      <tr key={category.key}>
                        <td className="nm muted">{category.label}</td>
                        <td className="nm">
                          {href ? (
                            <Link href={href}>
                              <span>
                                <i className={flagClass(nation)} aria-hidden="true" />
                                {name}
                              </span>
                            </Link>
                          ) : (
                            <span>
                              <i className={flagClass(nation)} aria-hidden="true" />
                              {name}
                            </span>
                          )}
                        </td>
                        <td className="v">{val}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- helpers */

function LiveSidebarRow({
  match,
  nationFor,
}: {
  match: LiveMatch;
  nationFor: (code?: string | null, name?: string | null) => string | null;
}) {
  const [a, b] = match.sides;
  const sa = match.fixtureScore ? match.fixtureScore[0] : a?.setsWon ?? 0;
  const sb = match.fixtureScore ? match.fixtureScore[1] : b?.setsWon ?? 0;
  const href = match.pstCode ? `/matches/${match.pstCode}?live=1` : "/live";

  return (
    <Link href={href} className="m">
      <span className="tm lv">
        <b>LIVE</b>
        {match.latestSet.setNo > 0 ? `Set ${match.latestSet.setNo}` : "Now"}
      </span>
      <span className="pl">
        <span>
          {match.competition ? (
            <i className={cn("cr", clubBadge(a?.name ?? "", 0).cls)}>{clubBadge(a?.name ?? "", 0).code}</i>
          ) : (
            <i className={flagClass(nationFor(null, a?.name))} />
          )}
          <b className={sa > sb ? "font-semibold" : "font-normal"}>{shortClubName(a?.name ?? "Side 1")}</b>
        </span>
        <span>
          {match.competition ? (
            <i className={cn("cr", clubBadge(b?.name ?? "", 1).cls)}>{clubBadge(b?.name ?? "", 1).code}</i>
          ) : (
            <i className={flagClass(nationFor(null, b?.name))} />
          )}
          <b className={sb > sa ? "font-semibold" : "font-normal"}>{shortClubName(b?.name ?? "Side 2")}</b>
        </span>
      </span>
      <span className="sc n">
        <span className="lv">{sa}</span>
        <span className="lv">{sb}</span>
      </span>
    </Link>
  );
}

function DaySidebarRow({
  match,
  nationFor,
}: {
  match: DayMatch;
  nationFor: (code?: string | null, name?: string | null) => string | null;
}) {
  const href = match.href ?? "/schedule";
  const isFinal = match.state === "final";
  const isLive = match.state === "live";

  return (
    <Link href={href} className="m">
      <span className={cn("tm", isLive && "lv")}>
        <b>{isLive ? "LIVE" : isFinal ? "FT" : match.clock || "TBA"}</b>
        {match.matchNo ? `M${match.matchNo}` : ""}
      </span>
      <span className="pl">
        <span className={isFinal ? (match.homeWon ? "won" : "lost") : undefined}>
          <i className={flagClass(nationFor(match.homeMemCode, match.home))} aria-hidden="true" />
          {match.home}
        </span>
        <span className={isFinal ? (match.awayWon ? "won" : "lost") : undefined}>
          <i className={flagClass(nationFor(match.awayMemCode, match.away))} aria-hidden="true" />
          {match.away}
        </span>
      </span>
      <span className="sc n">
        {isFinal || isLive ? (
          <>
            <span className={isLive ? "lv" : !match.homeWon ? "lost" : undefined}>{match.homeSets ?? "–"}</span>
            <span className={isLive ? "lv" : !match.awayWon ? "lost" : undefined}>{match.awaySets ?? "–"}</span>
          </>
        ) : (
          <span className="muted">–</span>
        )}
      </span>
    </Link>
  );
}

function TeamSidebarRow({
  fixture,
  round,
  seasonCode,
  roundCode,
}: {
  fixture: TeamFixture;
  round?: number;
  seasonCode?: string;
  roundCode?: string;
}) {
  const b1 = clubBadge(fixture.home.name, 0);
  const b2 = clubBadge(fixture.away.name, 1);
  const href =
    fixture.gameNo && roundCode && seasonCode
      ? `/teams/matches/${fixture.gameNo}?season=${seasonCode}&round=${roundCode}`
      : "/teams/matches";

  return (
    <Link href={href} className="m">
      <span className="tm">
        <b>{fixture.played ? "FT" : shortClock(fixture.playedAt)}</b>
        {round ? `R${round}` : ""}
      </span>
      <span className="pl">
        <span className={fixture.played ? (fixture.home.won ? "won" : "lost") : undefined}>
          <i className={cn("cr", b1.cls)} aria-hidden="true">
            {b1.code}
          </i>
          {shortClubName(fixture.home.name)}
        </span>
        <span className={fixture.played ? (fixture.away.won ? "won" : "lost") : undefined}>
          <i className={cn("cr", b2.cls)} aria-hidden="true">
            {b2.code}
          </i>
          {shortClubName(fixture.away.name)}
        </span>
      </span>
      <span className="sc n">
        {fixture.played ? (
          <>
            <span className={!fixture.home.won ? "lost" : undefined}>{fixture.home.sets ?? "–"}</span>
            <span className={!fixture.away.won ? "lost" : undefined}>{fixture.away.sets ?? "–"}</span>
          </>
        ) : (
          <>
            <span className="muted">–</span>
            <span className="muted">–</span>
          </>
        )}
      </span>
    </Link>
  );
}

function CenterFixtureRow({
  match,
  nationFor,
}: {
  match: DayMatch;
  nationFor: (code?: string | null, name?: string | null) => string | null;
}) {
  const href = match.href ?? "/schedule";
  const isFinal = match.state === "final";
  const isLive = match.state === "live";

  return (
    <Link href={href} className="fx">
      <span className={cn("tm", isLive ? "lv" : isFinal && "ft")}>
        {isLive ? "LIVE" : isFinal ? match.round || "Final" : match.clock || "TBA"}
      </span>
      <span className={cn("a", isFinal && !match.homeWon && "lost")}>
        <span className={match.homeWon ? "font-bold" : undefined}>{match.home}</span>
        <i className={flagClass(nationFor(match.homeMemCode, match.home))} aria-hidden="true" />
      </span>
      <span className={cn("sc n", isLive ? "lv" : !isFinal && "up")}>
        {isFinal || isLive ? `${match.homeSets ?? 0} – ${match.awaySets ?? 0}` : "vs"}
      </span>
      <span className={cn("b", isFinal && !match.awayWon && "lost")}>
        <i className={flagClass(nationFor(match.awayMemCode, match.away))} aria-hidden="true" />
        <span className={match.awayWon ? "font-bold" : undefined}>{match.away}</span>
      </span>
      <span className="sets n">
        {match.homeAverage
          ? `avg ${match.homeAverage.toFixed(3)}${match.homeHighRun ? ` · HR ${match.homeHighRun}` : ""}`
          : match.round}
      </span>
      <span className="tv">{match.matchNo ? `M${match.matchNo}` : ""}</span>
    </Link>
  );
}

function CenterTeamRow({
  fixture,
  roundCode,
  seasonCode,
}: {
  fixture: TeamFixture;
  roundCode?: string;
  seasonCode?: string;
}) {
  const b1 = clubBadge(fixture.home.name, 0);
  const b2 = clubBadge(fixture.away.name, 1);
  const href =
    fixture.gameNo && roundCode && seasonCode
      ? `/teams/matches/${fixture.gameNo}?season=${seasonCode}&round=${roundCode}`
      : "/teams/matches";

  return (
    <Link href={href} className="fx">
      <span className={cn("tm", fixture.played && "ft")}>
        {fixture.played ? "FT" : shortClock(fixture.playedAt)}
      </span>
      <span className={cn("a", fixture.played && !fixture.home.won && "lost")}>
        <span className={fixture.home.won ? "font-bold" : undefined}>{shortClubName(fixture.home.name)}</span>
        <i className={cn("cr", b1.cls)} aria-hidden="true">
          {b1.code}
        </i>
      </span>
      <span className={cn("sc n", !fixture.played && "up")}>
        {fixture.played ? `${fixture.home.sets ?? 0} – ${fixture.away.sets ?? 0}` : "vs"}
      </span>
      <span className={cn("b", fixture.played && !fixture.away.won && "lost")}>
        <i className={cn("cr", b2.cls)} aria-hidden="true">
          {b2.code}
        </i>
        <span className={fixture.away.won ? "font-bold" : undefined}>{shortClubName(fixture.away.name)}</span>
      </span>
      <span className="sets n">
        {fixture.home.average ? `avg ${fixture.home.average.toFixed(3)}` : fixture.playedAt?.slice(0, 10) ?? ""}
      </span>
      <span className="tv">{fixture.gameNo ? `#${fixture.gameNo}` : ""}</span>
    </Link>
  );
}

function FeaturedMatchPanel({
  liveMatch,
  teamFixture,
  bouts,
  round,
  roundCode,
  seasonCode,
  standingsMap,
  dayMatch,
  featuredEvent,
  nationFor,
}: {
  liveMatch: LiveMatch | null;
  teamFixture: TeamFixture | null;
  bouts: FixtureBouts | null;
  round?: number;
  roundCode?: string;
  seasonCode?: string;
  standingsMap: Map<string, ReturnType<typeof normalizeTeam>>;
  dayMatch: DayMatch | null;
  featuredEvent: CalendarEvent | null;
  nationFor: (code?: string | null, name?: string | null) => string | null;
}) {
  if (liveMatch) {
    const [a, b] = liveMatch.sides;
    const scoreA = liveMatch.fixtureScore ? liveMatch.fixtureScore[0] : a?.setsWon ?? 0;
    const scoreB = liveMatch.fixtureScore ? liveMatch.fixtureScore[1] : b?.setsWon ?? 0;
    const isTeam = Boolean(liveMatch.competition);
    const badgeA = clubBadge(a?.name ?? "Home", 0);
    const badgeB = clubBadge(b?.name ?? "Away", 1);

    return (
      <section className="p" aria-label="Featured live match">
        <div className="feat-h">
          <span className="lvp">
            <i aria-hidden="true" />
            LIVE
          </span>
          <span className={cn("tag", isTeam ? "t-team" : "t-pba")}>{isTeam ? "Team" : "Tour"}</span>
          <b>{liveMatch.competition ?? "Live Match"}</b>
          <span className="r muted">
            {liveMatch.latestSet.setNo > 0 ? `Set ${liveMatch.latestSet.setNo}` : "In play"}
            {liveMatch.venue ? ` · ${liveMatch.venue}` : ""}
          </span>
        </div>

        <div className="feat">
          <div className="side a">
            {isTeam ? (
              <i className={cn("cr lg", badgeA.cls)}>{badgeA.code}</i>
            ) : (
              <i className={flagClass(nationFor(null, a?.name))} />
            )}
            <div className="min-w-0">
              <div className="nm truncate">{a?.name ?? "Side 1"}</div>
              {liveMatch.players?.[0] && <div className="sm truncate">{liveMatch.players[0]}</div>}
            </div>
          </div>
          <div className="big n">
            <span className={scoreA < scoreB ? "lose" : undefined}>{scoreA}</span>
            <span className="dash">:</span>
            <span className={scoreB < scoreA ? "lose" : undefined}>{scoreB}</span>
          </div>
          <div className="side b">
            {isTeam ? (
              <i className={cn("cr lg", badgeB.cls)}>{badgeB.code}</i>
            ) : (
              <i className={flagClass(nationFor(null, b?.name))} />
            )}
            <div className="min-w-0">
              <div className="nm truncate">{b?.name ?? "Side 2"}</div>
              {liveMatch.players?.[1] && <div className="sm truncate">{liveMatch.players[1]}</div>}
            </div>
          </div>
        </div>

        {liveMatch.completedSets.length > 0 && (
          <div className="setstrip n">
            {liveMatch.completedSets.map((pair, idx) => (
              <div key={idx}>
                <small>S{idx + 1}</small>
                <b className={pair[0] > pair[1] ? undefined : "l"}>{pair[0]}</b>:
                <b className={pair[1] > pair[0] ? undefined : "l"}>{pair[1]}</b>
              </div>
            ))}
            {liveMatch.latestSet.setNo > liveMatch.completedSets.length && (
              <div className="cur">
                <small>S{liveMatch.latestSet.setNo}</small>
                <b>{a?.points ?? 0}</b>:{b?.points ?? 0}
              </div>
            )}
          </div>
        )}

        <dl className="statsrow n">
          <div>
            <dt>Set avg</dt>
            <dd>
              {a?.average?.toFixed(3) ?? "—"} <i>/ {b?.average?.toFixed(3) ?? "—"}</i>
            </dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd>
              {a?.points ?? 0} <i>/ {b?.points ?? 0}</i>
            </dd>
          </div>
          <div>
            <dt>Innings</dt>
            <dd>{a?.innings ?? b?.innings ?? "—"}</dd>
          </div>
          <div>
            <dt>Set</dt>
            <dd>{liveMatch.latestSet.setNo || 1}</dd>
          </div>
          <div>
            <dt>Watch</dt>
            <dd>
              <Link href={liveMatch.pstCode ? `/matches/${liveMatch.pstCode}?live=1` : "/live"} className="text-[var(--link)]">
                Match centre →
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  if (teamFixture && bouts) {
    const hStand = teamFixture.home.clubCode ? standingsMap.get(teamFixture.home.clubCode) : undefined;
    const aStand = teamFixture.away.clubCode ? standingsMap.get(teamFixture.away.clubCode) : undefined;
    const b1 = clubBadge(teamFixture.home.name, 0);
    const b2 = clubBadge(teamFixture.away.name, 1);
    const detailHref =
      teamFixture.gameNo && seasonCode && roundCode
        ? `/teams/matches/${teamFixture.gameNo}?season=${seasonCode}&round=${roundCode}`
        : "/teams/matches";

    const boutRows = bouts.bouts.slice(0, 7);

    return (
      <section className="p" aria-label="Featured fixture">
        <div className="feat-h">
          <span className="tag t-team">Team</span>
          <b>
            <Link href={detailHref} className="hover:text-[var(--link)]">
              Team League{round ? ` · Round ${round}` : ""}{teamFixture.gameNo ? ` · Match ${teamFixture.gameNo}` : ""}
            </Link>
          </b>
          <span className="r muted">
            {teamFixture.played ? "Full time · Best of 7" : shortClock(teamFixture.playedAt)}
          </span>
        </div>

        <div className="feat">
          <div className="side a">
            <i className={cn("cr lg", b1.cls)}>{b1.code}</i>
            <div className="min-w-0">
              <div className="nm truncate">
                <Link href={detailHref}>{teamFixture.home.name}</Link>
              </div>
              {hStand && (
                <div className="sm">
                  #{hStand.rank} · {hStand.wins}–{hStand.losses} · {hStand.points} pts
                </div>
              )}
            </div>
          </div>
          <div className="big n">
            <span className={!teamFixture.home.won ? "lose" : undefined}>{teamFixture.home.sets ?? 0}</span>
            <span className="dash">:</span>
            <span className={!teamFixture.away.won ? "lose" : undefined}>{teamFixture.away.sets ?? 0}</span>
          </div>
          <div className="side b">
            <i className={cn("cr lg", b2.cls)}>{b2.code}</i>
            <div className="min-w-0">
              <div className="nm truncate">
                <Link href={detailHref}>{teamFixture.away.name}</Link>
              </div>
              {aStand && (
                <div className="sm">
                  #{aStand.rank} · {aStand.wins}–{aStand.losses} · {aStand.points} pts
                </div>
              )}
            </div>
          </div>
        </div>

        {boutRows.length > 0 && (
          <>
            <div className="setstrip n">
              {boutRows.map((bout) => {
                const s1 = bout.sides[0];
                const s2 = bout.sides[1];
                return (
                  <div key={bout.setNo}>
                    <small>
                      S{bout.setNo}
                      {bout.format ? <span className="ty"> · {bout.format}</span> : null}
                    </small>
                    <b className={s1?.won ? undefined : "l"}>{s1?.points ?? "–"}</b>:
                    <b className={s2?.won ? undefined : "l"}>{s2?.points ?? "–"}</b>
                  </div>
                );
              })}
            </div>

            <div className="lineup">
              <div>
                <h4>{shortClubName(teamFixture.home.name)} · sets played</h4>
                <ul>
                  {boutRows.slice(0, 4).map((bout) => {
                    const side = bout.sides[0];
                    if (!side) return null;
                    return (
                      <li key={`h-${bout.setNo}`}>
                        <span className="truncate">
                          <span className={cn("res", side.won ? "W" : "L")}>{side.won ? "W" : "L"}</span>
                          <span className="truncate">{side.names.join(" / ")}</span>
                        </span>
                        <span className="n muted shrink-0">
                          {side.points ?? 0}:{bout.sides[1]?.points ?? 0}
                          {side.average ? ` · ${side.average.toFixed(3)}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <h4>{shortClubName(teamFixture.away.name)} · sets played</h4>
                <ul>
                  {boutRows.slice(0, 4).map((bout) => {
                    const side = bout.sides[1];
                    if (!side) return null;
                    return (
                      <li key={`a-${bout.setNo}`}>
                        <span className="truncate">
                          <span className={cn("res", side.won ? "W" : "L")}>{side.won ? "W" : "L"}</span>
                          <span className="truncate">{side.names.join(" / ")}</span>
                        </span>
                        <span className="n muted shrink-0">
                          {side.points ?? 0}:{bout.sides[0]?.points ?? 0}
                          {side.average ? ` · ${side.average.toFixed(3)}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        )}

        <dl className="statsrow n">
          <div>
            <dt>Team avg</dt>
            <dd>
              {teamFixture.home.average?.toFixed(3) ?? "—"} <i>/ {teamFixture.away.average?.toFixed(3) ?? "—"}</i>
            </dd>
          </div>
          <div>
            <dt>High run</dt>
            <dd>
              {teamFixture.home.highRun ?? "—"} <i>/ {teamFixture.away.highRun ?? "—"}</i>
            </dd>
          </div>
          <div>
            <dt>Bouts</dt>
            <dd>{bouts.bouts.length}</dd>
          </div>
          <div>
            <dt>Played</dt>
            <dd>{teamFixture.playedAt?.slice(0, 10) ?? "—"}</dd>
          </div>
          <div>
            <dt>Scorecard</dt>
            <dd>
              <Link href={detailHref} className="text-[var(--link)]">
                Full bouts →
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  if (dayMatch) {
    const setsText = parseSetsList(dayMatch.at);
    void setsText;
    return (
      <section className="p" aria-label="Featured match">
        <div className="feat-h">
          <span className={cn("tag", leagueTagClass(dayMatch.event?.league))}>
            {leagueShort(dayMatch.event?.league ?? "") || "Tour"}
          </span>
          <b>
            <Link href={dayMatch.href ?? "/schedule"} className="hover:text-[var(--link)]">
              {dayMatch.event?.title ?? "Tournament Match"} · {dayMatch.round}
            </Link>
          </b>
          <span className="r muted">{dayMatch.at ?? "Result"}</span>
        </div>

        <div className="feat">
          <div className="side a">
            <i className={flagClass(nationFor(dayMatch.homeMemCode, dayMatch.home))} aria-hidden="true" />
            <div className="min-w-0">
              <div className="nm truncate">
                {dayMatch.homeMemCode ? <Link href={`/players/${dayMatch.homeMemCode}`}>{dayMatch.home}</Link> : dayMatch.home}
              </div>
              <div className="sm">{dayMatch.homeAverage ? `Avg ${dayMatch.homeAverage.toFixed(3)}` : dayMatch.round}</div>
            </div>
          </div>
          <div className="big n">
            <span className={!dayMatch.homeWon ? "lose" : undefined}>{dayMatch.homeSets ?? 0}</span>
            <span className="dash">:</span>
            <span className={!dayMatch.awayWon ? "lose" : undefined}>{dayMatch.awaySets ?? 0}</span>
          </div>
          <div className="side b">
            <i className={flagClass(nationFor(dayMatch.awayMemCode, dayMatch.away))} aria-hidden="true" />
            <div className="min-w-0">
              <div className="nm truncate">
                {dayMatch.awayMemCode ? <Link href={`/players/${dayMatch.awayMemCode}`}>{dayMatch.away}</Link> : dayMatch.away}
              </div>
              <div className="sm">{dayMatch.awayAverage ? `Avg ${dayMatch.awayAverage.toFixed(3)}` : dayMatch.round}</div>
            </div>
          </div>
        </div>

        <dl className="statsrow n">
          <div>
            <dt>Average</dt>
            <dd>
              {dayMatch.homeAverage?.toFixed(3) ?? "—"} <i>/ {dayMatch.awayAverage?.toFixed(3) ?? "—"}</i>
            </dd>
          </div>
          <div>
            <dt>High run</dt>
            <dd>
              {dayMatch.homeHighRun ?? "—"} <i>/ {dayMatch.awayHighRun ?? "—"}</i>
            </dd>
          </div>
          <div>
            <dt>Round</dt>
            <dd>{dayMatch.round || "—"}</dd>
          </div>
          <div>
            <dt>Match</dt>
            <dd>{dayMatch.matchNo ? `#${dayMatch.matchNo}` : "—"}</dd>
          </div>
          <div>
            <dt>Scorecard</dt>
            <dd>
              <Link href={dayMatch.href ?? "/schedule"} className="text-[var(--link)]">
                Turn-by-turn →
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  if (!featuredEvent) return null;

  return (
    <section className="p" aria-label="Featured tournament">
      <div className="feat-h">
        <span className={cn("tag", leagueTagClass(featuredEvent.league))}>{leagueShort(featuredEvent.league)}</span>
        <b>{featuredEvent.status === "live" ? "Current tournament" : "Next featured tournament"}</b>
        <span className="r muted">{fmtRange(featuredEvent.start, featuredEvent.end)}</span>
      </div>
      <div className="px-4 py-3.5">
        <h3 className="font-display text-[22px] font-bold leading-tight text-[var(--text)]">
          <Link href={`/schedule/${featuredEvent.id}`}>{featuredEvent.title}</Link>
        </h3>
        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
          {featuredEvent.venue}
          {featuredEvent.defendingChampion && featuredEvent.defendingChampion !== "—"
            ? ` · Champion: ${featuredEvent.defendingChampion}`
            : ""}
        </p>
      </div>
      <dl className="statsrow n">
        <div>
          <dt>Dates</dt>
          <dd>{fmtRange(featuredEvent.start, featuredEvent.end)}</dd>
        </div>
        <div>
          <dt>Prize pool</dt>
          <dd>{featuredEvent.prizePool}</dd>
        </div>
        <div>
          <dt>Winner</dt>
          <dd>{featuredEvent.championPrize}</dd>
        </div>
        <div>
          <dt>Champion</dt>
          <dd>{featuredEvent.defendingChampion}</dd>
        </div>
        <div>
          <dt>Event</dt>
          <dd>
            <Link href={`/schedule/${featuredEvent.id}`} className="text-[var(--link)]">
              Open draw →
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
