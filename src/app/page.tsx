import type { Metadata } from "next";
import Link from "next/link";
import { getPressList, getTeamStandings } from "@/lib/pba/api";
import { getDayBoard } from "@/lib/pba/matches-on-day";
import {
  getActiveTeamSeason,
  getCurrentSeason,
  getLeaders,
  getPlayerNameIndex,
  getRankingBoard,
  resolveKoreanName,
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
import {
  LEADER_CATEGORIES,
  leagueByCode,
  leagueShort,
  normalizeArticle,
  normalizeTeam,
} from "@/lib/normalize";
import {
  cleanPlayerName,
  dateParts,
  excerpt,
  fmtDate,
  fmtRange,
  grouped,
  hasHangul,
  isoDay,
  kstDay,
  percent,
  pick,
  relativeDay,
  shiftIsoDay,
} from "@/lib/format";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/components/ui/primitives";
import type { RawTop5Row } from "@/lib/pba/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Today — Matches, Live Scores & Standings",
  description:
    "Live 3-cushion carom scores, PBA and LPBA tournament schedules, match cards, prize rankings and Team League standings.",
};

interface HomePageProps {
  searchParams?: Promise<{ day?: string; circuit?: string; money?: string }>;
}

const VALID_CIRCUITS = ["PBA1", "LPBA1", "PBA2"] as const;
const VALID_MONEY = ["PBA1", "LPBA1"] as const;

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const today = kstDay();
  const focusDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  const circuit = VALID_CIRCUITS.includes(params.circuit as (typeof VALID_CIRCUITS)[number])
    ? (params.circuit as (typeof VALID_CIRCUITS)[number])
    : "PBA1";
  const moneyLeague = VALID_MONEY.includes(params.money as (typeof VALID_MONEY)[number])
    ? (params.money as (typeof VALID_MONEY)[number])
    : "PBA1";

  const season = await getCurrentSeason();
  const seasonCode = season.SeasonCode;

  const [feed, dayBoard, press, moneyRank, teamSeason, leaders] = await Promise.all([
    getLiveFeed(),
    getDayBoard(focusDay),
    getPressList(1, 6),
    getRankingBoard({ kind: "prize", leagueCode: moneyLeague, season: seasonCode }),
    getActiveTeamSeason(),
    getLeaders(seasonCode, circuit),
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

  const articles = press.list.map(normalizeArticle);
  const nameIndex = getPlayerNameIndex();

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
  const featured =
    dayBoard.events[0] ??
    liveEvents[0] ??
    eventsOnDay(today, events)[0] ??
    upcomingEvents[0] ??
    completedEvents[0] ??
    null;

  const resolveLeaderName = (row: RawTop5Row) => {
    const raw = cleanPlayerName(row.MemNameEn || row.MemName);
    return hasHangul(raw) ? resolveKoreanName(raw, nameIndex) : raw;
  };

  const leaderPicks = LEADER_CATEGORIES.filter((category) =>
    ["에버리지", "하이런", "최다승", "공격성공률"].includes(category.key),
  )
    .map((category) => ({
      category,
      rows: leaders
        .filter((row) => row.Category === category.key && Number(row.Value) > 0)
        .sort((a, b) => a.Rank - b.Rank)
        .slice(0, 3),
    }))
    .filter((group) => group.rows.length > 0);

  const moneyRows = moneyRank.slice(0, 6);
  const maxPrize = moneyRows[0]?.Prize || 1;
  const calendarStrip = upcomingEvents.slice(0, 6);

  const liveLead = feed.matches[0] ?? null;
  const dayLead = dayBoard.matches[0] ?? null;

  const buildHomeHref = (next: { day?: string; circuit?: string; money?: string }) => {
    const qs = new URLSearchParams();
    const d = next.day ?? (focusDay !== today ? focusDay : "");
    const c = next.circuit ?? (circuit !== "PBA1" ? circuit : "");
    const m = next.money ?? (moneyLeague !== "PBA1" ? moneyLeague : "");
    if (d) qs.set("day", d);
    if (c) qs.set("circuit", c);
    if (m) qs.set("money", m);
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  };

  const roundLabel = teamSeason?.liveRound ? `Round ${teamSeason.liveRound.라운드}` : "Season";

  return (
    <>
      {/* ============================================================ SCORE RIBBON */}
      <div className="border-b border-[var(--ink)] bg-[var(--paper)]">
        <div className="wrap no-scrollbar mask-fade-r flex items-stretch overflow-x-auto lg:[mask-image:none]">
          <div className="flex min-w-[132px] shrink-0 flex-col justify-center border-r border-[var(--hair)] py-2.5 pr-4">
            <strong className="x text-[22px] text-[var(--ink)]">
              {focusDay === today ? "Today" : relativeDay(focusDay)}
            </strong>
            <small className="mt-0.5 truncate text-[12px] text-[var(--ink-3)]">
              {dayBoard.matches.length > 0
                ? `${dayBoard.matches.length} match${dayBoard.matches.length === 1 ? "" : "es"}`
                : featured
                  ? leagueShort(featured.league)
                  : seasonLabel(season)}
            </small>
          </div>

          {feed.matches.length > 0 || dayBoard.matches.length > 0 ? (
            <>
              {feed.matches.slice(0, 3).map((match) => (
                <Link
                  key={`rb-live-${match.key}`}
                  href={match.pstCode ? `/matches/${match.pstCode}?live=1` : "/live"}
                  className="grid min-w-[208px] shrink-0 grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-r border-[var(--hair)] px-4 py-2.5 text-[14px] hover:bg-[var(--paper-2)] hover:no-underline"
                >
                  <span className="col-span-full text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--red)]">
                    ● Live · Set {match.latestSet.setNo || 1}
                  </span>
                  {match.sides.slice(0, 2).map((side, idx) => (
                    <span key={idx} className="contents">
                      <span className="flex items-center gap-1.5 whitespace-nowrap font-bold text-[var(--ink)]">
                        <i className={idx === 0 ? "ball w" : "ball y"} />
                        <span className="max-w-[140px] truncate">{side.name}</span>
                      </span>
                      <span className="num text-right font-extrabold text-[var(--ink)]">
                        {match.fixtureScore ? match.fixtureScore[idx] : side.points ?? side.setsWon}
                      </span>
                    </span>
                  ))}
                </Link>
              ))}
              {dayBoard.matches
                .filter((m) => m.state !== "live")
                .slice(0, Math.max(0, 4 - feed.matches.length))
                .map((match) => (
                  <Link
                    key={`rb-day-${match.key}`}
                    href={match.href ?? "/schedule"}
                    className="grid min-w-[208px] shrink-0 grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-r border-[var(--hair)] px-4 py-2.5 text-[14px] hover:bg-[var(--paper-2)] hover:no-underline"
                  >
                    <span className="col-span-full text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                      {match.state === "final" ? `Final · ${match.round}` : `${match.clock ?? "Scheduled"} · ${match.round}`}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 whitespace-nowrap",
                        match.state === "final" && !match.homeWon ? "text-[var(--ink-3)]" : "font-bold text-[var(--ink)]",
                      )}
                    >
                      <i className="ball w" />
                      <span className="max-w-[140px] truncate">{match.home}</span>
                    </span>
                    <span
                      className={cn(
                        "num text-right font-extrabold",
                        match.state === "final" && !match.homeWon && "text-[var(--ink-3)]",
                      )}
                    >
                      {match.homeSets ?? "–"}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 whitespace-nowrap",
                        match.state === "final" && !match.awayWon ? "text-[var(--ink-3)]" : "font-bold text-[var(--ink)]",
                      )}
                    >
                      <i className="ball y" />
                      <span className="max-w-[140px] truncate">{match.away}</span>
                    </span>
                    <span
                      className={cn(
                        "num text-right font-extrabold",
                        match.state === "final" && !match.awayWon && "text-[var(--ink-3)]",
                      )}
                    >
                      {match.awaySets ?? "–"}
                    </span>
                  </Link>
                ))}
            </>
          ) : (
            [...liveEvents, ...upcomingEvents, ...completedEvents].slice(0, 4).map((ev) => (
              <Link
                key={`rb-ev-${ev.id}`}
                href={`/schedule/${ev.id}`}
                className="grid min-w-[218px] shrink-0 grid-cols-1 gap-0.5 border-r border-[var(--hair)] px-4 py-2.5 text-[14px] hover:bg-[var(--paper-2)] hover:no-underline"
              >
                <span
                  className={cn(
                    "text-[11.5px] font-bold uppercase tracking-[0.04em]",
                    ev.status === "live" ? "text-[var(--red)]" : "text-[var(--ink-3)]",
                  )}
                >
                  {ev.status === "live" ? "● Live" : fmtRange(ev.start, ev.end)} · {leagueShort(ev.league)}
                </span>
                <span className="truncate font-bold text-[var(--ink)]">{ev.title}</span>
                <span className="truncate text-[12.5px] text-[var(--ink-3)]">
                  {ev.defendingChampion !== "—" ? `Champion: ${ev.defendingChampion}` : ev.venue}
                </span>
              </Link>
            ))
          )}

          <Link
            href="/schedule"
            className="flex shrink-0 items-center pl-4 text-[14px] font-bold whitespace-nowrap text-[var(--ink)] hover:text-[var(--red)]"
          >
            Full schedule →
          </Link>
        </div>
      </div>

      <main className="wrap">
        {/* ============================================================ LEAD SPLIT */}
        <section className="grid grid-cols-1 border-b border-[var(--ink)] lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Lead Main Column */}
          <div className="border-b border-[var(--ink)] pb-8 pt-7 lg:border-b-0 lg:border-r lg:border-[var(--ink)] lg:pr-9">
            {liveLead ? (
              <LiveLeadBlock match={liveLead} />
            ) : dayLead ? (
              <DayMatchLeadBlock match={dayLead} />
            ) : (
              <TournamentLeadBlock
                featured={featured}
                moneyTopTwo={moneyRows.slice(0, 2)}
                seasonTitle={seasonLabel(season)}
              />
            )}
          </div>

          {/* Right Sidebar: Order of Play & This Event */}
          <aside className="pb-8 pt-7 lg:pl-7">
            <div className="mb-1 flex items-baseline justify-between border-b-2 border-[var(--ink)] pb-1.5">
              <h2 className="x text-[28px] text-[var(--ink)]">Order of play</h2>
              <div className="flex items-center gap-2 text-[13px] font-bold">
                {lastDay && (
                  <Link href={buildHomeHref({ day: lastDay })} className="text-[var(--ink-3)] hover:text-[var(--ink)]">
                    ‹ Prev
                  </Link>
                )}
                <Link href="/schedule" className="text-[var(--ink)]">
                  {relativeDay(focusDay)}
                </Link>
                {nextDay && (
                  <Link href={buildHomeHref({ day: nextDay })} className="text-[var(--ink-3)] hover:text-[var(--ink)]">
                    Next ›
                  </Link>
                )}
              </div>
            </div>

            {dayBoard.matches.length > 0 ? (
              <ol className="divide-y divide-[var(--hair)]">
                {dayBoard.matches.slice(0, 5).map((match) => (
                  <li
                    key={match.key}
                    className={cn(
                      "grid grid-cols-[54px_1fr_auto] gap-x-3 gap-y-1 py-3 text-[14.5px]",
                      match.state === "next" && "bg-gradient-to-r from-[var(--paper-2)] to-transparent px-1 -mx-1",
                    )}
                  >
                    <span
                      className={cn(
                        "num text-[16px] font-extrabold",
                        match.state === "live" ? "text-[var(--red)]" : "text-[var(--ink)]",
                      )}
                    >
                      {match.state === "live" ? "LIVE" : match.clock ?? (match.state === "final" ? "FT" : "TBA")}
                      <small className="block text-[11px] font-bold tracking-[0.03em] text-[var(--ink-3)]">
                        {leagueShort(match.event?.league ?? "")}
                      </small>
                    </span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 truncate",
                          match.state === "final" && !match.homeWon && "text-[var(--ink-3)]",
                        )}
                      >
                        <i className="ball w" />
                        <span className={cn("truncate", (match.homeWon || match.state !== "final") && "font-bold")}>
                          {match.home}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1.5 truncate",
                          match.state === "final" && !match.awayWon && "text-[var(--ink-3)]",
                        )}
                      >
                        <i className="ball y" />
                        <span className={cn("truncate", match.awayWon && "font-bold")}>{match.away}</span>
                      </span>
                    </span>
                    <span className="num flex flex-col gap-0.5 text-right font-extrabold">
                      <span className={match.state === "final" && !match.homeWon ? "font-medium text-[var(--ink-3)]" : ""}>
                        {match.homeSets ?? "–"}
                      </span>
                      <span className={match.state === "final" && !match.awayWon ? "font-medium text-[var(--ink-3)]" : ""}>
                        {match.awaySets ?? "–"}
                      </span>
                    </span>
                    <span className="col-start-2 -col-end-1 text-[12px] font-semibold text-[var(--ink-3)]">
                      {match.href ? (
                        <Link href={match.href} className="hover:text-[var(--red)]">
                          {match.round}
                          {match.homeAverage ? ` · avg ${match.homeAverage.toFixed(3)}` : ""}
                        </Link>
                      ) : (
                        match.round
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : dayBoard.partial ? (
              <div className="border-b border-[var(--hair)] py-4">
                <p className="font-serif-ed text-[14.5px] text-[var(--ink-2)]">
                  Schedule data could not be loaded for {relativeDay(focusDay).toLowerCase()}.
                </p>
              </div>
            ) : (
              <div className="border-b border-[var(--hair)] py-4">
                <p className="font-serif-ed text-[14.5px] text-[var(--ink-2)]">
                  No tour or team matches scheduled for {relativeDay(focusDay).toLowerCase()}.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-3 text-[13px] font-bold">
                  {lastDay && (
                    <Link href={buildHomeHref({ day: lastDay })} className="border-b border-[var(--ink)] hover:text-[var(--red)] hover:no-underline">
                      Last match day →
                    </Link>
                  )}
                  {nextDay && (
                    <Link href={buildHomeHref({ day: nextDay })} className="border-b border-[var(--ink)] hover:text-[var(--red)] hover:no-underline">
                      Next tournament day →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {featured && (
              <div className="mt-5 border-t border-[var(--ink)] pt-4">
                <p className="eyebrow mb-1.5">This event</p>
                <h3 className="x text-[24px] text-[var(--ink)]">
                  <Link href={`/schedule/${featured.id}`} className="hover:text-[var(--red)] hover:no-underline">
                    {featured.title}
                  </Link>
                </h3>
                <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13.5px]">
                  <dt className="text-[var(--ink-3)]">Dates</dt>
                  <dd className="num font-semibold text-[var(--ink)]">{fmtRange(featured.start, featured.end)}</dd>
                  <dt className="text-[var(--ink-3)]">Venue</dt>
                  <dd className="truncate font-semibold text-[var(--ink)]">{featured.venue}</dd>
                  <dt className="text-[var(--ink-3)]">Prize pool</dt>
                  <dd className="num font-semibold text-[var(--ink)]">{compactPrize(featured.prizePool)}</dd>
                  {featured.defendingChampion !== "—" && (
                    <>
                      <dt className="text-[var(--ink-3)]">Champion</dt>
                      <dd className="font-semibold text-[var(--ink)]">{featured.defendingChampion}</dd>
                    </>
                  )}
                </dl>
                <div
                  className="mt-3 grid grid-cols-7 gap-[3px]"
                  aria-label={featured.status === "completed" ? "Tournament complete" : "Tournament status"}
                >
                  {Array.from({ length: 7 }, (_, i) => {
                    const filled =
                      featured.status === "completed" ? 7 : featured.status === "live" ? 5 : 1;
                    return (
                      <i
                        key={i}
                        className={cn("h-1.5", i < filled ? "bg-[var(--ink)]" : "bg-[var(--paper-3)]")}
                      />
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[11.5px] text-[var(--ink-3)]">
                  <span>R128</span>
                  <span>Semi-finals</span>
                  <span>Final</span>
                </div>
              </div>
            )}
          </aside>
        </section>

        {/* ============================================================ SEASON LEADERS */}
        <div className="flex flex-col items-start justify-between gap-2 pb-3 pt-7 sm:flex-row sm:items-baseline">
          <h2 className="x text-[36px] sm:text-[44px]">Season leaders</h2>
          <div className="flex flex-wrap items-center gap-4.5 text-[14px] font-bold text-[var(--ink-3)]">
            {([
              ["PBA1", "PBA"],
              ["LPBA1", "LPBA"],
              ["PBA2", "Dream"],
            ] as const).map(([code, label]) => (
              <Link
                key={code}
                href={buildHomeHref({ circuit: code })}
                className={cn(
                  "pb-0.5 hover:text-[var(--ink)] hover:no-underline",
                  circuit === code && "text-[var(--ink)] shadow-[inset_0_-2px_0_var(--ink)]",
                )}
              >
                {label}
              </Link>
            ))}
            <Link href={`/records?circuit=${circuit}`} className="text-[var(--ink)]">
              All records →
            </Link>
          </div>
        </div>

        <section className="grid grid-cols-1 border-b border-[var(--ink)] border-t-2 border-t-[var(--ink)] sm:grid-cols-2 lg:grid-cols-4">
          {leaderPicks.map(({ category, rows }, idx) => {
            const top = rows[0];
            if (!top) return null;
            return (
              <div
                key={category.key}
                className={cn(
                  "border-[var(--hair)] py-5 sm:px-5",
                  idx % 2 === 0 ? "sm:pl-0" : "sm:border-l",
                  idx >= 2 && "border-t sm:border-t lg:border-t-0",
                  idx === 1 && "border-t sm:border-t-0",
                  idx > 0 && "lg:border-l lg:px-5",
                  idx === 0 && "lg:pl-0",
                  idx === leaderPicks.length - 1 && "lg:pr-0",
                )}
              >
                <p className="text-[13px] font-bold text-[var(--ink-2)]">{category.label}</p>
                <p className="x num my-1.5 text-[72px] font-black leading-[0.9] tracking-[-0.02em] text-[var(--ink)] xl:text-[84px]">
                  {formatLeaderBig(category.unit, top.Value)}
                  {category.unit === "pct" && <small className="text-[38px]">%</small>}
                </p>
                <p className="text-[17px] font-bold text-[var(--ink)]">
                  <Link href={`/players/${top.MemCode}`} className="hover:text-[var(--red)]">
                    {resolveLeaderName(top)}
                  </Link>{" "}
                  {top.NationCode && (
                    <span className="text-[13px] font-medium text-[var(--ink-3)]">{top.NationCode}</span>
                  )}
                </p>
                <ol className="mt-3 border-t border-[var(--hair)]">
                  {rows.slice(1, 3).map((row) => (
                    <li
                      key={`${category.key}-${row.MemCode}-${row.Rank}`}
                      className="num flex items-baseline justify-between border-b border-dotted border-[var(--hair)] py-1.5 text-[13.5px]"
                    >
                      <Link
                        href={`/players/${row.MemCode}`}
                        className="min-w-0 truncate hover:text-[var(--red)]"
                      >
                        <span className="inline-block w-4 text-[var(--ink-3)]">{row.Rank}</span>
                        {resolveLeaderName(row)}
                      </Link>
                      <b className="ml-2 shrink-0 font-bold text-[var(--ink)]">
                        {formatLeaderValue(category.unit, row.Value)}
                      </b>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>

        {/* ============================================================ TABLES BAND */}
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* Left: Team League Standings */}
          <section className="pb-4 lg:pr-8">
            <div className="flex items-baseline justify-between pb-2.5 pt-7">
              <h2 className="x text-[32px] sm:text-[34px]">
                Team League <em className="not-italic text-[var(--cloth)]">{roundLabel}</em>
              </h2>
              <Link href="/teams" className="text-[13px] font-bold whitespace-nowrap">
                Full table →
              </Link>
            </div>
            <table className="stat-table num">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Club</th>
                  <th>W–L</th>
                  <th className="hidden sm:table-cell">Set ratio</th>
                  <th className="hidden sm:table-cell">Avg</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, 10).map((team, index) => (
                  <tr
                    key={team.code}
                    className={index === 3 ? "[&>td]:border-b-2 [&>td]:border-b-[var(--cloth)]" : undefined}
                  >
                    <td className="font-bold text-[var(--ink-3)]">{index + 1}</td>
                    <td className="font-semibold whitespace-nowrap">
                      <Link
                        href={`/teams/${encodeURIComponent(team.code)}`}
                        className="inline-flex items-center hover:text-[var(--red)]"
                      >
                        <span className="mr-2.5 inline-grid h-[22px] w-[22px] shrink-0 place-items-center bg-[var(--ink)] text-[10px] font-extrabold text-[var(--paper)]">
                          {clubMonogram(team.name)}
                        </span>
                        <span className="max-w-[200px] truncate sm:max-w-none">{team.name}</span>
                      </Link>
                    </td>
                    <td>
                      {team.wins}–{team.losses}
                    </td>
                    <td className="hidden sm:table-cell">
                      {team.setRatio ? team.setRatio.toFixed(2) : "—"}
                    </td>
                    <td className="hidden sm:table-cell">
                      {team.average ? team.average.toFixed(3) : "—"}
                    </td>
                    <td className="text-[16px] font-black">{team.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
              <i className="inline-block w-[18px] border-t-2 border-[var(--cloth)]" />
              <span>Playoff qualification line · Points: win 3 (2 in 7 sets), loss in 7 sets 1</span>
            </p>
          </section>

          {/* Right: Money List */}
          <section className="pb-4 lg:border-l lg:border-[var(--ink)] lg:pl-8">
            <div className="flex items-baseline justify-between pb-2.5 pt-7">
              <h2 className="x text-[32px] sm:text-[34px]">Money list</h2>
              <div className="flex items-center gap-4 text-[14px] font-bold text-[var(--ink-3)]">
                <Link
                  href={buildHomeHref({ money: "PBA1" })}
                  className={cn(
                    "pb-0.5 hover:text-[var(--ink)] hover:no-underline",
                    moneyLeague === "PBA1" && "text-[var(--ink)] shadow-[inset_0_-2px_0_var(--ink)]",
                  )}
                >
                  PBA
                </Link>
                <Link
                  href={buildHomeHref({ money: "LPBA1" })}
                  className={cn(
                    "pb-0.5 hover:text-[var(--ink)] hover:no-underline",
                    moneyLeague === "LPBA1" && "text-[var(--ink)] shadow-[inset_0_-2px_0_var(--ink)]",
                  )}
                >
                  LPBA
                </Link>
                <Link href={`/rankings?league=${moneyLeague}`} className="text-[var(--ink)]">
                  Full list →
                </Link>
              </div>
            </div>
            <table className="stat-table num">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th className="hidden sm:table-cell">Pts</th>
                  <th>Prize</th>
                </tr>
              </thead>
              <tbody>
                {moneyRows.map((row, idx) => {
                  const pct = Math.max(8, Math.round(((row.Prize || 0) / maxPrize) * 100));
                  const name = cleanPlayerName(pick(row.PlayerNameEN, row.PlayerNameKO));
                  return (
                    <tr key={`${row.MemCode}-${idx}`}>
                      <td className="font-bold text-[var(--ink-3)]">{row.Rank || idx + 1}</td>
                      <td className="font-semibold">
                        <Link href={`/players/${row.MemCode}`} className="hover:text-[var(--red)]">
                          {name}
                        </Link>
                        {row.NationCode && (
                          <span className="ml-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                            {row.NationCode}
                          </span>
                        )}
                      </td>
                      <td className="hidden text-[var(--ink-3)] sm:table-cell">{grouped(row.RankingPoint)}</td>
                      <td className="font-extrabold">
                        <span>{compactPrize(String(row.Prize))}</span>
                        <span
                          className="ml-auto mt-1 block h-[3px] bg-[var(--red)]"
                          style={{ width: `${pct}%` }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-[var(--ink-3)]">
              Season {seasonLabel(season)} cumulative earnings · {leagueByCode(moneyLeague).name}
            </p>
          </section>
        </div>

        {/* ============================================================ FROM THE TOUR (NEWS) */}
        {articles.length > 0 && (
          <>
            <div className="flex items-baseline justify-between gap-4 pb-3 pt-8">
              <h2 className="x text-[36px] sm:text-[44px]">From the tour</h2>
              <div className="flex items-center gap-4.5 text-[14px] font-bold text-[var(--ink-3)]">
                <Link href="/news" className="text-[var(--ink)] shadow-[inset_0_-2px_0_var(--ink)]">
                  Stories
                </Link>
                <Link href="/news?tab=videos" className="hover:text-[var(--ink)]">
                  Video
                </Link>
                <Link href="/news?tab=gallery" className="hover:text-[var(--ink)]">
                  Galleries
                </Link>
              </div>
            </div>

            <section className="grid grid-cols-1 border-t-2 border-[var(--ink)] md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              {/* Lead story */}
              {articles[0] && (
                <article className="py-5 lg:pr-6">
                  <Link href={`/news/${articles[0].seq}`} className="block hover:no-underline">
                    <div
                      className="relative mb-3.5 aspect-[3/2] overflow-hidden border border-[var(--hair)]"
                      style={{
                        background:
                          "radial-gradient(circle at 30% 60%, var(--white-ball) 0 5%, transparent 5.5%), radial-gradient(circle at 58% 42%, var(--yellow) 0 5%, transparent 5.5%), radial-gradient(circle at 72% 70%, var(--red) 0 5%, transparent 5.5%), linear-gradient(160deg,#235da6,#163f74)",
                      }}
                    >
                      {articles[0].image && (
                        <SafeImage
                          src={articles[0].image}
                          alt={articles[0].title}
                          className="h-full w-full object-cover"
                          fallback={<span />}
                        />
                      )}
                    </div>
                  </Link>
                  <p className="eyebrow">Featured Release</p>
                  <h3 className="font-serif-ed mt-1 text-[26px] font-semibold leading-[1.15] tracking-[-0.005em] sm:text-[31px]">
                    <Link href={`/news/${articles[0].seq}`} className="hover:text-[var(--red)]">
                      {articles[0].title}
                    </Link>
                  </h3>
                  <p className="font-serif-ed mt-2 text-[15.5px] leading-[1.5] text-[var(--ink-2)]">
                    {excerpt(articles[0].body, 150)}
                  </p>
                  <p className="mt-2.5 text-[12.5px] text-[var(--ink-3)]">{fmtDate(articles[0].date)}</p>
                </article>
              )}

              {/* Second story */}
              {articles[1] && (
                <article className="border-t border-[var(--hair)] py-5 md:border-l md:border-t-0 md:pl-6 lg:px-6">
                  <Link href={`/news/${articles[1].seq}`} className="block hover:no-underline">
                    <div
                      className="relative mb-3.5 aspect-[3/2] overflow-hidden border border-[var(--hair)]"
                      style={{ background: "linear-gradient(160deg,#8a1d16,#4d0f0b)" }}
                    >
                      {articles[1].image && (
                        <SafeImage
                          src={articles[1].image}
                          alt={articles[1].title}
                          className="h-full w-full object-cover"
                          fallback={<span />}
                        />
                      )}
                    </div>
                  </Link>
                  <p className="eyebrow">Press Release</p>
                  <h3 className="font-serif-ed mt-1 text-[21px] font-semibold leading-[1.22]">
                    <Link href={`/news/${articles[1].seq}`} className="hover:text-[var(--red)]">
                      {articles[1].title}
                    </Link>
                  </h3>
                  <p className="mt-2.5 text-[12.5px] text-[var(--ink-3)]">{fmtDate(articles[1].date)}</p>
                </article>
              )}

              {/* News brief stack */}
              {articles.length > 2 && (
                <article className="border-t border-[var(--hair)] py-5 md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-6">
                  <ul className="divide-y divide-[var(--hair)]">
                    {articles.slice(2, 6).map((article) => (
                      <li key={article.seq} className="py-3 first:pt-0">
                        <span className="text-[12px] text-[var(--ink-3)]">{fmtDate(article.date)}</span>
                        <h4 className="font-serif-ed mt-0.5 text-[17px] font-semibold leading-[1.28]">
                          <Link href={`/news/${article.seq}`} className="hover:text-[var(--red)]">
                            {article.title}
                          </Link>
                        </h4>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          </>
        )}

        {/* ============================================================ COMING UP (CALENDAR) */}
        <div className="flex items-baseline justify-between gap-4 pb-3 pt-8">
          <h2 className="x text-[36px] sm:text-[44px]">Coming up</h2>
          <Link href="/schedule" className="text-[14px] font-bold">
            Full calendar →
          </Link>
        </div>

        <section className="grid grid-cols-2 border-b border-[var(--ink)] border-t-2 border-t-[var(--ink)] sm:grid-cols-3 lg:grid-cols-6">
          {calendarStrip.map((event, idx) => {
            const parts = dateParts(event.start);
            return (
              <Link
                key={event.id}
                href={`/schedule/${event.id}`}
                className={cn(
                  "block border-[var(--hair)] px-3.5 py-4 hover:bg-[var(--paper-2)] hover:no-underline",
                  idx % 2 === 1 ? "border-l" : "",
                  idx >= 2 && "border-t sm:border-t-0",
                  idx % 3 !== 0 ? "sm:border-l" : "sm:border-l-0",
                  idx >= 3 && "sm:border-t lg:border-t-0",
                  idx > 0 ? "lg:border-l" : "lg:pl-0",
                )}
              >
                <p className="x num text-[48px] font-black leading-[0.9] text-[var(--ink)]">{parts.day}</p>
                <p className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                  {parts.month} · {parts.weekday}
                </p>
                <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--ink)]">
                  <i className={cn("inline-block h-2.5 w-2.5", circuitSwatch(event.league))} />
                  {leagueShort(event.league)}
                </p>
                <h4 className="my-1 line-clamp-2 text-[16px] font-bold leading-[1.2] text-[var(--ink)]">
                  {event.title}
                </h4>
                <small className="block truncate text-[12.5px] text-[var(--ink-3)]">{event.venue}</small>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ lead views */

function LiveLeadBlock({ match }: { match: LiveMatch }) {
  const s0 = match.sides[0];
  const s1 = match.sides[1];
  const leader =
    (s0?.setsWon ?? 0) > (s1?.setsWon ?? 0)
      ? s0
      : (s1?.setsWon ?? 0) > (s0?.setsWon ?? 0)
        ? s1
        : null;
  const trailer = leader === s0 ? s1 : s0;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--ink-2)]">
        <span className="tag-live">
          <i />
          Live
        </span>
        <span>
          {match.competition ? `${match.competition}` : "PBA Tour"} ·{" "}
          {match.latestSet.setNo > 0 ? `Set ${match.latestSet.setNo}` : "Match in progress"}
        </span>
      </div>
      <h1 className="x mb-2 text-[44px] sm:text-[62px] xl:text-[76px]">
        {leader
          ? `${familyOf(leader.name)} leads ${familyOf(trailer?.name ?? "")} ${leader.setsWon}–${trailer?.setsWon ?? 0}`
          : `${familyOf(s0?.name ?? "Match")} vs ${familyOf(s1?.name ?? "In Play")}`}
      </h1>
      <p className="font-serif-ed mb-6 max-w-[60ch] text-[18px] leading-[1.4] text-[var(--ink-2)] sm:text-[19px]">
        Live frame from {match.venue || "the main arena"}.{" "}
        {match.latestSet.target ? `Playing set ${match.latestSet.setNo} to ${match.latestSet.target} points.` : ""}
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] border-t-2 border-[var(--ink)]" role="table" aria-label="Live scoreboard">
        <div className="contents">
          <span className="py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Player</span>
          <span className="flex items-center py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">
            <span className="w-[44px] text-center">Pts</span>
            <span className="w-[44px] text-center">Inn</span>
            <span className="w-[68px] pl-2 text-center">Sets</span>
          </span>
        </div>
        {match.sides.slice(0, 2).map((side, idx) => (
          <div key={idx} className="contents">
            <div className="flex items-center gap-3.5 border-b border-[var(--hair)] py-4">
              <i className={idx === 0 ? "ball w lg" : "ball y lg"} />
              <div className="min-w-0">
                <div className="truncate text-[22px] font-bold tracking-[-0.01em] sm:text-[28px]">
                  {side.name}
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--ink-3)]">
                  {side.average ? `Avg ${side.average.toFixed(3)}` : "Live frame"}
                  {side.highRun ? ` · HR ${side.highRun}` : ""}
                </div>
              </div>
            </div>
            <div className="num flex items-center border-b border-[var(--hair)]">
              <span className="w-[44px] text-center text-[18px] font-extrabold text-[var(--red)] shadow-[inset_0_-3px_0_var(--red)]">
                {side.points ?? 0}
              </span>
              <span className="w-[44px] text-center text-[16px] font-semibold text-[var(--ink-3)]">
                {side.innings ?? "—"}
              </span>
              <span className="x num w-[68px] border-l border-[var(--hair)] pl-2 text-center text-[44px] font-black sm:text-[54px]">
                {match.fixtureScore ? match.fixtureScore[idx] : side.setsWon}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-5 text-[14.5px] font-bold">
        {match.pstCode && (
          <Link href={`/matches/${match.pstCode}?live=1`} className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline">
            Open match centre
          </Link>
        )}
        <Link href="/live" className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline">
          All live tables
        </Link>
        <Link href="/schedule" className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline">
          Full schedule
        </Link>
      </div>
    </>
  );
}

function DayMatchLeadBlock({ match }: { match: Awaited<ReturnType<typeof getDayBoard>>["matches"][number] }) {
  const headline =
    match.state === "final"
      ? `${familyOf(match.homeWon ? match.home : match.away)} takes ${match.round} ${Math.max(match.homeSets ?? 0, match.awaySets ?? 0)}–${Math.min(match.homeSets ?? 0, match.awaySets ?? 0)}`
      : `${familyOf(match.home)} vs ${familyOf(match.away)}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--ink-2)]">
        <span className="bg-[var(--ink)] px-2 py-0.5 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--paper)]">
          {match.state === "final" ? "Final" : "Scheduled"}
        </span>
        <span>
          {match.event?.title ?? "PBA Tour"} · {match.round}
        </span>
      </div>
      <h1 className="x mb-2 text-[44px] sm:text-[62px] xl:text-[74px]">{headline}</h1>
      <p className="font-serif-ed mb-6 max-w-[60ch] text-[18px] leading-[1.4] text-[var(--ink-2)]">
        {match.event?.venue ? `${match.event.venue} · ` : ""}
        {match.clock ? `Session ${match.clock} KST. ` : ""}
        Official scorecard and inning breakdown.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] border-t-2 border-[var(--ink)]" role="table" aria-label="Featured match">
        <div className="contents">
          <span className="py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Player</span>
          <span className="flex items-center py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">
            <span className="hidden w-[56px] text-center sm:inline-block">Avg</span>
            <span className="hidden w-[44px] text-center sm:inline-block">HR</span>
            <span className="w-[68px] pl-2 text-center">Sets</span>
          </span>
        </div>
        {[
          {
            name: match.home,
            won: match.homeWon,
            avg: match.homeAverage,
            hr: match.homeHighRun,
            sets: match.homeSets,
            ball: "ball w lg",
          },
          {
            name: match.away,
            won: match.awayWon,
            avg: match.awayAverage,
            hr: match.awayHighRun,
            sets: match.awaySets,
            ball: "ball y lg",
          },
        ].map((side, idx) => (
          <div key={idx} className="contents">
            <div className="flex items-center gap-3.5 border-b border-[var(--hair)] py-4">
              <i className={side.ball} />
              <span className="truncate text-[22px] font-bold sm:text-[28px]">{side.name}</span>
            </div>
            <div className="num flex items-center border-b border-[var(--hair)]">
              <span className="hidden w-[56px] text-center text-[15px] font-semibold text-[var(--ink-2)] sm:inline-block">
                {side.avg !== null ? side.avg.toFixed(3) : "—"}
              </span>
              <span className="hidden w-[44px] text-center text-[15px] font-semibold text-[var(--ink-3)] sm:inline-block">
                {side.hr ?? "—"}
              </span>
              <span
                className={cn(
                  "x num w-[68px] border-l border-[var(--hair)] pl-2 text-center text-[44px] font-black sm:text-[54px]",
                  match.state === "final" && !side.won && "text-[var(--ink-3)]",
                )}
              >
                {side.sets ?? "–"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-5 text-[14.5px] font-bold">
        {match.href && (
          <Link href={match.href} className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline">
            Open scorecard
          </Link>
        )}
        <Link href="/schedule" className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline">
          Full schedule
        </Link>
      </div>
    </>
  );
}

function TournamentLeadBlock({
  featured,
  moneyTopTwo,
  seasonTitle,
}: {
  featured: CalendarEvent | null;
  moneyTopTwo: Awaited<ReturnType<typeof getRankingBoard>>;
  seasonTitle: string;
}) {
  const p1 = moneyTopTwo[0];
  const p2 = moneyTopTwo[1];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--ink-2)]">
        <span className="bg-[var(--ink)] px-2 py-0.5 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--paper)]">
          {featured ? (featured.status === "live" ? "In play" : featured.status === "upcoming" ? "Next up" : "Latest Tour") : seasonTitle}
        </span>
        <span>{featured ? `${leagueByCode(featured.league).name} · ${fmtRange(featured.start, featured.end)}` : "PBA & LPBA 3-Cushion Tour"}</span>
      </div>

      <h1 className="x mb-2 text-[44px] sm:text-[64px] xl:text-[78px]">
        {featured ? featured.title : `${seasonTitle} PBA Season`}
      </h1>
      <p className="font-serif-ed mb-6 max-w-[60ch] text-[18px] leading-[1.4] text-[var(--ink-2)] sm:text-[19px]">
        {featured
          ? `${featured.venue}${featured.defendingChampion !== "—" ? ` — Defending champion ${featured.defendingChampion}.` : "."} Track tour draws, live tables, player averages, and club standings.`
          : "Official scores, inning sheets, tour brackets, and Team League standings across the 3-cushion professional circuit."}
      </p>

      {p1 && p2 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] border-t-2 border-[var(--ink)]" role="table" aria-label="Season prize leaders">
          <div className="contents">
            <span className="py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              Season Race · Top Two
            </span>
            <span className="flex items-center py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              <span className="hidden w-[84px] text-right sm:inline-block">Points</span>
              <span className="min-w-[80px] pl-3 text-right sm:min-w-[96px]">Prize</span>
            </span>
          </div>
          {[p1, p2].map((row, idx) => (
            <div key={row.MemCode} className="contents">
              <div className="flex items-center gap-3.5 border-b border-[var(--hair)] py-3.5">
                <i className={idx === 0 ? "ball w lg" : "ball y lg"} />
                <div className="min-w-0">
                  <Link
                    href={`/players/${row.MemCode}`}
                    className="block truncate text-[20px] font-bold tracking-[-0.01em] hover:text-[var(--red)] sm:text-[26px]"
                  >
                    {cleanPlayerName(pick(row.PlayerNameEN, row.PlayerNameKO))}
                  </Link>
                  <div className="text-[12.5px] text-[var(--ink-3)]">
                    Rank #{row.Rank || idx + 1} · {row.NationCode}
                  </div>
                </div>
              </div>
              <div className="num flex items-center border-b border-[var(--hair)]">
                <span className="hidden w-[84px] text-right text-[15px] font-semibold text-[var(--ink-2)] sm:inline-block">
                  {grouped(row.RankingPoint)}
                </span>
                <span className="x num min-w-[80px] whitespace-nowrap border-l border-[var(--hair)] pl-3 text-right text-[20px] font-black text-[var(--ink)] sm:min-w-[96px] sm:text-[28px]">
                  {compactPrize(String(row.Prize))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {featured && (
        <dl className="mt-4 grid grid-cols-2 gap-y-3 border-t border-[var(--hair)] pt-4 sm:grid-cols-4">
          <div className="sm:pr-4">
            <dt className="text-[12px] text-[var(--ink-3)]">Dates</dt>
            <dd className="num text-[17px] font-extrabold">{fmtRange(featured.start, featured.end)}</dd>
          </div>
          <div className="border-l border-[var(--hair)] pl-4 sm:pr-4">
            <dt className="text-[12px] text-[var(--ink-3)]">Prize pool</dt>
            <dd className="num text-[17px] font-extrabold">{compactPrize(featured.prizePool)}</dd>
          </div>
          <div className="sm:border-l sm:border-[var(--hair)] sm:px-4">
            <dt className="text-[12px] text-[var(--ink-3)]">Champion</dt>
            <dd className="truncate text-[17px] font-extrabold">
              {featured.defendingChampion !== "—" ? featured.defendingChampion : "TBD"}
            </dd>
          </div>
          <div className="border-l border-[var(--hair)] pl-4">
            <dt className="text-[12px] text-[var(--ink-3)]">Circuit</dt>
            <dd className="text-[17px] font-extrabold">{leagueShort(featured.league)}</dd>
          </div>
        </dl>
      )}

      <div className="mt-6 flex flex-wrap gap-5 text-[14.5px] font-bold">
        {featured && (
          <Link
            href={`/schedule/${featured.id}`}
            className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline"
          >
            Open tournament draw
          </Link>
        )}
        <Link
          href="/live"
          className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline"
        >
          Live match centre
        </Link>
        <Link
          href="/compare"
          className="border-b-2 border-[var(--ink)] pb-0.5 hover:border-[var(--red)] hover:text-[var(--red)] hover:no-underline"
        >
          Compare players
        </Link>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ utils */

function familyOf(name: string): string {
  const cleaned = cleanPlayerName(name);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || cleaned || "Match";
}

function clubMonogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return (words[0] ?? "TL").slice(0, 2).toUpperCase();
}

function circuitSwatch(league: string): string {
  if (league === "LPBA1") return "bg-[var(--red)]";
  if (league === "PBA2" || league === "PBA3") return "bg-[var(--yellow)]";
  if (league === "TLG") return "bg-[var(--cloth)]";
  return "bg-[var(--ink)]";
}

function compactPrize(value: string): string {
  const text = value.trim();
  if (!text || text === "—") return "—";
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  if (/^\d+$/.test(text.replace(/\s/g, "")) && Number.isFinite(numeric) && numeric > 1000) {
    if (numeric >= 1_000_000_000) return `₩${(numeric / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
    if (numeric >= 1_000_000) return `₩${(numeric / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  const winner = text.match(/(?:winner|우승)[^\d]*([\d.,]+\s*(?:million|billion|억원?|만원?))/i);
  if (winner) return winner[1].replace(/million/i, "M").replace(/billion/i, "B");
  return text.length > 22 ? `${text.slice(0, 20)}…` : text;
}

function formatLeaderBig(unit: "avg" | "int" | "pct", value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return n.toFixed(1);
  return grouped(n);
}

function formatLeaderValue(unit: "avg" | "int" | "pct", value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return percent(n);
  return grouped(n);
}
