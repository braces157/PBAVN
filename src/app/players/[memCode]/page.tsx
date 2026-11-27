import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerCareerRank,
  getPlayerChampionships,
  getPlayerSeasonRank,
  getPlayerTourStats,
  readPlayerSeasonStats,
  trackFailures,
} from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import {
  getCurrentSeason,
  getPlayerCached,
  getPlayerTeamClub,
  getSeasonCircuitRanks,
  getSeasonList,
  translateKoreanTourTitle,
} from "@/lib/pba/service";
import {
  hasStatData,
  leagueByCode,
  normalizePlayer,
  normalizePlayerStat,
  statLeagueCode,
  winRate,
} from "@/lib/normalize";
import { average, cleanDisplayText, grouped, ordinal, percent, wonCompact, won } from "@/lib/format";
import { Trophy } from "lucide-react";
import { InitialsPlate, NationPlate } from "@/components/ui/media";
import { SafeImage } from "@/components/ui/safe-image";
import { FollowButton } from "@/components/ui/follow-button";
import { EmptyState, KeyValue, Panel, TextLink, cn } from "@/components/ui/primitives";
import { FilterRow } from "@/components/domain/filter-bar";
import { ProfileMatchHistory, ProfileMatchHistorySkeleton } from "@/components/domain/player-match-history";
import { DataStatus } from "@/components/site/data-status";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ memCode: string }>;
  searchParams: Promise<{ season?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { memCode } = await params;
  const raw = await getPlayerCached(memCode);
  if (!raw) return { title: "Player not found" };
  const player = normalizePlayer(raw);
  const title = `${player.name} — Stats & Profile`;
  const description = `${player.name} — 3-cushion season averages, high runs, win rates, bank-shot accuracy, tour results and prize money.`;
  return {
    title,
    description,
    alternates: { canonical: `/players/${encodeURIComponent(player.code)}` },
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PlayerProfilePage({ params, searchParams }: PageProps) {
  const { memCode } = await params;
  const { season: seasonParam } = await searchParams;

  const [raw, seasons, currentSeason] = await Promise.all([
    getPlayerCached(memCode),
    getSeasonList(),
    getCurrentSeason(),
  ]);
  if (!raw) notFound();

  const player = normalizePlayer(raw);
  const league = leagueByCode(player.league);
  const pbaType = statLeagueCode(player.league);

  const requestedSeason =
    seasonParam && seasons.some((s) => s.SeasonCode === seasonParam) ? seasonParam : null;
  let seasonCode = requestedSeason ?? currentSeason.SeasonCode;
  const candidates = requestedSeason
    ? []
    : seasons.filter((s) => s.SeasonCode !== currentSeason.SeasonCode).slice(0, 4);

  const [first, ...probes] = await Promise.all([
    readPlayerSeasonStats({ memCode, seasonCode, pbaType }),
    ...candidates.map((candidate) =>
      readPlayerSeasonStats({ memCode, seasonCode: candidate.SeasonCode, pbaType }),
    ),
  ]);
  let seasonStat = first.stat;
  let fallbackUnavailable = false;
  if (first.answered && !requestedSeason && !hasStatData(normalizePlayerStat(seasonStat))) {
    const winnerIndex = probes.findIndex((probe) => probe.answered && hasStatData(normalizePlayerStat(probe.stat)));
    const firstFailure = probes.findIndex((probe) => !probe.answered);
    fallbackUnavailable = firstFailure >= 0 && (winnerIndex < 0 || firstFailure < winnerIndex);
    if (winnerIndex >= 0 && !fallbackUnavailable) {
      seasonCode = candidates[winnerIndex].SeasonCode;
      seasonStat = probes[winnerIndex].stat;
    }
  }

  const baseLine = normalizePlayerStat(seasonStat);
  const hasData = hasStatData(baseLine);

  const [tourStats, championships, seasonRank, careerRank, circuitRanks, teamClub, failures] = await trackFailures(async () => {
    const [tourStats, championships, seasonRank, careerRank, circuitRanks, teamClub] = await Promise.all([
      getPlayerTourStats({ memCode, seasonCode, pbaType }),
      getPlayerChampionships(memCode),
      getPlayerSeasonRank({ memCode, seasonCode, pbaType }),
      getPlayerCareerRank(memCode),
      hasData ? getSeasonCircuitRanks(seasonCode, pbaType) : Promise.resolve(new Map()),
      getPlayerTeamClub(memCode),
    ]);
    return [tourStats, championships, seasonRank, careerRank, circuitRanks, teamClub, getRequestFailures()] as const;
  });

  const computedRanks = circuitRanks.get(memCode);
  const line = computedRanks
    ? {
        ...baseLine,
        ranks: {
          ...baseLine.ranks,
          winRate: baseLine.ranks.winRate || computedRanks.winRate,
          points: baseLine.ranks.points || computedRanks.points,
          shootoutRate: baseLine.ranks.shootoutRate || computedRanks.shootoutRate,
        },
      }
    : baseLine;
  const seasonUnavailable = !first.answered || fallbackUnavailable;
  const rate = winRate(player);
  const age = (() => {
    if (!player.birth) return null;
    const born = new Date(player.birth);
    if (Number.isNaN(born.getTime())) return null;
    const now = new Date();
    const years = now.getFullYear() - born.getFullYear();
    const beforeBirthday =
      now.getMonth() < born.getMonth() ||
      (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
    return beforeBirthday ? years - 1 : years;
  })();

  const seasonTitle = seasons.find((s) => s.SeasonCode === seasonCode)?.SeasonTitle ?? seasonCode;
  const lastName = player.name.trim().split(/\s+/).slice(-1)[0] ?? player.name;

  return (
    <>
      <section
        id="overview"
        className="relative scroll-mt-24 border-b border-zinc-800/80 bg-zinc-950 text-zinc-50"
      >
        <div className="wrap relative">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <nav className="flex items-center gap-1.5 text-xs text-zinc-400" aria-label="Breadcrumb">
              <Link href="/players" className="transition-colors hover:text-zinc-100">
                Players
              </Link>
              <span aria-hidden="true" className="text-zinc-700">/</span>
              <Link href={`/players?league=${player.league}`} className="transition-colors hover:text-zinc-100">
                {league.name}
              </Link>
              <span aria-hidden="true" className="text-zinc-700">/</span>
              <span className="text-zinc-200">{player.name}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <FollowButton
                player={{
                  code: player.code,
                  name: player.name,
                  circuit: league.name,
                  nation: player.nation,
                }}
                className="h-8 w-8 border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
              />
              <HeroButton href={`/players/${player.code}/matches`}>Match history</HeroButton>
              <HeroButton href={`/compare?a=${player.code}`} primary>
                Compare H2H
              </HeroButton>
            </div>
          </div>

          <div className="grid gap-5 pb-7 pt-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-7">
            <div className="relative w-fit">
              <div className="relative aspect-[4/5] w-[128px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 sm:w-[152px]">
                <div className="absolute inset-0">
                  <InitialsPlate name={player.name} />
                </div>
                <SafeImage
                  path={player.photoPath}
                  src={player.photoLarge ?? player.photo}
                  width={320}
                  alt=""
                  loading="eager"
                  revealOnLoad
                  className="relative z-10 h-full w-full object-cover object-top"
                  fallback={null}
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <HeroTag tone="accent">{league.name}</HeroTag>
                <HeroTag>{player.gender === "F" ? "Women" : "Men"}</HeroTag>
                {teamClub && (
                  <Link
                    href={`/teams/${encodeURIComponent(teamClub.teamCode)}?season=${encodeURIComponent(teamClub.seasonCode)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-500/35 bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-200 transition-colors hover:bg-blue-500/25 hover:no-underline"
                  >
                    Team League · {teamClub.teamName}
                  </Link>
                )}
                {championships.length > 0 && (
                  <HeroTag tone="gold">
                    <Trophy className="h-3 w-3" aria-hidden="true" />
                    {championships.length} {championships.length === 1 ? "title" : "titles"}
                  </HeroTag>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {player.name}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-zinc-400">
                {player.nameKo && <span className="font-medium text-zinc-200">{player.nameKo}</span>}
                <NationPlate code={player.nation} />
                {age !== null && <span className="font-mono text-xs tabular-nums">{age} yrs</span>}
                <span className="font-mono text-xs tabular-nums text-zinc-500">ID {player.code}</span>
              </p>

              <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 lg:grid-cols-5">
                <HeroStat label="Career avg" value={average(player.average)} highlight />
                <HeroStat label="High run" value={grouped(player.highRun)} />
                <HeroStat label="Win rate" value={percent(rate, 1)} hint={`${player.wins}W – ${player.losses}L`} />
                <HeroStat
                  label="Career prize"
                  value={wonCompact(player.prize)}
                  hint={player.prizeRank > 0 ? `Rank #${player.prizeRank}` : undefined}
                />
                <HeroStat
                  label="Ranking pts"
                  value={grouped(player.points)}
                  hint={player.pointsRank > 0 ? `Rank #${player.pointsRank}` : undefined}
                />
              </dl>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap py-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <div id="season" className="scroll-mt-24 space-y-4">
              <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Season statistics
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{seasonTitle}</h2>
                </div>
                <FilterRow
                  label="Season"
                  basePath={`/players/${memCode}`}
                  paramKey="season"
                  active={seasonCode}
                  params={{}}
                  options={seasons.slice(0, 5).map((s) => ({
                    value: s.SeasonCode,
                    label: s.SeasonTitle || s.SeasonCode,
                  }))}
                />
              </div>

              {hasData ? (
                <>
                  <Panel>
                    <div className="grid grid-cols-2 md:grid-cols-4">
                      <HeadlineStat label="Average" value={average(line.average)} rank={line.ranks.average} accent />
                      <HeadlineStat label="High run" value={grouped(line.highRun)} rank={line.ranks.highRun} />
                      <HeadlineStat label="Win rate" value={percent(line.winRate)} rank={line.ranks.winRate} />
                      <HeadlineStat label="Points" value={grouped(line.points)} rank={line.ranks.points} />
                    </div>
                    <div className="grid gap-x-8 gap-y-4 border-t border-border bg-secondary/40 px-4 py-4 md:grid-cols-2">
                      <RecordBar label="Match record" wins={line.wins} losses={line.losses} />
                      <RecordBar label="Set record" wins={line.setWins} losses={line.setLosses} />
                    </div>
                  </Panel>

                  <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                    <Panel title="Shot profile" meta="success rate · circuit rank">
                      <ul className="divide-y divide-border/60">
                        <RateRow
                          label="Bank shot"
                          hint="Share of total points scored via 2-point bank shots."
                          value={line.bankShotRate}
                          rank={line.ranks.bankShotRate}
                        />
                        <RateRow
                          label="First shot"
                          hint="Success rate on the opening break/first shot of an inning."
                          value={line.firstShotRate}
                          rank={line.ranks.firstShotRate}
                        />
                        <RateRow
                          label="Attack success"
                          hint="Percentage of all shot attempts scored."
                          value={line.attackRate}
                          rank={line.ranks.attackRate}
                        />
                        <RateRow
                          label="Long run"
                          hint="Frequency of high-scoring 5+ point runs."
                          value={line.longRunRate}
                          rank={line.ranks.longRunRate}
                        />
                        <RateRow
                          label="Shootout"
                          hint="Win rate in sudden-death 2–2 shootouts (R128/R64)."
                          value={line.shootoutRate}
                          rank={line.ranks.shootoutRate}
                        />
                      </ul>
                    </Panel>

                    <Panel title="Volume">
                      <div className="grid grid-cols-2 gap-px bg-border/60">
                        <VolumeCell label="Matches" value={grouped(line.matches)} />
                        <VolumeCell label="Innings" value={grouped(line.innings)} />
                        <VolumeCell
                          label="Innings / match"
                          value={line.matches ? (line.innings / line.matches).toFixed(1) : "—"}
                        />
                        <VolumeCell
                          label="Bank shots made"
                          value={
                            line.bankShots > 0
                              ? grouped(line.bankShots)
                              : line.twoPoint > 0
                                ? grouped(line.twoPoint)
                                : "—"
                          }
                        />
                        <VolumeCell label="One-point scores" value={grouped(line.onePoint)} />
                        <VolumeCell label="Two-point scores" value={grouped(line.twoPoint)} />
                      </div>
                    </Panel>
                  </div>
                </>
              ) : seasonUnavailable ? (
                <DataStatus failures={failures.length > 0 ? failures : ["season statistics"]} />
              ) : (
                <EmptyState
                  title="No recorded statistics"
                  description={`This player has no ${league.name} match data logged for the selected season. Try an earlier season above.`}
                />
              )}
            </div>

            <Suspense fallback={<ProfileMatchHistorySkeleton seasonTitle={seasonTitle} />}>
              <ProfileMatchHistory
                memCode={memCode}
                playerName={player.name}
                nameEn={raw.PlayerNameEN}
                nameEnShort={raw.PlayerNameENShort}
                seasonCode={seasonCode}
                seasonTitle={seasonTitle}
                pbaType={pbaType}
              />
            </Suspense>

            {tourStats.length > 0 && (
              <Panel
                id="events"
                className="scroll-mt-24"
                title="Tour-by-tour results"
                meta={`${tourStats.length} ${tourStats.length === 1 ? "event" : "events"} · ${seasonTitle}`}
              >
                <div className="overflow-x-auto">
                  <table className="stat-table">
                    <thead>
                      <tr>
                        <th className="!text-left">Tour</th>
                        <th>Avg</th>
                        <th className="hidden sm:table-cell">HR</th>
                        <th className="hidden sm:table-cell">Matches</th>
                        <th className="hidden md:table-cell">Bank</th>
                        <th className="hidden md:table-cell">Attack</th>
                        <th>Prize</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tourStats.map((tour) => {
                        const stat = normalizePlayerStat(tour);
                        const aboveSeason = hasData && stat.average >= line.average;
                        return (
                          <tr key={`${tour.TourCode}-${tour.TourTitleEn}`}>
                            <td className="!text-left">
                              <span className="block min-w-[180px] text-[12.5px] font-medium leading-snug text-[var(--text)]">
                                {translateKoreanTourTitle(tour.TourTitleEn || tour.TourTitle)}
                              </span>
                            </td>
                            <td
                              className={cn(
                                "font-bold",
                                aboveSeason ? "text-[var(--win)]" : "text-[var(--text)]",
                              )}
                            >
                              {average(stat.average)}
                            </td>
                            <td className="hidden sm:table-cell">{grouped(stat.highRun)}</td>
                            <td className="hidden text-[var(--text-2)] sm:table-cell">{grouped(stat.matches)}</td>
                            <td className="hidden text-[var(--text-2)] md:table-cell">{percent(stat.bankShotRate)}</td>
                            <td className="hidden text-[var(--text-2)] md:table-cell">{percent(stat.attackRate)}</td>
                            <td className="font-semibold">{wonCompact(tour.상금)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {hasData && (
                  <p className="border-t border-[var(--line)] px-2.5 py-2 text-[11px] text-[var(--muted)]">
                    <span className="font-semibold text-[var(--win)]">Green</span> averages beat the season average of{" "}
                    {average(line.average)}.
                  </p>
                )}
              </Panel>
            )}
          </div>

          <aside id="career" className="min-w-0 scroll-mt-24 space-y-4">
            {seasonRank && (
              <Panel title="Season standing" meta={seasonTitle}>
                <div className="grid grid-cols-2 divide-x divide-border/60">
                  <div className="px-4 py-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ranking pts</p>
                    <p className="mt-1 font-mono text-xl font-semibold leading-none tabular-nums text-foreground">
                      {grouped(seasonRank.랭킹포인트)}
                    </p>
                    <PlaceTag value={seasonRank.랭킹포인트순위} />
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Prize money</p>
                    <p className="mt-1 font-mono text-xl font-semibold leading-none tabular-nums text-foreground">
                      {wonCompact(seasonRank.상금)}
                    </p>
                    <PlaceTag value={seasonRank.상금순위} />
                  </div>
                </div>
                <dl className="border-t border-border/60 px-4">
                  <KeyValue label="Events entered">{grouped(seasonRank.참가대회)}</KeyValue>
                  <KeyValue label="Titles">{grouped(seasonRank.우승횟수)}</KeyValue>
                </dl>
              </Panel>
            )}

            <Panel title="Career totals">
              <dl className="px-4">
                {careerRank && <KeyValue label="Events entered">{grouped(careerRank.참가횟수)}</KeyValue>}
                <KeyValue label="Titles">
                  <span className="font-semibold text-amber-500">{grouped(championships.length)}</span>
                </KeyValue>
                <KeyValue label="Ranking points">{grouped(player.points)}</KeyValue>
                <KeyValue label="Career prize">
                  <span className="font-semibold text-foreground">{won(player.prize)}</span>
                </KeyValue>
              </dl>
            </Panel>

            {championships.length > 0 && (
              <Panel id="titles" className="scroll-mt-24" title="Titles" meta={championships.length}>
                <ul className="divide-y divide-border/60">
                  {championships.map((title, index) => (
                    <li
                      key={`${title.SeasonCode}-${title.TourTitleEn}-${index}`}
                      className="flex items-start gap-2.5 px-4 py-3"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-500/15 text-amber-500"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-foreground">
                          {cleanDisplayText(title.TourTitleEn) || translateKoreanTourTitle(title.TourTitle)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {title.SeasonTitle}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Profile">
              <dl className="px-4">
                {player.nameKo && <KeyValue label="Korean name">{player.nameKo}</KeyValue>}
                <KeyValue label="Nation">
                  <NationPlate code={player.nation} />
                </KeyValue>
                {player.birth && (
                  <KeyValue label="Born">
                    <span className="font-mono tabular-nums">
                      {player.birth}
                      {age !== null && <span className="text-muted-foreground"> · {age} yrs</span>}
                    </span>
                  </KeyValue>
                )}
                <KeyValue label="Circuit">{league.name}</KeyValue>
                <KeyValue label="Member code">
                  <span className="font-mono tabular-nums">{player.code}</span>
                </KeyValue>
              </dl>
              <div className="flex flex-col gap-1.5 border-t border-border/60 bg-secondary/40 px-4 py-3">
                <TextLink href={`/players/${player.code}/matches`}>All matches by {lastName}</TextLink>
                <TextLink href={`/compare?a=${player.code}`}>Compare head-to-head</TextLink>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}

function HeroButton({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors hover:no-underline",
        primary
          ? "bg-white text-zinc-950 hover:bg-zinc-200"
          : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}

function HeroTag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "gold" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium",
        tone === "accent" && "bg-zinc-800 text-zinc-100",
        tone === "gold" && "bg-amber-500/15 text-amber-400",
        tone === "plain" && "border border-zinc-800 bg-zinc-900 text-zinc-400",
      )}
    >
      {children}
    </span>
  );
}

function HeroStat({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-b border-r border-zinc-800 px-4 py-3.5 even:border-r-0 last:col-span-2 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:col-span-1 lg:last:border-r-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-mono text-2xl font-semibold leading-none tabular-nums",
          highlight ? "text-emerald-400" : "text-white",
        )}
      >
        {value}
      </dd>
      {hint && <dd className="mt-1 font-mono text-[11px] tabular-nums text-zinc-500">{hint}</dd>}
    </div>
  );
}

function RankText({ rank }: { rank?: number }) {
  if (!rank) return null;
  if (rank <= 3) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums",
          rank === 1 ? "bg-foreground text-background" : "bg-secondary text-foreground",
        )}
      >
        {ordinal(rank)}
      </span>
    );
  }
  return <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">{ordinal(rank)}</span>;
}

function HeadlineStat({
  label,
  value,
  rank,
  accent = false,
}: {
  label: string;
  value: string;
  rank?: number;
  accent?: boolean;
}) {
  return (
    <div className="border-b border-r border-border/60 px-4 py-4 even:border-r-0 md:border-b-0 md:even:border-r md:last:border-r-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold leading-none tabular-nums sm:text-3xl",
          accent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {rank ? (
          <>
            <RankText rank={rank} />
            <span>on circuit</span>
          </>
        ) : (
          <span>—</span>
        )}
      </p>
    </div>
  );
}

function RecordBar({ label, wins, losses }: { label: string; wins: number; losses: number }) {
  const total = wins + losses;
  const share = total ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-mono text-xs font-semibold tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">{wins}W</span>
          <span className="mx-1 text-muted-foreground">–</span>
          <span className="text-rose-600 dark:text-rose-400">{losses}L</span>
          <span className="ml-2 text-muted-foreground">{total ? `${share.toFixed(0)}%` : "—"}</span>
        </p>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

function RateRow({ label, hint, value, rank }: { label: string; hint?: string; value: number; rank?: number }) {
  const width = Math.max(0, Math.min(100, value || 0));
  const top = rank !== undefined && rank > 0 && rank <= 3;
  return (
    <li className="grid grid-cols-[110px_minmax(0,1fr)_56px_44px] items-center gap-3 px-4 py-2.5" title={hint}>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <span
          className={cn("block h-full rounded-full", top ? "bg-amber-500" : "bg-foreground/75")}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">{percent(value)}</span>
      <span className="text-right">
        <RankText rank={rank} />
      </span>
    </li>
  );
}

function VolumeCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold leading-none tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function PlaceTag({ value }: { value: number | string | null | undefined }) {
  const n = Number(value);
  if (!n) return <p className="mt-1.5 text-xs text-muted-foreground">—</p>;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      <RankText rank={n} />
      <span>place</span>
    </p>
  );
}
