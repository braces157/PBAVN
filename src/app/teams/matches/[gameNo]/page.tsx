import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamLeagueRounds, getTeamLeagueSeasons, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, getBoutInnings, getFixtureBouts } from "@/lib/pba/team-matches";
import { average } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, cn } from "@/components/ui/primitives";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ gameNo: string }>;
  searchParams: Promise<{ season?: string; round?: string; set?: string }>;
}

/** A fixture page needs the round that reconstructs its upstream request. */
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
    // A valid path segment is not a known fixture; anything else is a 404.
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

    // One bout's innings chain per render, and only for a bout upstream has
    // finished — a running set publishes no record sheet to request.
    const selectedBout =
      bouts && setParam !== null ? bouts.bouts.find((bout) => bout.setNo === setParam) : undefined;
    const innings =
      selectedBout?.tgCode != null ? await getBoutInnings(selectedBout.tgCode) : null;

    return {
      season,
      seasons,
      rounds,
      roundCode,
      bouts,
      setParam,
      selectedBout: selectedBout ?? null,
      innings,
      failures: getRequestFailures(),
    };
  });

  if (!loaded) notFound();
  const { season, seasons, rounds, roundCode, bouts, setParam: selectedSet, selectedBout, innings, failures } =
    loaded;

  const roundChips = [...rounds]
    .sort((a, b) => a.라운드 - b.라운드)
    .map((r) => ({
      value: String(r.라운드코드),
      label: `${r.포스트여부 === "Y" ? "PO " : ""}R${r.라운드}`,
    }));

  if (!bouts) {
    return (
      <>
        <PageHeader
          failures={failures}
          eyebrow="Team league"
          title={`No bout record for fixture No ${gameNo}`}
          description="The team terminal has no record under this fixture number for the selected round, or did not answer."
        >
          {season && roundChips.length > 0 && (
            <FilterRow
              label="Round"
              basePath={`/teams/matches/${gameNo}`}
              paramKey="round"
              active={roundCode}
              params={{ season: season.시즌코드 }}
              options={roundChips}
            />
          )}
        </PageHeader>
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <EmptyState
            title="Nothing published"
            description="Fixture numbers are assigned per round, so the same number exists in every round. Pick the round above, or head back to the fixtures list."
          />
        </div>
      </>
    );
  }

  const winnerName =
    bouts.winner === "home" ? bouts.homeName : bouts.winner === "away" ? bouts.awayName : null;

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Team league"
        title={`${bouts.homeName} vs ${bouts.awayName}`}
        description={`Fixture No ${gameNo}, ${bouts.bouts.length} bouts${
          winnerName ? `, won by ${winnerName}` : ", still in play"
        }.`}
      >
        {season && (
          <div className="flex flex-col gap-4">
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
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {/* -------------------------------------------------- score board */}
        <div className="surface p-5 sm:p-7">
          {/* Phone: one row per team, score on the right. A name squeezed
              beside a crest and a big score truncates into single letters. */}
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
              // An unparsed board leaves both names "", so the two fixed rows
              // are keyed by position instead.
              <div key={index} className="flex items-center gap-3">
                <TeamLogo src={side.logo} name={side.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate font-display text-[15px] font-bold",
                      side.won ? "text-lime-300" : "text-fog-100",
                    )}
                  >
                    {side.name || "—"}
                  </p>
                  {side.avg !== null && (
                    <p className="tnum mt-0.5 truncate text-[11px] text-fog-500">
                      AVG {side.avg.toFixed(3)} · HR {side.hr ?? "—"}
                    </p>
                  )}
                </div>
                {side.won && <Chip tone="lime">Winner</Chip>}
                <span
                  className={cn(
                    "tnum font-display text-3xl font-extrabold",
                    side.won ? "text-lime-400" : "text-fog-100",
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
                  <Chip tone="lime" className="mb-1.5 max-sm:hidden">
                    Winner
                  </Chip>
                )}
                <p
                  className={cn(
                    "truncate font-display text-[15px] font-bold sm:text-base",
                    bouts.winner === "home" ? "text-lime-300" : "text-fog-100",
                  )}
                >
                  {bouts.homeName || "—"}
                </p>
                {bouts.homeAverage !== null && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-500">
                    AVG {bouts.homeAverage.toFixed(3)} · HR {bouts.homeHighRun ?? "—"}
                  </p>
                )}
              </div>
              <TeamLogo src={bouts.homeLogo} name={bouts.homeName} size="lg" />
            </div>
            <div className="text-center">
              <p className="tnum font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
                <span className={bouts.winner === "home" ? "text-lime-400" : "text-fog-100"}>
                  {bouts.homeSets ?? "–"}
                </span>
                <span className="mx-1.5 align-middle text-[0.6em] font-bold text-ink-500">–</span>
                <span className={bouts.winner === "away" ? "text-lime-400" : "text-fog-100"}>
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
                  <Chip tone="lime" className="mb-1.5 max-sm:hidden">
                    Winner
                  </Chip>
                )}
                <p
                  className={cn(
                    "truncate font-display text-[15px] font-bold sm:text-base",
                    bouts.winner === "away" ? "text-lime-300" : "text-fog-100",
                  )}
                >
                  {bouts.awayName || "—"}
                </p>
                {bouts.awayAverage !== null && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-500">
                    AVG {bouts.awayAverage.toFixed(3)} · HR {bouts.awayHighRun ?? "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- bout list */}
        <ul className="mt-6 space-y-2.5">
          {bouts.bouts.map((bout) => {
            const expanded = selectedSet === bout.setNo;
            return (
              <li key={bout.setNo} id={`set-${bout.setNo}`} className="scroll-mt-32">
                <div className="surface p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink-800 pb-2.5">
                    <span className="font-display text-[13px] font-bold uppercase tracking-wide text-fog-100">
                      SET {bout.setNo}
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
                          expanded ? "text-lime-300" : "text-fog-400",
                        )}
                      >
                        Innings
                      </Link>
                    ) : (
                      <span className="text-[11px] text-fog-600">
                        No record sheet yet — the bout is still in play
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {bout.sides.map((side, index) => (
                      <div
                        key={`${bout.setNo}-${index}`}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                      >
                        <span
                          className={cn(
                            "w-6 shrink-0 text-center text-[11px] font-bold",
                            side.won ? "text-lime-400" : "text-fog-600",
                          )}
                        >
                          {side.won ? "W" : ""}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[13px]",
                            side.won ? "font-semibold text-fog-100" : "text-fog-300",
                          )}
                        >
                          {side.names.join(" / ")}
                        </span>
                        <span className="tnum font-display text-[14px] font-bold text-fog-100">
                          {side.points ?? "—"}P / {side.innings ?? "—"}
                        </span>
                        <span className="tnum w-16 text-right text-[12px] text-fog-400">
                          {average(side.average)}
                        </span>
                        <span className="tnum w-14 text-right text-[12px] text-fog-500">
                          HR {side.highRun ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {expanded &&
                    (innings && innings.rows.length > 0 ? (
                      <div className="mt-4 overflow-x-auto rounded-[12px] border border-ink-750">
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
                                  <td className="tnum font-semibold text-fog-100">
                                    {home?.total ?? "—"}
                                  </td>
                                  <td className="!text-left tnum text-fog-300">
                                    {away ? `${away.onePoint}/${away.twoPoint}` : "—"}
                                  </td>
                                  <td className="tnum text-fog-300">{away?.score ?? "—"}</td>
                                  <td className="tnum font-semibold text-fog-100">
                                    {away?.total ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="border-t border-ink-800 px-4 py-2 text-[11px] leading-relaxed text-fog-600">
                          Score is the inning&apos;s own points; Total runs through the bout. A dash
                          means that side had stopped playing.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[12px] border border-ink-800 px-4 py-3 text-[12px] leading-relaxed text-fog-500">
                        No per-inning record for this bout yet. Upstream publishes the record sheet
                        once the bout has finished.
                      </p>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[11.5px] leading-relaxed text-fog-600">
          <Link
            href={`/teams/matches?season=${encodeURIComponent(season?.시즌코드 ?? "")}&round=${encodeURIComponent(roundCode)}`}
            className="text-fog-400 underline-offset-2 hover:underline"
          >
            Back to the round&apos;s fixtures
          </Link>
          {selectedBout === null && selectedSet !== null
            ? " — this bout number has no record in the fixture."
            : ""}
        </p>
      </div>
    </>
  );
}
