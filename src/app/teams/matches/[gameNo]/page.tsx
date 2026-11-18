import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamLeagueRounds, getTeamLeagueSeasons, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, getBoutInnings, getFixtureBouts } from "@/lib/pba/team-matches";
import { average } from "@/lib/format";
import { FilterRow } from "@/components/domain/filter-bar";
import { DataStatus } from "@/components/site/data-status";
import { TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, cn } from "@/components/ui/primitives";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ gameNo: string }>;
  searchParams: Promise<{ season?: string; round?: string; set?: string }>;
}

const GAME_NO = /^\d{1,4}$/;
const SET = /^\d{1,2}$/;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameNo } = await params;
  if (!GAME_NO.test(gameNo)) return { title: "Fixture" };
  return {
    title: `Fixture No ${gameNo}`,
    description: "Set-by-set bouts of one PBA Team League fixture, with per-inning records.",
  };
}

export default async function FixturePage({ params, searchParams }: PageProps) {
  const [{ gameNo }, search] = await Promise.all([params, searchParams]);
  const setParam = SET.test(search.set ?? "") ? Number(search.set) : null;

  const loaded = await trackFailures(async () => {
    if (!GAME_NO.test(gameNo)) return null;

    const seasons = await getTeamLeagueSeasons();
    const season = seasons.find((s) => s.시즌코드 === search.season) ?? seasons[0] ?? null;
    if (!season) return null;

    const rounds = await getTeamLeagueRounds(season.리그코드);
    const selectedRound =
      rounds.find((r) => String(r.라운드코드) === search.round) ??
      rounds.find((r) => r.진행상황 === "진행중") ??
      rounds[0] ??
      null;
    if (!selectedRound) return null;

    const roundCode = String(selectedRound.라운드코드);
    const inProgress = selectedRound.진행상황 === "진행중";
    const bouts = await getFixtureBouts(
      roundCode,
      selectedRound.라운드,
      gameNo,
      inProgress ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL,
    );

    const selectedBout =
      bouts && setParam !== null ? bouts.bouts.find((bout) => bout.setNo === setParam) : undefined;
    const innings =
      selectedBout?.tgCode != null ? await getBoutInnings(selectedBout.tgCode) : null;

    return {
      season,
      seasons,
      rounds,
      selectedRound,
      roundCode,
      bouts,
      setParam,
      selectedBout: selectedBout ?? null,
      innings,
      failures: getRequestFailures(),
    };
  });

  if (!loaded) notFound();
  const { season, seasons, rounds, selectedRound, roundCode, bouts, setParam: selectedSet, selectedBout, innings, failures } =
    loaded;

  const roundChips = [...rounds]
    .sort((a, b) => a.라운드 - b.라운드)
    .map((r) => ({
      value: String(r.라운드코드),
      label: `${r.포스트여부 === "Y" ? "PO " : ""}R${r.라운드}`,
    }));

  if (!bouts) {
    return (
      <div className="mx-auto max-w-[1300px] px-3 py-5">
        <nav className="mb-3 flex items-center gap-1.5 text-[11.5px] text-fog-500" aria-label="Breadcrumb">
          <Link href="/teams" className="hover:text-carom-300">Team League</Link>
          <span>/</span>
          <Link href={`/teams/matches?season=${season.시즌코드}&round=${roundCode}`} className="hover:text-carom-300">
            Fixtures
          </Link>
          <span>/</span>
          <span className="text-fog-300">No {gameNo}</span>
        </nav>
        {season && roundChips.length > 0 && (
          <div className="mb-5">
            <FilterRow
              label="Round"
              basePath={`/teams/matches/${gameNo}`}
              paramKey="round"
              active={roundCode}
              params={{ season: season.시즌코드 }}
              options={roundChips}
            />
          </div>
        )}
        <DataStatus failures={failures} />
        <EmptyState
          className="mt-4"
          title={`No bout record for fixture No ${gameNo}`}
          description="Fixture numbers are assigned per round. Pick another round above or return to the fixtures list."
        />
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto max-w-[1300px] px-3 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-fog-500">
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
              <Link href="/teams" className="hover:text-carom-300">Team League</Link>
              <span className="text-ink-600">/</span>
              <Link href={`/teams/matches?season=${encodeURIComponent(season.시즌코드)}&round=${encodeURIComponent(roundCode)}`} className="hover:text-carom-300">
                Round {selectedRound.라운드} Fixtures
              </Link>
              <span className="text-ink-600">/</span>
              <span className="tnum text-fog-300">Fixture #{gameNo}</span>
            </nav>
            <span className="tnum text-[11px] text-fog-450">
              {bouts.bouts.length} bouts{bouts.winner ? "" : " · in play"}
            </span>
          </div>

          {season && (
            <div className="mt-3 flex flex-col gap-2">
              <FilterRow
                label="Season"
                basePath={`/teams/matches/${gameNo}`}
                paramKey="season"
                active={season.시즌코드}
                params={{ round: search.round }}
                options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
              />
              {roundChips.length > 0 && (
                <FilterRow
                  label="Round"
                  basePath={`/teams/matches/${gameNo}`}
                  paramKey="round"
                  active={roundCode}
                  params={{ season: season.시즌코드 }}
                  options={roundChips}
                />
              )}
            </div>
          )}
          <DataStatus failures={failures} />
        </div>
      </header>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        <div className="surface-raised p-4 sm:p-6">
          <div className="space-y-3 sm:hidden">
            {([
              {
                name: bouts.homeName,
                logo: bouts.homeLogo,
                avg: bouts.homeAverage,
                hr: bouts.homeHighRun,
                sets: bouts.homeSets,
                won: bouts.winner === "home",
              },
              {
                name: bouts.awayName,
                logo: bouts.awayLogo,
                avg: bouts.awayAverage,
                hr: bouts.awayHighRun,
                sets: bouts.awaySets,
                won: bouts.winner === "away",
              },
            ] as const).map((side, index) => (
              <div key={index} className="flex items-center gap-3">
                <TeamLogo src={side.logo} name={side.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate font-display text-[15px] font-bold",
                      side.won ? "text-carom-300" : "text-fog-100",
                    )}
                  >
                    {side.name || "—"}
                  </p>
                  {side.avg !== null && (
                    <p className="tnum mt-0.5 truncate text-[11px] text-fog-450">
                      AVG {side.avg.toFixed(3)} · HR {side.hr ?? "—"}
                    </p>
                  )}
                </div>
                {side.won && <Chip tone="carom">W</Chip>}
                <span
                  className={cn(
                    "tnum font-display text-3xl font-extrabold",
                    side.won ? "text-carom-300" : "text-fog-100",
                  )}
                >
                  {side.sets ?? "–"}
                </span>
              </div>
            ))}
            {!bouts.winner && (
              <div className="flex justify-center pt-1">
                <LiveChip label="In play" />
              </div>
            )}
          </div>

          <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-4 sm:grid sm:gap-6">
            <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4">
              <div className="min-w-0 text-right">
                {bouts.winner === "home" && (
                  <Chip tone="carom" className="mb-1">
                    Winner
                  </Chip>
                )}
                <p
                  className={cn(
                    "truncate font-display text-[16px] font-bold",
                    bouts.winner === "home" ? "text-carom-300" : "text-fog-100",
                  )}
                >
                  {bouts.homeName || "—"}
                </p>
                {bouts.homeAverage !== null && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-450">
                    AVG {bouts.homeAverage.toFixed(3)} · HR {bouts.homeHighRun ?? "—"}
                  </p>
                )}
              </div>
              <TeamLogo src={bouts.homeLogo} name={bouts.homeName} size="lg" />
            </div>
            <div className="text-center">
              <p className="tnum font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
                <span className={bouts.winner === "home" ? "text-carom-300" : "text-fog-100"}>
                  {bouts.homeSets ?? "–"}
                </span>
                <span className="mx-1.5 align-middle text-[0.6em] font-bold text-ink-500">–</span>
                <span className={bouts.winner === "away" ? "text-carom-300" : "text-fog-100"}>
                  {bouts.awaySets ?? "–"}
                </span>
              </p>
              {!bouts.winner && (
                <div className="mt-2">
                  <LiveChip label="In play" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <TeamLogo src={bouts.awayLogo} name={bouts.awayName} size="lg" />
              <div className="min-w-0">
                {bouts.winner === "away" && (
                  <Chip tone="carom" className="mb-1">
                    Winner
                  </Chip>
                )}
                <p
                  className={cn(
                    "truncate font-display text-[16px] font-bold",
                    bouts.winner === "away" ? "text-carom-300" : "text-fog-100",
                  )}
                >
                  {bouts.awayName || "—"}
                </p>
                {bouts.awayAverage !== null && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-450">
                    AVG {bouts.awayAverage.toFixed(3)} · HR {bouts.awayHighRun ?? "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {bouts.bouts.map((bout) => {
            const expanded = selectedSet === bout.setNo;
            return (
              <li key={bout.setNo} id={`set-${bout.setNo}`} className="scroll-mt-20">
                <div className="surface overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 bg-ink-850 px-4 py-2">
                    <span className="font-display text-[12.5px] font-bold uppercase tracking-wide text-fog-100">
                      Set {bout.setNo}
                    </span>
                    {bout.format && <Chip tone="neutral">{bout.format}</Chip>}
                    {bout.playedAt && (
                      <span className="tnum text-[11px] text-fog-500">{bout.playedAt}</span>
                    )}
                    <span className="flex-1" />
                    {bout.tgCode ? (
                      <Link
                        href={`/teams/matches/${gameNo}?season=${encodeURIComponent(season?.시즌코드 ?? "")}&round=${encodeURIComponent(roundCode)}&set=${bout.setNo}`}
                        className={cn(
                          "text-[11.5px] font-semibold underline-offset-2 hover:underline",
                          expanded ? "text-carom-300" : "text-carom-400",
                        )}
                      >
                        {expanded ? "Innings shown" : "Innings →"}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-fog-550">In play</span>
                    )}
                  </div>

                  <div className="space-y-2 p-4">
                    {bout.sides.map((side, index) => (
                      <div
                        key={`${bout.setNo}-${index}`}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                      >
                        <span
                          className={cn(
                            "w-5 shrink-0 text-center text-[11px] font-bold",
                            side.won ? "text-carom-300" : "text-fog-600",
                          )}
                        >
                          {side.won ? "W" : ""}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[13px]",
                            side.won ? "font-bold text-fog-100" : "text-fog-300",
                          )}
                        >
                          {side.names.join(" / ")}
                        </span>
                        <span className="tnum font-display text-[13.5px] font-bold text-fog-100">
                          {side.points ?? "—"}P / {side.innings ?? "—"}
                        </span>
                        <span className="tnum w-14 text-right text-[12px] text-fog-400">
                          {average(side.average)}
                        </span>
                        <span className="tnum w-12 text-right text-[12px] text-fog-500">
                          HR {side.highRun ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {expanded &&
                    (innings && innings.rows.length > 0 ? (
                      <div className="border-t border-ink-800">
                        <div className="overflow-x-auto">
                          <table className="stat-table">
                            <thead>
                              <tr>
                                <th>Inning</th>
                                <th className="!text-left">Home 1P/2P</th>
                                <th>Score</th>
                                <th>Total</th>
                                <th className="!text-left">Away 1P/2P</th>
                                <th>Score</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {innings.rows.map((row) => {
                                const [home, away] = row.sides;
                                return (
                                  <tr key={row.inning}>
                                    <td className="tnum font-semibold text-fog-100">{row.inning}</td>
                                    <td className="!text-left tnum text-fog-300">
                                      {home ? `${home.onePoint}/${home.twoPoint}` : "—"}
                                    </td>
                                    <td className="tnum text-fog-300">{home?.score ?? "—"}</td>
                                    <td className="tnum font-bold text-carom-300">
                                      {home?.total ?? "—"}
                                    </td>
                                    <td className="!text-left tnum text-fog-300">
                                      {away ? `${away.onePoint}/${away.twoPoint}` : "—"}
                                    </td>
                                    <td className="tnum text-fog-300">{away?.score ?? "—"}</td>
                                    <td className="tnum font-bold text-gold-300">
                                      {away?.total ?? "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="border-t border-ink-800 px-4 py-2 text-[11px] text-fog-550">
                          Score is points in that inning; Total is the cumulative score.
                        </p>
                      </div>
                    ) : (
                      <p className="border-t border-ink-800 px-4 py-3 text-[12px] text-fog-450">
                        Per-inning detail publishes once the bout completes.
                      </p>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-[12px] text-fog-500">
          <Link
            href={`/teams/matches?season=${encodeURIComponent(season?.시즌코드 ?? "")}&round=${encodeURIComponent(roundCode)}`}
            className="font-semibold text-carom-300 underline-offset-2 hover:underline"
          >
            ← Back to round fixtures
          </Link>
          {selectedBout === null && selectedSet !== null
            ? " — this bout number has no record in the fixture."
            : ""}
        </p>
      </div>
    </>
  );
}
