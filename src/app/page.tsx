import type { Metadata } from "next";
import Link from "next/link";
import {
  getActiveTeamSeason,
  getCurrentSeason,
  getLeaders,
  getPlayerNameIndex,
  getRankingBoard,
  resolveKoreanName,
} from "@/lib/pba/service";
import { getPressList, getTeamStandings } from "@/lib/pba/api";
import { getDayBoard, type DayMatch } from "@/lib/pba/matches-on-day";
import { getLiveFeed, type LiveMatch } from "@/lib/pba/live";
import {
  getRoundFixtures,
  FIXTURES_ARCHIVE_TTL,
  FIXTURES_IN_PLAY_TTL,
  type TeamFixture,
} from "@/lib/pba/team-matches";
import { calendarEvents, type CalendarEvent } from "@/lib/pba/calendar";
import {
  LEADER_CATEGORIES,
  leagueShort,
  normalizeArticle,
  normalizeTeam,
} from "@/lib/normalize";
import {
  cleanPlayerName,
  fmtDate,
  fmtRange,
  grouped,
  hasHangul,
  isoDay,
  kstDay,
  parseIsoDay,
  shiftIsoDay,
  wonCompact,
} from "@/lib/format";
import { eventArtUrl } from "@/lib/event-art";
import { photoUrl } from "@/lib/photo";
import { SafeImage } from "@/components/ui/safe-image";
import { clubBadge, flagClass } from "@/components/ui/media";
import { Card } from "@/components/ui/card";
import { matchTeamByNameOrLogo } from "@/lib/team-links";
import { splitNewsHeadline } from "@/lib/news";
import { translateArticleSummaries } from "@/lib/translate";
import { HomeArenaHub } from "@/components/domain/home-arena-hub";
import { HomeRankingsCard } from "@/components/domain/home-rankings-card";
import { BarChart3, Calendar, ChevronRight, Scale, Trophy, Users } from "lucide-react";
import type {
  HomeCircuit,
  HomeDaySlice,
  HomeFixtureRow,
  HomeLeadStory,
  HomeLiveCard,
  HomeRankItem,
} from "@/components/domain/home-types";
import type { RawTop5Row } from "@/lib/pba/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "PBA Hub — Matches, Live Arena & Standings" },
  description:
    "Live 3-cushion carom scores, PBA and LPBA tournament schedules, match cards, prize rankings and Team League standings.",
};

function shortDayLabel(iso: string | null | undefined): string {
  const d = parseIsoDay(iso);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function shortTourTitle(title: string): string {
  return title
    .replace(/\b20\d{2}[-–](?:20)?\d{2}\b/g, "")
    .replace(/\b\d{2}[-–]\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortClubName(name: string): string {
  return name
    .replace(/\s+Direct\s+Car\s+Insurance$/i, "")
    .replace(/\s+Direct$/i, "")
    .replace(/\s+Savings\s+Bank$/i, "")
    .replace(/\s+Card$/i, "")
    .replace(/\s+Resort$/i, "")
    .replace(/\s+Bazaars?$/i, "")
    .replace(/\s+Winners$/i, "")
    .replace(/\s+Angels$/i, "")
    .replace(/\s+Alphas$/i, "")
    .replace(/\s+Pigeons$/i, "")
    .replace(/\s+Laon$/i, "")
    .replace(/\s+Legends$/i, "")
    .replace(/\s+Phoenix$/i, "")
    .replace(/\s+Wonder\s+Woman$/i, "")
    .trim();
}

function mapCircuit(league: string | null | undefined): HomeCircuit {
  const u = (league ?? "").toUpperCase();
  if (u.startsWith("LPBA")) return "LPBA";
  if (u === "TLG" || u.includes("TEAM")) return "TEAM";
  if (u === "PBA2" || u === "PBA3" || u.includes("DREAM")) return "DREAM";
  return "PBA";
}

function leagueAccent(league: string): string {
  const c = mapCircuit(league);
  if (c === "LPBA") return "var(--lpba)";
  if (c === "TEAM") return "var(--ink-2)";
  if (c === "DREAM") return "var(--gold)";
  return "var(--pba)";
}

export default async function HomePage() {
  const today = kstDay();
  const yesterday = shiftIsoDay(today, -1);
  const tomorrow = shiftIsoDay(today, 1);

  const events = calendarEvents();
  const liveEvents = events.filter((e) => e.status === "live");
  const upcomingEvents = events.filter(
    (e) => e.status === "upcoming" && (isoDay(e.start) ?? "") >= today,
  );
  const completedEvents = events.filter((e) => e.status === "completed").reverse();

  const seasonPromise = getCurrentSeason();
  const teamSeasonPromise = getActiveTeamSeason();

  const seasonBundlePromise = seasonPromise.then((s) =>
    Promise.all([
      getRankingBoard({ kind: "point", leagueCode: "PBA1", season: s.SeasonCode }),
      getRankingBoard({ kind: "point", leagueCode: "LPBA1", season: s.SeasonCode }),
      getRankingBoard({ kind: "prize", leagueCode: "PBA1", season: s.SeasonCode }),
      getLeaders(s.SeasonCode, "PBA1"),
    ]),
  );

  const teamBundlePromise = teamSeasonPromise.then((ts) => {
    if (!ts) return [[], []] as [ReturnType<typeof normalizeTeam>[], TeamFixture[]];
    const lr = ts.liveRound;
    return Promise.all([
      getTeamStandings({
        seasonCode: ts.season.시즌코드,
        leagueCode: String(ts.season.리그코드),
        roundCode: lr ? String(lr.라운드코드) : "0",
      }).then((rows) => rows.map(normalizeTeam)),
      lr
        ? getRoundFixtures(
            String(lr.라운드코드),
            lr.라운드,
            lr.진행상황 === "진행중" ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL,
          )
        : Promise.resolve([] as TeamFixture[]),
    ]);
  });

  const articlesPromise = getPressList(1, 8).then(async ({ list }) =>
    translateArticleSummaries(list.map(normalizeArticle), 155),
  );

  const [
    feed,
    yesterdayBoard,
    todayBoard,
    tomorrowBoard,
    [pbaPointsRank, lpbaPointsRank, prizeRank, leaders],
    articles,
    teamSeason,
    [standings, roundFixtures],
  ] = await Promise.all([
    getLiveFeed(),
    getDayBoard(yesterday),
    getDayBoard(today),
    getDayBoard(tomorrow),
    seasonBundlePromise,
    articlesPromise,
    teamSeasonPromise,
    teamBundlePromise,
  ]);

  const nationByKey = new Map<string, string>();
  const codeByName = new Map<string, string>();
  const photoByKey = new Map<string, string>();
  for (const row of [...pbaPointsRank, ...lpbaPointsRank]) {
    const cleanEn = cleanPlayerName(row.PlayerNameEN);
    const cleanShort = cleanPlayerName(row.PlayerNameENShort);
    const portrait = row.ImgURL ? photoUrl(row.ImgURL, 128) : null;
    if (row.NationCode) {
      if (row.MemCode) nationByKey.set(row.MemCode, row.NationCode);
      if (cleanEn) nationByKey.set(cleanEn.toLowerCase(), row.NationCode);
      if (cleanShort) nationByKey.set(cleanShort.toLowerCase(), row.NationCode);
    }
    if (portrait) {
      if (row.MemCode) photoByKey.set(row.MemCode, portrait);
      if (cleanEn) photoByKey.set(cleanEn.toLowerCase(), portrait);
      if (cleanShort) photoByKey.set(cleanShort.toLowerCase(), portrait);
    }
    if (row.MemCode) {
      if (cleanEn) codeByName.set(cleanEn.toLowerCase(), row.MemCode);
      if (cleanShort) codeByName.set(cleanShort.toLowerCase(), row.MemCode);
    }
  }

  const nationFor = (code: string | null | undefined, name: string | null | undefined) => {
    if (code && nationByKey.has(code)) return nationByKey.get(code) ?? null;
    if (name) return nationByKey.get(name.trim().toLowerCase()) ?? null;
    return null;
  };
  const photoFor = (code: string | null | undefined, name: string | null | undefined) => {
    if (code && photoByKey.has(code)) return photoByKey.get(code) ?? null;
    if (name) return photoByKey.get(name.trim().toLowerCase()) ?? null;
    return null;
  };
  const codeFor = (name: string | null | undefined) =>
    name ? codeByName.get(name.trim().toLowerCase()) ?? null : null;

  const dayMatchToRow = (m: DayMatch): HomeFixtureRow => {
    const c = mapCircuit(m.event?.league);
    return {
      key: m.key,
      state: m.state,
      circuit: c,
      circuitLabel: leagueShort(m.event?.league ?? "") || c,
      eventTitle: m.event?.title ?? "Tour Match",
      round: m.round || "Tour",
      clock: m.clock ?? (m.state === "final" ? "FT" : "TBA"),
      matchNo: m.matchNo,
      href: m.href ?? "/schedule",
      pstCode: m.pstCode,
      home: m.home,
      away: m.away,
      homeMemCode: m.homeMemCode ?? codeFor(m.home),
      awayMemCode: m.awayMemCode ?? codeFor(m.away),
      homeNation: nationFor(m.homeMemCode, m.home),
      awayNation: nationFor(m.awayMemCode, m.away),
      homeScore: m.homeSets,
      awayScore: m.awaySets,
      homeWon: m.homeWon,
      awayWon: m.awayWon,
      homeAvg: m.homeAverage,
      homeHr: m.homeHighRun,
    };
  };

  const liveRound = teamSeason?.liveRound ?? null;
  const fixtureToRow = (fix: TeamFixture, idx: number): HomeFixtureRow => {
    const href =
      fix.gameNo && liveRound && teamSeason
        ? `/teams/matches/${fix.gameNo}?season=${teamSeason.season.시즌코드}&round=${liveRound.라운드코드}`
        : "/teams/matches";
    const clock = fix.playedAt?.slice(11, 16) || "FT";
    return {
      key: `team-${fix.gameNo ?? idx}-${fix.home.name}-${fix.away.name}`,
      state: fix.played ? "final" : "next",
      circuit: "TEAM",
      circuitLabel: "TEAM",
      eventTitle: liveRound ? `Team League · Round ${liveRound.라운드}` : "Team League",
      round: liveRound ? `Round ${liveRound.라운드}` : "Team",
      clock: fix.played ? "FT" : clock,
      matchNo: fix.gameNo ?? String(idx + 1),
      href,
      pstCode: "",
      home: shortClubName(fix.home.name),
      away: shortClubName(fix.away.name),
      homeMemCode: null,
      awayMemCode: null,
      homeNation: "KR",
      awayNation: "KR",
      homeScore: fix.home.sets,
      awayScore: fix.away.sets,
      homeWon: fix.home.won,
      awayWon: fix.away.won,
      homeAvg: fix.home.average,
      homeHr: fix.home.highRun,
    };
  };

  const todayLiveByPst = new Map(
    todayBoard.matches.filter((m) => m.pstCode).map((m) => [m.pstCode, m]),
  );

  const initialLive: HomeLiveCard[] = feed.matches.map((m: LiveMatch, idx: number) => {
    const enriched = m.pstCode ? todayLiveByPst.get(m.pstCode) : undefined;
    const isTeam = Boolean(m.competition);
    return {
      key: m.key,
      pstCode: m.pstCode,
      watchUrl: m.watchUrl,
      circuit: isTeam
        ? "TEAM"
        : enriched?.event?.league
          ? mapCircuit(enriched.event.league)
          : m.latestSet.target === 11
            ? "LPBA"
            : "PBA",
      tableLabel: isTeam ? m.venue || "Team Arena" : `Table ${idx + 1}`,
      roundLabel: isTeam
        ? "Team League"
        : enriched?.round || (m.latestSet.setNo > 0 ? `Set ${m.latestSet.setNo}` : "In Play"),
      latestSetNo: m.latestSet.setNo,
      raceTarget: m.latestSet.target,
      completedSets: m.completedSets,
      isTeam,
      sides: m.sides.map((s, si) => {
        const eCode =
          si === 0 ? enriched?.homeMemCode : si === 1 ? enriched?.awayMemCode : null;
        const resolvedCode = eCode ?? codeFor(s.name);
        return {
          name: s.name,
          memCode: resolvedCode,
          nation: isTeam ? "KR" : nationFor(resolvedCode, s.name),
          photo: isTeam ? null : photoFor(resolvedCode, s.name),
          setsWon: m.fixtureScore ? m.fixtureScore[si] ?? s.setsWon : s.setsWon,
          points: s.points,
          innings: s.innings,
          average: s.average ?? (si === 0 ? enriched?.homeAverage : enriched?.awayAverage) ?? null,
          highRun: s.highRun ?? (si === 0 ? enriched?.homeHighRun : enriched?.awayHighRun) ?? null,
        };
      }),
    };
  });

  const days: HomeDaySlice[] = [
    {
      key: "yesterday",
      label: `Yesterday · ${shortDayLabel(yesterday)}`,
      shortLabel: "Yesterday",
      iso: yesterday,
      partial: yesterdayBoard.partial,
      rows: yesterdayBoard.matches.map(dayMatchToRow),
    },
    {
      key: "today",
      label: `Today · ${shortDayLabel(today)}`,
      shortLabel: "Today",
      iso: today,
      partial: todayBoard.partial,
      rows: todayBoard.matches.map(dayMatchToRow),
    },
    {
      key: "tomorrow",
      label: `Tomorrow · ${shortDayLabel(tomorrow)}`,
      shortLabel: "Tomorrow",
      iso: tomorrow,
      partial: tomorrowBoard.partial,
      rows: tomorrowBoard.matches.map(dayMatchToRow),
    },
  ];

  const teamFallback = [...roundFixtures].reverse().slice(0, 10).map(fixtureToRow);

  const ribbonEvents: CalendarEvent[] = [];
  const seenEv = new Set<string>();
  for (const ev of [...liveEvents, ...upcomingEvents, ...completedEvents]) {
    if (seenEv.has(ev.id)) continue;
    seenEv.add(ev.id);
    ribbonEvents.push(ev);
    if (ribbonEvents.length >= 3) break;
  }

  const pbaRankItems: HomeRankItem[] = pbaPointsRank.slice(0, 8).map((r) => ({
    rank: r.Rank,
    code: r.MemCode,
    name: cleanPlayerName(r.PlayerNameEN || r.PlayerNameKO),
    nation: r.NationCode || null,
    photo: r.ImgURL ? photoUrl(r.ImgURL, 128) : null,
    circuit: "PBA",
    value: grouped(r.RankingPoint),
  }));
  const lpbaRankItems: HomeRankItem[] = lpbaPointsRank.slice(0, 8).map((r) => ({
    rank: r.Rank,
    code: r.MemCode,
    name: cleanPlayerName(r.PlayerNameEN || r.PlayerNameKO),
    nation: r.NationCode || null,
    photo: r.ImgURL ? photoUrl(r.ImgURL, 128) : null,
    circuit: "LPBA",
    value: grouped(r.RankingPoint),
  }));
  const prizeRankItems: HomeRankItem[] = (prizeRank ?? []).slice(0, 8).map((r) => ({
    rank: r.Rank,
    code: r.MemCode,
    name: cleanPlayerName(r.PlayerNameEN || r.PlayerNameKO),
    nation: r.NationCode || null,
    photo: r.ImgURL ? photoUrl(r.ImgURL, 128) : null,
    circuit: "PBA",
    value: wonCompact(r.Prize),
  }));

  const nameIndex = getPlayerNameIndex();
  const resolveLeaderName = (row: RawTop5Row) => {
    const raw = cleanPlayerName(row.MemNameEn || row.MemName);
    return hasHangul(raw) ? resolveKoreanName(raw, nameIndex) : raw;
  };
  const leaderPicks = LEADER_CATEGORIES.filter((cat) =>
    ["에버리지", "하이런", "최다승", "공격성공률"].includes(cat.key),
  )
    .map((category) => {
      const top = leaders
        .filter((row) => row.Category === category.key && Number(row.Value) > 0)
        .sort((a, b) => a.Rank - b.Rank)[0];
      return top ? { category, row: top } : null;
    })
    .filter(
      (item): item is { category: (typeof LEADER_CATEGORIES)[number]; row: RawTop5Row } =>
        item !== null,
    );

  const standingMap = new Map(standings.map((s) => [s.code, s]));
  const clubLogoFor = (code?: string | null, name?: string | null): string | null => {
    const direct = code ? standingMap.get(code.toUpperCase())?.logo : null;
    if (direct) return direct;
    return name ? matchTeamByNameOrLogo(standings, name, null)?.logo ?? null : null;
  };

  const leadArticle = articles.find((a) => Boolean(a.image)) ?? articles[0] ?? null;
  const remainingArticles = leadArticle
    ? articles.filter((a) => a.seq !== leadArticle.seq)
    : articles;
  const leadPhoto = leadArticle?.image
    ? (eventArtUrl(leadArticle.image, 960) ?? leadArticle.image)
    : null;
  const leadExcerpt =
    leadArticle?.summary && !hasHangul(leadArticle.summary) ? leadArticle.summary : "";

  const leadSplit = leadArticle ? splitNewsHeadline(leadArticle.title) : null;
  const leadStory: HomeLeadStory | null = leadArticle
    ? {
        seq: leadArticle.seq,
        title: leadSplit?.headline ?? leadArticle.title,
        summary: leadExcerpt,
        photo: leadPhoto,
        dateLabel: fmtDate(leadArticle.date),
        viewsLabel: leadArticle.views ? `${grouped(leadArticle.views)} views` : "",
      }
    : null;

  const LEADER_LABELS: Record<string, string> = {
    에버리지: "Highest Average",
    하이런: "High Run",
    최다승: "Most Wins",
    공격성공률: "Attack Rate",
  };

  const formatLeaderValue = (value: number, unit: "avg" | "int" | "pct") => {
    if (unit === "avg") return value.toFixed(3);
    if (unit === "pct") return `${value.toFixed(1)}%`;
    return grouped(value);
  };

  const leftRailSlot = (
    <>
      <Card className="overflow-hidden" aria-label="Active tournaments and circuits">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Tournaments</h2>
          <Link href="/schedule" className="text-xs font-medium text-[var(--pba)] hover:underline">
            Calendar →
          </Link>
        </div>

        {ribbonEvents.length > 0 && (
          <ul className="divide-y divide-border">
            {ribbonEvents.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={`/schedule/${ev.id}`}
                  className="group flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: leagueAccent(ev.league) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground group-hover:text-[var(--pba)]">
                      {shortTourTitle(ev.title)}
                    </div>
                    <div className="mono mt-0.5 text-[11px] text-muted-foreground">
                      {fmtRange(ev.start, ev.end)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border bg-secondary/40 p-2">
          <ul className="space-y-0.5">
            {[
              { href: "/rankings?league=PBA1", label: "PBA Men's Tour", icon: Trophy },
              { href: "/rankings?league=LPBA1", label: "LPBA Women's Tour", icon: Trophy },
              { href: "/teams", label: "PBA Team League", icon: Users },
              { href: "/records", label: "Season Stat Leaders", icon: BarChart3 },
              { href: "/compare", label: "Head-to-Head Compare", icon: Scale },
              { href: "/schedule", label: "Full Tour Calendar", icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-3.5" />
                      {item.label}
                    </span>
                    <ChevronRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <Card className="overflow-hidden" aria-label="Team League standings">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {teamSeason ? `Team League · R${liveRound?.라운드 ?? ""}` : "Team League"}
          </h2>
          <Link href="/teams" className="text-xs font-medium text-[var(--pba)] hover:underline">
            Table →
          </Link>
        </div>

        {standings.length > 0 ? (
          <ul className="divide-y divide-border">
            {standings.slice(0, 6).map((team, idx) => {
              const logo = clubLogoFor(team.code, team.name);
              const badge = clubBadge(team.name, idx);
              return (
                <li
                  key={team.code}
                  className="grid grid-cols-[18px_minmax(0,1fr)_38px_28px] items-center gap-2 px-3.5 py-2 transition-colors hover:bg-accent/50"
                >
                  <span
                    className={`mono text-center text-[11px] font-semibold ${
                      team.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    }`}
                  >
                    {team.rank}
                  </span>
                  <Link
                    href={`/teams/${encodeURIComponent(team.code)}`}
                    className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground hover:text-[var(--pba)]"
                  >
                    {logo ? (
                      <SafeImage
                        src={photoUrl(logo, 96) ?? logo}
                        alt=""
                        className="size-5 shrink-0 rounded bg-white object-contain p-0.5 ring-1 ring-border"
                        fallback={
                          <span className={`cr ${badge.cls}`} aria-hidden="true">
                            {badge.code}
                          </span>
                        }
                      />
                    ) : (
                      <span className={`cr ${badge.cls}`} aria-hidden="true">
                        {badge.code}
                      </span>
                    )}
                    <span className="truncate">{shortClubName(team.shortName || team.name)}</span>
                  </Link>
                  <span className="mono text-right text-[11px] text-muted-foreground">
                    {team.wins}-{team.losses}
                  </span>
                  <span className="mono text-right text-xs font-semibold text-foreground">
                    {team.points}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-5 text-xs text-muted-foreground">Standings unavailable.</p>
        )}
      </Card>

      {leaderPicks.length > 0 && (
        <Card className="overflow-hidden" aria-label="Season stat leaders">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Season Leaders</h2>
            <Link href="/records" className="text-xs font-medium text-[var(--pba)] hover:underline">
              All →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {leaderPicks.map(({ category, row }) => (
              <li
                key={category.key}
                className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground">
                    {LEADER_LABELS[category.key] ?? category.label}
                  </div>
                  <Link
                    href={`/players/${encodeURIComponent(row.MemCode)}`}
                    className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-[var(--pba)]"
                  >
                    <i className={flagClass(row.NationCode)} aria-hidden="true" />
                    <span className="truncate">{resolveLeaderName(row)}</span>
                  </Link>
                </div>
                <span className="mono shrink-0 text-sm font-semibold text-foreground">
                  {formatLeaderValue(Number(row.Value), category.unit)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );

  // When in standby (no live tables), the center hero already displays leadArticle —
  // promote the next article into the right-rail News card so the same photo isn't shown twice.
  const railLeadArticle =
    initialLive.length === 0 && remainingArticles.length > 0 ? remainingArticles[0] : leadArticle;
  const railLeadPhoto = railLeadArticle?.image
    ? (eventArtUrl(railLeadArticle.image, 768) ?? railLeadArticle.image)
    : null;
  const railLeadSplit = railLeadArticle ? splitNewsHeadline(railLeadArticle.title) : null;
  const railListArticles = railLeadArticle
    ? articles.filter((a) => a.seq !== railLeadArticle.seq && (initialLive.length > 0 || a.seq !== leadArticle?.seq))
    : remainingArticles;

  const rightRailSlot = (
    <>
      <HomeRankingsCard pba={pbaRankItems} lpba={lpbaRankItems} prize={prizeRankItems} />

      <Card className="overflow-hidden" aria-label="PBA Newsroom">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Latest News</h2>
          <Link href="/news" className="text-xs font-medium text-[var(--pba)] hover:underline">
            All news →
          </Link>
        </div>

        {railLeadArticle && (
          <Link href={`/news/${railLeadArticle.seq}`} className="group block border-b border-border">
            <div className="aspect-[16/10] w-full overflow-hidden bg-zinc-950">
              {railLeadPhoto ? (
                <SafeImage
                  src={railLeadPhoto}
                  alt={railLeadArticle.title}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-xs font-medium text-zinc-400">
                      PBA Newsroom
                    </div>
                  }
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-xs font-medium text-zinc-400">
                  PBA Newsroom
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="text-[11px] font-medium text-[var(--pba)]">
                {railLeadSplit?.kicker || "Featured"} · {fmtDate(railLeadArticle.date)}
              </div>
              <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-[var(--pba)]">
                {railLeadSplit?.headline ?? railLeadArticle.title}
              </h3>
            </div>
          </Link>
        )}

        <div className="divide-y divide-border">
          {railListArticles.slice(0, 4).map((art) => {
            const thumb = art.image ? (eventArtUrl(art.image, 256) ?? art.image) : null;
            const split = splitNewsHeadline(art.title);
            return (
              <Link
                key={art.seq}
                href={`/news/${art.seq}`}
                className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div className="relative h-[52px] w-[76px] shrink-0 overflow-hidden rounded-md border border-border bg-zinc-950">
                  {thumb ? (
                    <SafeImage
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
                      fallback={
                        <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-[10px] font-semibold text-zinc-400">
                          PBA
                        </div>
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-[10px] font-semibold text-zinc-400">
                      PBA
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-[var(--pba)]">
                    {split.headline}
                  </h3>
                  <p className="mono mt-1 text-[11px] text-muted-foreground">
                    {fmtDate(art.date)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </>
  );

  return (
    <HomeArenaHub
      initialLive={initialLive}
      initialFeedReachable={feed.reachable}
      days={days}
      teamFallback={teamFallback}
      leadStory={leadStory}
      leftRailSlot={leftRailSlot}
      rightRailSlot={rightRailSlot}
    />
  );
}
