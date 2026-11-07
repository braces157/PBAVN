import type { Metadata } from "next";
import { Suspense } from "react";
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
import { getPlayerCached, getPlayerMatchHistory } from "@/lib/pba/service";
import { getRequestFailures } from "@/lib/pba/failures";
import { getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import {
  hasStatData,
  leagueByCode,
  normalizePlayer,
  normalizePlayerStat,
  statLeagueCode,
} from "@/lib/normalize";
import { average, grouped, ordinal, percent, wonCompact, won } from "@/lib/format";
import { InitialsPlate, NationPlate } from "@/components/ui/media";
import { SafeImage } from "@/components/ui/safe-image";
import { Chip, EmptyState, RankBadge, Stat, TextLink, cn } from "@/components/ui/primitives";
import { FilterRow } from "@/components/domain/filter-bar";
import { PlayerSubNav } from "@/components/domain/player-sub-nav";
import { DataStatus } from "@/components/site/data-status";

export const revalidate = 900;

async function RecentMatches({ memCode, nameEn, nameEnShort, seasonCode, pbaType }: {
  memCode: string; nameEn: string | null | undefined; nameEnShort: string | null | undefined;
  seasonCode: string; pbaType: string;
}) {
  const { history, failures } = await trackFailures(async () => {
    const history = await getPlayerMatchHistory({ memCode, nameEn, nameEnShort, seasonCode, pbaType });
    return { history, failures: getRequestFailures() };
  });
  const matches = history.matches.slice(0, 5);
  return <div className="surface overflow-hidden">
    <DataStatus failures={failures} className="m-3" />
    {matches.length === 0 ? <p className="p-4 text-sm text-fog-400">{failures.length || history.toursFailed ? "Match history is temporarily unavailable." : !history.searchTerm ? "Match history is unavailable for this player's published name." : "No individual-tour matches found for this season."}</p> :
      <ul className="divide-y divide-ink-800">{matches.map((match) => {
        const own = match.sides.find((side) => side.memCode === memCode);
        const opponent = match.sides.find((side) => side.memCode !== memCode);
        if (!own) return null;
        return <li key={`${match.tourCode}-${match.pstCode}`}>
          <Link href={`/matches/${match.pstCode}?tour=${encodeURIComponent(match.tourCode)}&round=${encodeURIComponent(match.round)}`} className="row-hover flex items-center gap-3 px-4 py-3">
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold", own.won ? "bg-lime-400/10 text-lime-400" : "bg-ink-800 text-fog-400")}>{own.won ? "W" : "L"}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fog-100">vs {opponent?.name ?? "Unknown opponent"}</span><span className="mt-1 block truncate text-xs text-fog-400">{match.tourTitle} · {match.round || "Round unavailable"}{match.scheduledAt ? ` · ${match.scheduledAt} KST` : ""}</span></span>
            <span className="tnum shrink-0 text-sm font-bold text-fog-100">{own.sets}–{opponent?.sets ?? "—"}</span>
          </Link>
        </li>;
      })}</ul>}
    {(history.partial || history.toursFailed > 0) && <p className="border-t border-ink-800 px-4 py-2 text-xs text-amber-450">Some matches may be missing from this season.</p>}
  </div>;
}

interface PageProps {
  params: Promise<{ memCode: string }>;
  searchParams: Promise<{ season?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { memCode } = await params;
  const raw = await getPlayerCached(memCode);
  if (!raw) return { title: "Player not found" };
  const name = raw.PlayerNameEN || raw.PlayerNameKO;
  return {
    title: name,
    description: `${name} — season averages, high runs, win rates, bank-shot accuracy, tour results and prize money on the PBA / LPBA tour.`,
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

  // A pinned season is honoured as-is. Otherwise the page opens on the most
  // recent season that actually has recorded statistics, so a mid-season
  // profile does not greet readers with an empty board. That fallback only
  // runs when the current season genuinely has none: a failed request would
  // otherwise present an older season as this season's figures. The candidate
  // seasons are probed together rather than one after another — the probes are
  // independent reads and the pick below still walks them newest-first.
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
  // The board never answered, so "no statistics this season" would be a
  // claim we cannot make — the stat grid and the notice below say so instead.
  const seasonUnavailable = !first.answered || fallbackUnavailable;
  const seasonPrizeRank = seasonRank?.상금순위 ?? 0;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section id="overview" className="relative scroll-mt-32 overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-40" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-20 -top-32 h-[440px] w-[440px] rounded-full opacity-[0.10] blur-[120px]"
          style={{ background: "var(--color-lime-400)" }}
          aria-hidden="true"
        />
        {seasonPrizeRank > 0 && seasonPrizeRank <= 100 && (
          <span
            className="pointer-events-none absolute -right-6 top-10 hidden select-none font-display text-[220px] font-extrabold leading-none tracking-tighter text-ink-800/60 lg:block"
            aria-hidden="true"
          >
            {seasonPrizeRank}
          </span>
        )}

        <div className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-8 sm:px-6 lg:px-10">
          <nav className="flex items-center gap-2 text-[11.5px] text-fog-600" aria-label="Breadcrumb">
            <Link href="/players" className="transition-colors hover:text-fog-300">
              Players
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href={`/players?league=${player.league}`}
              className="transition-colors hover:text-fog-300"
            >
              {league.name}
            </Link>
          </nav>

          <div className="mt-7 grid gap-8 md:grid-cols-[200px_1fr] lg:gap-12">
            <div className="relative">
              <div className="relative aspect-[4/5] w-[200px] overflow-hidden rounded-[14px] border border-ink-700 bg-ink-800">
                <SafeImage
                  path={player.photoPath}
                  src={player.photoLarge ?? player.photo}
                  width={400}
                  alt=""
                  loading="eager"
                  className="h-full w-full object-cover object-top"
                  fallback={<InitialsPlate name={player.name} />}
                />
              </div>
              {seasonPrizeRank > 0 && (
                <div className="absolute -bottom-3 -right-3 grid h-14 w-14 place-items-center rounded-xl border border-gold-400/40 bg-ink-950 text-center">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-gold-400">Prize</p>
                    <p className="tnum font-display text-sm font-bold text-fog-100">#{seasonPrizeRank}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={league.tone}>{league.name}</Chip>
                <Chip tone="neutral">{player.gender === "F" ? "Women" : "Men"}</Chip>
                {player.birth && <Chip tone="neutral">b. {player.birth.slice(0, 4)}</Chip>}
              </div>

              <h1 className="display-lg mt-4 text-fog-100">{player.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-fog-500">
                <span className="font-medium text-fog-300">{player.nameKo}</span>
                <NationPlate code={player.nation} />
                <span className="tnum">#{player.code}</span>
              </p>

              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink-800 pt-6 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="Season average" value={hasData ? average(line.average) : "—"} hint={seasonCode} accent />
                <Stat label="Season high run" value={hasData ? grouped(line.highRun) : "—"} />
                <Stat label="Season win rate" value={hasData ? percent(line.winRate, 1) : "—"} hint={hasData ? `${line.wins}W · ${line.losses}L` : undefined} />
                <Stat label="Season prize money" value={seasonRank ? wonCompact(seasonRank.상금) : "—"} hint={seasonRank ? `Rank #${seasonRank.상금순위 || "—"}` : undefined} />
                <Stat
                  label="Season ranking points"
                  value={seasonRank ? grouped(seasonRank.랭킹포인트) : "—"}
                  hint={seasonRank ? `Rank #${seasonRank.랭킹포인트순위 || "—"}` : undefined}
                />
              </dl>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <PlayerSubNav hasSeason={hasData} hasEvents={tourStats.length > 0} hasTitles={championships.length > 0} />

        <section id="matches" className="mb-10 scroll-mt-40">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><p className="eyebrow">Individual tour</p><h2 className="mt-1 font-display text-xl font-bold text-fog-100">Recent matches</h2></div>
            <TextLink href={`/players/${memCode}/matches?season=${encodeURIComponent(seasonCode)}`}>All matches →</TextLink>
          </div>
          <Suspense fallback={<p className="surface p-4 text-sm text-fog-400">Loading match history…</p>}>
            <RecentMatches memCode={memCode} nameEn={raw.PlayerNameEN} nameEnShort={raw.PlayerNameENShort} seasonCode={seasonCode} pbaType={pbaType} />
          </Suspense>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.6fr] lg:gap-14">
          <div className="min-w-0">
            <div id="season" className="scroll-mt-32 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Season statistics</p>
                <h2 className="display-md mt-2 text-fog-100">
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
                <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-ink-750 bg-ink-750 sm:grid-cols-3">
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
                  {/* The season feed omits `뱅크샷`; a hard zero would read as "never banked a ball". */}
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

                <p className="mt-3 text-[11.5px] leading-relaxed text-fog-600">
                  Rank shows the player's position on that metric within the {league.name} table for
                  this season.
                </p>
              </>
            ) : seasonUnavailable ? (
              <DataStatus
                className="mt-6"
                failures={failures.length > 0 ? failures : ["season statistics"]}
              />
            ) : (
              <EmptyState
                className="mt-6"
                title="No recorded statistics"
                description={`This player has no ${league.name} match data logged for the selected season. Try an earlier season above.`}
              />
            )}

            {tourStats.length > 0 && (
              <section id="events" className="mt-12 scroll-mt-32">
                <h2 className="display-md text-fog-100">Tour-by-tour</h2>
                <p className="mt-2 text-[13px] text-fog-500">
                  Every event this player entered in the selected season, with the per-event average and
                  finish.
                </p>
                <div className="mt-5 overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900">
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
                              <span className="block max-w-[260px] truncate text-[13px] text-fog-100">
                                {tour.TourTitleEn || tour.TourTitle}
                              </span>
                              <span className="block max-w-[260px] truncate text-[10.5px] text-fog-600">
                                {tour.TourTitle}
                              </span>
                            </td>
                            <td className="font-semibold text-fog-100">{average(stat.average)}</td>
                            <td className="hidden text-fog-300 sm:table-cell">{grouped(stat.highRun)}</td>
                            <td className="hidden text-fog-400 sm:table-cell">{grouped(stat.matches)}</td>
                            <td className="hidden text-fog-400 md:table-cell">{percent(stat.bankShotRate)}</td>
                            <td className="hidden text-fog-400 md:table-cell">{percent(stat.attackRate)}</td>
                            <td className="text-fog-300">{wonCompact(tour.상금)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* ------------------------------------------------------- sidebar */}
          <aside id="career" className="scroll-mt-32 space-y-4">
            {seasonRank && (
              <div className="surface p-4">
                <p className="eyebrow">Season standing</p>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fog-600">
                      Ranking pts
                    </p>
                    <p className="tnum mt-1 font-display text-lg font-bold text-fog-100">
                      {grouped(seasonRank.랭킹포인트)}
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-fog-500">
                      {ordinal(seasonRank.랭킹포인트순위)} place
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fog-600">Prize</p>
                    <p className="tnum mt-1 font-display text-lg font-bold text-lime-400">
                      {wonCompact(seasonRank.상금)}
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-fog-500">
                      {ordinal(seasonRank.상금순위)} place
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-800 pt-3 text-[12px]">
                  <div>
                    <dt className="text-fog-600">Events entered</dt>
                    <dd className="tnum mt-0.5 text-fog-200">{grouped(seasonRank.참가대회)}</dd>
                  </div>
                  <div>
                    <dt className="text-fog-600">Titles</dt>
                    <dd className="tnum mt-0.5 text-fog-200">{grouped(seasonRank.우승횟수)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {careerRank && (
              <div className="surface p-4">
                <p className="eyebrow">Career</p>
                <dl className="mt-3 space-y-2.5 text-[12.5px]">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-500">Events entered</dt>
                    <dd className="tnum text-fog-100">{grouped(careerRank.참가횟수)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-500">Titles</dt>
                    <dd className="tnum text-fog-100">{grouped(careerRank.우승횟수)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-500">Ranking points</dt>
                    <dd className="tnum text-fog-100">{grouped(careerRank.랭킹포인트)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-500">Career prize</dt>
                    <dd className="tnum text-lime-400">{won(careerRank.상금)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {championships.length > 0 && (
              <div id="titles" className="surface scroll-mt-32 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow">Titles</p>
                  <span className="tnum text-[11px] text-fog-600">{championships.length}</span>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {championships.map((title, index) => (
                    <li key={`${title.SeasonCode}-${title.TourTitleEn}-${index}`} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-gold-400/15 text-[10px] font-bold text-gold-400">
                        ★
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-fog-100">
                          {title.TourTitleEn || title.TourTitle}
                        </p>
                        <p className="tnum text-[10.5px] text-fog-600">{title.SeasonTitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="surface p-4">
              <p className="eyebrow">Compare</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-fog-500">
                Put {player.name.split(" ").slice(-1)[0]} against any other professional on the tour.
              </p>
              <div className="mt-3">
                <TextLink href={`/compare?a=${player.code}`}>Open head-to-head</TextLink>
              </div>
            </div>

            <div className="surface p-4">
              <p className="eyebrow">Profile</p>
              <dl className="mt-3 space-y-2.5 text-[12.5px]">
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-500">Member code</dt>
                  <dd className="tnum text-fog-200">{player.code}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-500">Circuit</dt>
                  <dd className="text-fog-200">{player.league}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-fog-500">Nation</dt>
                  <dd className="flex items-center gap-1.5 text-fog-200">
                    <NationPlate code={player.nation} />
                  </dd>
                </div>
                {player.birth && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fog-500">Born</dt>
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
    <div className="bg-ink-900 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">{label}</p>
        {rank ? <RankBadge rank={rank} size="sm" /> : null}
      </div>
      <p
        className={cn(
          "tnum mt-1.5 font-display text-xl font-bold leading-none",
          accent ? "text-lime-400" : "text-fog-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}
