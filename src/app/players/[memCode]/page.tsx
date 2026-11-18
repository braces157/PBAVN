import type { Metadata } from "next";
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
import { getCurrentSeason, getPlayerCached, getSeasonList, translateKoreanTourTitle } from "@/lib/pba/service";
import {
  hasStatData,
  leagueByCode,
  normalizePlayer,
  normalizePlayerStat,
  statLeagueCode,
  winRate,
} from "@/lib/normalize";
import { average, cleanDisplayText, grouped, ordinal, percent, wonCompact, won } from "@/lib/format";
import { InitialsPlate, NationPlate } from "@/components/ui/media";
import { SafeImage } from "@/components/ui/safe-image";
import { Chip, EmptyState, RankBadge, Stat, TextLink, cn } from "@/components/ui/primitives";
import { FilterRow } from "@/components/domain/filter-bar";
import { PlayerSubNav } from "@/components/domain/player-sub-nav";
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
  return {
    title: `${player.name} — Stats & Profile`,
    description: `${player.name} — 3-cushion season averages, high runs, win rates, bank-shot accuracy, tour results and prize money.`,
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

  const [tourStats, championships, seasonRank, careerRank, failures] = await trackFailures(async () => {
    const [tourStats, championships, seasonRank, careerRank] = await Promise.all([
      getPlayerTourStats({ memCode, seasonCode, pbaType }),
      getPlayerChampionships(memCode),
      getPlayerSeasonRank({ memCode, seasonCode, pbaType }),
      getPlayerCareerRank(memCode),
    ]);
    return [tourStats, championships, seasonRank, careerRank, getRequestFailures()] as const;
  });

  const line = normalizePlayerStat(seasonStat);
  const hasData = hasStatData(line);
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

  return (
    <>
      <section id="overview" className="scroll-mt-24 border-b border-ink-800 bg-ink-900">
        <div className="mx-auto max-w-[1300px] px-3 pb-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex items-center gap-1.5 text-[11.5px] text-fog-500" aria-label="Breadcrumb">
              <Link href="/players" className="transition-colors hover:text-carom-300">
                Players
              </Link>
              <span aria-hidden="true">/</span>
              <Link
                href={`/players?league=${player.league}`}
                className="transition-colors hover:text-carom-300"
              >
                {league.name}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-fog-300">{player.name}</span>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href={`/players/${player.code}/matches`}
                className="rounded-md border border-ink-700 bg-ink-900 px-3 py-1 text-[12px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
              >
                Match History
              </Link>
              <Link
                href={`/compare?a=${player.code}`}
                className="rounded-md border border-ink-700 bg-ink-900 px-3 py-1 text-[12px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
              >
                Compare H2H
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-[136px_1fr] lg:gap-8">
            <div className="relative w-fit">
              <div className="relative aspect-[4/5] w-[124px] overflow-hidden rounded-[8px] border border-ink-700 bg-ink-850 sm:w-[136px]">
                <SafeImage
                  path={player.photoPath}
                  src={player.photoLarge ?? player.photo}
                  width={320}
                  alt=""
                  loading="eager"
                  className="h-full w-full object-cover object-top"
                  fallback={<InitialsPlate name={player.name} />}
                />
              </div>
              {player.prizeRank > 0 && (
                <div className="absolute -bottom-2 -right-2 rounded-md border border-gold-400/50 bg-ink-950 px-2 py-0.5 text-center shadow">
                  <span className="tnum font-display text-[12px] font-extrabold text-gold-300">#{player.prizeRank}</span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={league.tone}>{league.name}</Chip>
                <Chip tone="neutral">{player.gender === "F" ? "Women" : "Men"}</Chip>
                {player.birth && <Chip tone="neutral">b. {player.birth.slice(0, 4)}</Chip>}
              </div>

              <h1 className="display-lg mt-2.5 text-fog-100">{player.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-fog-450">
                <span className="font-semibold text-fog-200">{player.nameKo}</span>
                <NationPlate code={player.nation} />
                {age !== null && <span className="tnum">{age} yrs</span>}
                <span className="tnum text-fog-550">#{player.code}</span>
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink-800 pt-4 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="Career Average" value={average(player.average)} accent />
                <Stat label="High Run" value={grouped(player.highRun)} />
                <Stat label="Win Rate" value={percent(rate, 1)} hint={`${player.wins}W · ${player.losses}L`} />
                <Stat label="Career Prize" value={wonCompact(player.prize)} hint={`Rank #${player.prizeRank || "—"}`} />
                <Stat
                  label="Ranking Points"
                  value={grouped(player.points)}
                  hint={`Rank #${player.pointsRank || "—"}`}
                />
              </dl>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        <PlayerSubNav hasSeason={hasData} hasEvents={tourStats.length > 0} hasTitles={championships.length > 0} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.4fr)_340px]">
          <div className="min-w-0">
            <div id="season" className="scroll-mt-24 flex min-w-0 flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Season Statistics</p>
                <h2 className="display-md mt-1 text-fog-100">
                  {seasons.find((s) => s.SeasonCode === seasonCode)?.SeasonTitle ?? seasonCode}
                </h2>
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
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-ink-750 bg-ink-750 sm:grid-cols-3">
                  <StatCell label="Matches" value={grouped(line.matches)} />
                  <StatCell label="Wins" value={grouped(line.wins)} />
                  <StatCell label="Losses" value={grouped(line.losses)} />
                  <StatCell label="Average" value={average(line.average)} rank={line.ranks.average} accent />
                  <StatCell label="High run" value={grouped(line.highRun)} rank={line.ranks.highRun} />
                  <StatCell label="Win rate" value={percent(line.winRate)} rank={line.ranks.winRate} />
                  <StatCell label="Innings" value={grouped(line.innings)} />
                  <StatCell label="Points" value={grouped(line.points)} rank={line.ranks.points} />
                  <StatCell label="Sets" value={`${line.setWins}–${line.setLosses}`} />
                  <StatCell
                    label="Bank shot"
                    value={percent(line.bankShotRate)}
                    rank={line.ranks.bankShotRate}
                  />
                  <StatCell
                    label="First shot"
                    value={percent(line.firstShotRate)}
                    rank={line.ranks.firstShotRate}
                  />
                  <StatCell
                    label="Attack success"
                    value={percent(line.attackRate)}
                    rank={line.ranks.attackRate}
                  />
                  <StatCell label="Long run" value={percent(line.longRunRate)} rank={line.ranks.longRunRate} />
                  <StatCell label="Shootout" value={percent(line.shootoutRate)} rank={line.ranks.shootoutRate} />
                  <StatCell label="One-point scores" value={grouped(line.onePoint)} />
                  {line.bankShots > 0 ? (
                    <StatCell label="Bank shots made" value={grouped(line.bankShots)} />
                  ) : (
                    <StatCell
                      label="Innings / match"
                      value={line.matches ? (line.innings / line.matches).toFixed(1) : "—"}
                    />
                  )}
                  <StatCell label="Two-point scores" value={grouped(line.twoPoint)} />
                </div>

                <p className="mt-2.5 text-[11px] text-fog-550">
                  Badges show circuit rank for each metric in the selected season.
                </p>
              </>
            ) : seasonUnavailable ? (
              <DataStatus
                className="mt-4"
                failures={failures.length > 0 ? failures : ["season statistics"]}
              />
            ) : (
              <EmptyState
                className="mt-4"
                title="No recorded statistics"
                description={`This player has no ${league.name} match data logged for the selected season. Try an earlier season above.`}
              />
            )}

            {tourStats.length > 0 && (
              <section id="events" className="mt-10 scroll-mt-24">
                <h2 className="display-sm text-fog-100">Tour-by-Tour Results</h2>
                <p className="mt-1 text-[12.5px] text-fog-450">
                  Events entered in the selected season with per-event average and prize money.
                </p>
                <div className="mt-4 overflow-x-auto rounded-[8px] border border-ink-750 bg-ink-900">
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
                        return (
                          <tr key={`${tour.TourCode}-${tour.TourTitleEn}`}>
                            <td className="!text-left">
                              <span className="block max-w-[260px] truncate text-[12.5px] font-medium text-fog-100">
                                {translateKoreanTourTitle(tour.TourTitleEn || tour.TourTitle)}
                              </span>
                            </td>
                            <td className="font-bold text-carom-300">{average(stat.average)}</td>
                            <td className="hidden text-fog-200 sm:table-cell">{grouped(stat.highRun)}</td>
                            <td className="hidden text-fog-400 sm:table-cell">{grouped(stat.matches)}</td>
                            <td className="hidden text-fog-400 md:table-cell">{percent(stat.bankShotRate)}</td>
                            <td className="hidden text-fog-400 md:table-cell">{percent(stat.attackRate)}</td>
                            <td className="font-semibold text-fog-200">{wonCompact(tour.상금)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <aside id="career" className="min-w-0 scroll-mt-24 space-y-4">
            {seasonRank && (
              <div className="surface p-4">
                <p className="eyebrow">Season Standing</p>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-fog-500">
                      Ranking pts
                    </p>
                    <p className="tnum mt-1 font-display text-lg font-bold text-fog-100">
                      {grouped(seasonRank.랭킹포인트)}
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-fog-450">
                      {ordinal(seasonRank.랭킹포인트순위)} place
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-fog-500">Prize</p>
                    <p className="tnum mt-1 font-display text-lg font-bold text-carom-300">
                      {wonCompact(seasonRank.상금)}
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-fog-450">
                      {ordinal(seasonRank.상금순위)} place
                    </p>
                  </div>
                </div>
                <dl className="mt-3.5 grid grid-cols-2 gap-3 border-t border-ink-800 pt-2.5 text-[12px]">
                  <div>
                    <dt className="text-fog-500">Events entered</dt>
                    <dd className="tnum mt-0.5 font-semibold text-fog-200">{grouped(seasonRank.참가대회)}</dd>
                  </div>
                  <div>
                    <dt className="text-fog-500">Titles</dt>
                    <dd className="tnum mt-0.5 font-semibold text-fog-200">{grouped(seasonRank.우승횟수)}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="surface p-4">
              <p className="eyebrow">Career Totals</p>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                {careerRank && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-450">Events entered</dt>
                    <dd className="tnum font-semibold text-fog-100">{grouped(careerRank.참가횟수)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-450">Titles</dt>
                  <dd className="tnum font-semibold text-gold-300">{grouped(championships.length)}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-450">Ranking points</dt>
                  <dd className="tnum font-semibold text-fog-100">{grouped(player.points)}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-450">Career prize</dt>
                  <dd className="tnum font-bold text-carom-300">{won(player.prize)}</dd>
                </div>
              </dl>
            </div>

            {championships.length > 0 && (
              <div id="titles" className="surface scroll-mt-24 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow">Titles</p>
                  <span className="tnum text-[11px] font-semibold text-fog-500">{championships.length}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {championships.map((title, index) => (
                    <li key={`${title.SeasonCode}-${title.TourTitleEn}-${index}`} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-gold-400/15 text-[10px] font-bold text-gold-300">
                        ★
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-fog-100">
                          {cleanDisplayText(title.TourTitleEn) || translateKoreanTourTitle(title.TourTitle)}
                        </p>
                        <p className="tnum text-[10.5px] text-fog-500">{title.SeasonTitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="surface p-4">
              <p className="eyebrow">Match Log</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-fog-450">
                Every individual-tour match played by {player.name.split(" ").slice(-1)[0]}, linking to its inning scorecard.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <TextLink href={`/players/${player.code}/matches`}>Open match history</TextLink>
                <TextLink href={`/compare?a=${player.code}`}>Compare head-to-head</TextLink>
              </div>
            </div>

            <div className="surface p-4">
              <p className="eyebrow">Bio</p>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-450">Member code</dt>
                  <dd className="tnum font-semibold text-fog-200">{player.code}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-450">Circuit</dt>
                  <dd className="font-semibold text-fog-200">{player.league}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-450">Nation</dt>
                  <dd className="flex items-center gap-1.5 text-fog-200">
                    <NationPlate code={player.nation} />
                  </dd>
                </div>
                {player.birth && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-450">Born</dt>
                    <dd className="tnum text-fog-200">{player.birth}</dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function StatCell({
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
    <div className="bg-ink-900 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-fog-500">{label}</p>
        {rank ? <RankBadge rank={rank} size="sm" /> : null}
      </div>
      <p
        className={cn(
          "tnum mt-1.5 font-display text-lg font-bold leading-none",
          accent ? "text-carom-300" : "text-fog-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}
