import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTeamLeagueRounds,
  getTeamLeagueSeasons,
  getTeamMatchMatrix,
  getTeamPlayerStats,
  getTeamStandings,
  trackFailures,
} from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import {
  FIXTURES_ARCHIVE_TTL,
  FIXTURES_IN_PLAY_TTL,
  getBoutInnings,
  getFixtureBouts,
  getRoundFixtures,
} from "@/lib/pba/team-matches";
import { englishVenue } from "@/lib/pba/service";
import {
  matchMatrix,
  normalizeTeam,
  normalizeTeamPlayer,
  type HeadToHeadCell,
  type TeamPlayer,
  type TeamStanding,
} from "@/lib/normalize";
import { average, clockLabel, fmtDate } from "@/lib/format";
import { DataStatus } from "@/components/site/data-status";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { PlayerAvatar, TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, TextLink, cn } from "@/components/ui/primitives";

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
    const ttl = inProgress ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL;

    // The bout record is the only thing the fixture endpoint itself publishes —
    // nothing at all before the first serve. Everything a reader wants in the
    // meantime (kickoff, standings, form, who takes the table) lives on the
    // season feeds, so they ride along in the same parallel batch. All four are
    // cached reads shared with the teams pages.
    const [bouts, fixtures, standingsRaw, playersRaw, matrixRaw] = await Promise.all([
      getFixtureBouts(roundCode, selectedRound.라운드, gameNo, ttl),
      getRoundFixtures(roundCode, selectedRound.라운드, ttl),
      getTeamStandings({
        seasonCode: season.시즌코드,
        leagueCode: String(season.리그코드),
        roundCode,
      }),
      getTeamPlayerStats({
        seasonCode: season.시즌코드,
        leagueCode: String(season.리그코드),
        roundCode,
      }),
      getTeamMatchMatrix({
        seasonCode: season.시즌코드,
        leagueCode: String(season.리그코드),
        roundCode,
      }),
    ]);

    // One bout's innings chain per render, and only for a bout upstream has
    // finished — a running set publishes no record sheet to request.
    const selectedBout =
      bouts && setParam !== null ? bouts.bouts.find((bout) => bout.setNo === setParam) : undefined;
    const innings =
      selectedBout?.tgCode != null ? await getBoutInnings(selectedBout.tgCode) : null;

    // The fixtures list is the join key between the bout page's club names and
    // the standings' codes: it carries the same TeamGameNO and both club codes.
    const fixtureInfo = fixtures.find((fixture) => fixture.gameNo === gameNo) ?? null;
    const standings = standingsRaw.map(normalizeTeam);
    const homeCode = fixtureInfo?.home.clubCode ?? null;
    const awayCode = fixtureInfo?.away.clubCode ?? null;
    const homeRow = (homeCode && standings.find((team) => team.code === homeCode)) || null;
    const awayRow = (awayCode && standings.find((team) => team.code === awayCode)) || null;

    const players = playersRaw.map(normalizeTeamPlayer);
    const homeSquad = homeCode ? players.filter((player) => player.teamCode === homeCode) : [];
    const awaySquad = awayCode ? players.filter((player) => player.teamCode === awayCode) : [];

    // The matrix aggregates both directions of a pairing under the sorted code
    // pair; `wins` belongs to whichever code sorts first.
    const pair = [homeCode, awayCode].filter((code): code is string => Boolean(code)).sort();
    const h2hCell = pair.length === 2 ? (matchMatrix(matrixRaw).get(pair.join("|")) ?? null) : null;
    const h2hFirstCode = pair[0] ?? null;

    return {
      season,
      seasons,
      rounds,
      roundCode,
      bouts,
      setParam,
      selectedBout: selectedBout ?? null,
      innings,
      venue: selectedRound.경기장소 ? englishVenue(selectedRound.경기장소) : null,
      fixtureInfo,
      homeCode,
      awayCode,
      homeRow,
      awayRow,
      homeSquad,
      awaySquad,
      h2hCell,
      h2hFirstCode,
      failures: getRequestFailures(),
    };
  });

  if (!loaded) notFound();
  const {
    season,
    seasons,
    rounds,
    roundCode,
    bouts,
    setParam: selectedSet,
    selectedBout,
    innings,
    venue,
    fixtureInfo,
    homeCode,
    awayCode,
    homeRow,
    awayRow,
    homeSquad,
    awaySquad,
    h2hCell,
    h2hFirstCode,
    failures,
  } = loaded;

  const roundChips = [...rounds]
    .sort((a, b) => a.라운드 - b.라운드)
    .map((r) => ({
      value: String(r.라운드코드),
      label: `${r.포스트여부 === "Y" ? "PO " : ""}R${r.라운드}`,
    }));

  if (!bouts) {
    if (fixtureInfo) {
      const date = fixtureInfo.playedAt?.slice(0, 10) ?? null;
      const time = clockLabel(fixtureInfo.playedAt);
      return <>
        <PageHeader failures={failures} eyebrow="Team league" title={`${fixtureInfo.home.name} vs ${fixtureInfo.away.name}`} description="The detailed scorecard is unavailable. The fixture and round statistics are shown below." />
        <div className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-10">
          <MatchPreview seasonCode={season.시즌코드} roundCode={roundCode} notStarted={!fixtureInfo.played} kickoffDate={date} kickoffTime={time} venue={venue} homeRow={homeRow} awayRow={awayRow} homeCode={homeCode} awayCode={awayCode} homeSquad={homeSquad} awaySquad={awaySquad} h2hCell={h2hCell} h2hFirstCode={h2hFirstCode} />
          <div className="mt-5"><TextLink href={`/teams/matches?season=${season.시즌코드}&round=${roundCode}`}>Back to round fixtures</TextLink></div>
        </div>
      </>;
    }
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
  const kickoffDate = fixtureInfo?.playedAt ? fixtureInfo.playedAt.slice(0, 10) : null;
  const kickoffTime = clockLabel(fixtureInfo?.playedAt ?? null);
  const hasPlay = bouts.bouts.some((bout) => bout.sides.some((side) => (side.innings ?? 0) > 0 || (side.points ?? 0) > 0)) || (bouts.homeSets ?? 0) > 0 || (bouts.awaySets ?? 0) > 0;
  const notStarted = Boolean(fixtureInfo && !fixtureInfo.played && !winnerName && !hasPlay);
  const startedLabel = winnerName
    ? `, won by ${winnerName}`
    : notStarted
      ? ", not started yet"
      : ", still in play";

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-10">
        <DataStatus failures={failures} />
        <p className="text-xs font-semibold uppercase tracking-wide text-fog-400">Team league · Fixture {gameNo}</p>
        <h1 className="mt-1 font-display text-xl font-bold text-fog-100">Match centre</h1>
        <p className="mt-1 text-xs text-fog-400">{bouts.bouts.length} bouts{startedLabel}.</p>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 sm:px-6 lg:px-10">
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
                  {/* Upstream publishes literal zeros before the first serve;
                      a dash is the honest score of a match not played. */}
                  {notStarted ? "–" : (side.sets ?? "–")}
                </span>
              </div>
            ))}
            {!bouts.winner &&
              (notStarted ? (
                <div className="flex justify-center pt-1">
                  <Chip tone="neutral">
                    Starts {kickoffDate ? fmtDate(kickoffDate) : "—"}
                    {kickoffTime ? ` · ${kickoffTime} KST` : ""}
                  </Chip>
                </div>
              ) : (
                <div className="flex justify-center pt-1">
                  <LiveChip label="In play" />
                </div>
              ))}
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
                  {notStarted ? "–" : (bouts.homeSets ?? "–")}
                </span>
                <span className="mx-1.5 align-middle text-[0.6em] font-bold text-ink-500">–</span>
                <span className={bouts.winner === "away" ? "text-lime-400" : "text-fog-100"}>
                  {notStarted ? "–" : (bouts.awaySets ?? "–")}
                </span>
              </p>
              {!bouts.winner && (
                <div className="mt-2">
                  {notStarted ? (
                    <Chip tone="neutral">
                      Starts {kickoffDate ? fmtDate(kickoffDate) : "—"}
                      {kickoffTime ? ` · ${kickoffTime} KST` : ""}
                    </Chip>
                  ) : (
                    <LiveChip label="In play" />
                  )}
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

        <details className="mt-4 rounded-lg border border-ink-750 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-fog-300">Browse another season or round</summary>
          <div className="pt-4">
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
          </div>
        </details>

        {/* ------------------------------------------------- match preview
            Before the first serve the fixture endpoint publishes two club
            names and nothing else. Everything a reader actually wants — when
            it starts, where both clubs stand, who is likely to take the table
            — comes from the season feeds and renders here. */}
        {!bouts.winner && (
          <MatchPreview
            seasonCode={season.시즌코드}
            roundCode={roundCode}
            notStarted={notStarted}
            kickoffDate={kickoffDate}
            kickoffTime={kickoffTime}
            venue={venue}
            homeRow={homeRow}
            awayRow={awayRow}
            homeCode={homeCode}
            awayCode={awayCode}
            homeSquad={homeSquad}
            awaySquad={awaySquad}
            h2hCell={h2hCell}
            h2hFirstCode={h2hFirstCode}
          />
        )}

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
                    {bout.sides.map((side, index) => {
                      const unplayed = side.points === null && side.innings === null;
                      return (
                        <div key={`${bout.setNo}-${index}`}>
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
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
                          {/* An announced line-up with no score yet is the
                              reader's only hook: season figures for each named
                              player turn a bare list of names into something
                              to weigh. */}
                          {unplayed &&
                            side.names.map((name) => {
                              const player = lookupPlayer(name, [...homeSquad, ...awaySquad]);
                              if (!player) return null;
                              return (
                                <p
                                  key={`${bout.setNo}-${index}-${name}`}
                                  className="pl-9 text-[10.5px] text-fog-550"
                                >
                                  {name} — season AVG{" "}
                                  <span className="tnum text-fog-400">{player.average.toFixed(3)}</span> · HR{" "}
                                  <span className="tnum text-fog-400">{player.highRun || "—"}</span> ·{" "}
                                  <span className="tnum text-fog-400">
                                    {player.singlesWins}–{player.singlesLosses}
                                  </span>{" "}
                                  in singles
                                </p>
                              );
                            })}
                        </div>
                      );
                    })}
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
                          Score is the inning's own points; Total runs through the bout. A dash
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
            Back to the round's fixtures
          </Link>
          {selectedBout === null && selectedSet !== null
            ? " — this bout number has no record in the fixture."
            : ""}
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ preview */

/**
 * The context the fixture endpoint does not publish.
 *
 * Before the first serve the bout record is two club names, so this panel
 * carries everything a reader weighs instead: when and where the fixture
 * starts, where both clubs stand after the rounds played so far, their
 * meetings this season, and the players most likely to take the table. Every
 * read behind it is a cached season feed shared with the other team pages.
 */
function MatchPreview({
  seasonCode,
  roundCode,
  notStarted,
  kickoffDate,
  kickoffTime,
  venue,
  homeRow,
  awayRow,
  homeCode,
  awayCode,
  homeSquad,
  awaySquad,
  h2hCell,
  h2hFirstCode,
}: {
  seasonCode: string;
  roundCode: string;
  notStarted: boolean;
  kickoffDate: string | null;
  kickoffTime: string | null;
  venue: string | null;
  homeRow: TeamStanding | null;
  awayRow: TeamStanding | null;
  homeCode: string | null;
  awayCode: string | null;
  homeSquad: TeamPlayer[];
  awaySquad: TeamPlayer[];
  h2hCell: HeadToHeadCell | null;
  h2hFirstCode: string | null;
}) {
  // `wins` in a matrix cell belongs to whichever club code sorts first.
  const homeFirst = homeCode != null && homeCode === h2hFirstCode;
  const h2hHome = h2hCell ? (homeFirst ? h2hCell.wins : h2hCell.losses) : null;
  const h2hAway = h2hCell ? (homeFirst ? h2hCell.losses : h2hCell.wins) : null;

  return (
    <section className="mt-6">
      <div className="surface overflow-hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-800 px-4 py-2.5">
          <h2 className="font-display text-[12.5px] font-bold uppercase tracking-[0.09em] text-fog-100">
            {notStarted ? "Match preview" : "Where things stand"}
          </h2>
          <p className="tnum text-[11px] text-fog-500">
            {notStarted && kickoffDate
              ? `Starts ${fmtDate(kickoffDate)}${kickoffTime ? ` · ${kickoffTime} KST` : ""}${venue ? ` · ${venue}` : ""}`
              : venue
                ? venue
                : null}
          </p>
        </header>

        <div className="grid gap-px bg-ink-800 sm:grid-cols-2">
          <PreviewSide row={homeRow} code={homeCode} squad={homeSquad} align="left" seasonCode={seasonCode} roundCode={roundCode} />
          <PreviewSide row={awayRow} code={awayCode} squad={awaySquad} align="right" seasonCode={seasonCode} roundCode={roundCode} />
        </div>

        {h2hCell && h2hCell.played > 0 && h2hHome !== null && h2hAway !== null && (
          <p className="border-t border-ink-800 px-4 py-2 text-[11.5px] text-fog-500">
            <span className="micro-label mr-2">This season</span>
            <span className="tnum">
              {h2hCell.played} {h2hCell.played === 1 ? "meeting" : "meetings"} ·{" "}
              {h2hHome}–{h2hAway} in fixtures
              {h2hCell.draws > 0 ? ` (${h2hCell.draws} drawn)` : ""} · sets{" "}
              {(homeFirst ? h2hCell.setWins : h2hCell.setLosses)}–
              {(homeFirst ? h2hCell.setLosses : h2hCell.setWins)}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

/** One club's season figures and the players likeliest to take the table. */
function PreviewSide({
  seasonCode,
  roundCode,
  row,
  code,
  squad,
  align,
}: {
  seasonCode: string;
  roundCode: string;
  row: TeamStanding | null;
  code: string | null;
  squad: TeamPlayer[];
  align: "left" | "right";
}) {
  // The player feed publishes no per-player match count (the team feed's
  // `matches` normalizes to 0 for everyone), so "has actually played" reads
  // off the set count.
  const watch = squad
    .filter((player) => player.sets > 0)
    .sort((a, b) => b.average - a.average)
    .slice(0, 3);

  return (
    <div className="bg-ink-900 px-4 py-3">
      {row ? (
        <>
          <div
            className={cn(
              "flex items-center gap-2.5",
              align === "right" && "sm:flex-row-reverse sm:text-right",
            )}
          >
            <TeamLogo src={row.logo} name={row.name} size="sm" />
            <div className="min-w-0">
              <Link
                href={`/teams/${encodeURIComponent(row.code)}?season=${encodeURIComponent(seasonCode)}&round=${encodeURIComponent(roundCode)}`}
                className="block truncate text-[13px] font-semibold text-fog-100 transition-colors hover:text-lime-300"
              >
                {row.name}
              </Link>
              <p className="tnum text-[10.5px] text-fog-550">
                #{row.rank || "—"} of the round · {row.matches} played
              </p>
            </div>
          </div>
          <dl
            className={cn(
              "mt-2.5 grid grid-cols-4 gap-2",
              align === "right" && "sm:text-right",
            )}
          >
            <div>
              <dt className="micro-label">Record</dt>
              <dd className="tnum mt-0.5 text-[12px] font-semibold text-fog-100">
                {row.wins}–{row.losses}
                {row.draws > 0 ? `–${row.draws}` : ""}
              </dd>
            </div>
            <div>
              <dt className="micro-label">Sets</dt>
              <dd className="tnum mt-0.5 text-[12px] text-fog-200">
                {row.setWins}–{row.setLosses}
              </dd>
            </div>
            <div>
              <dt className="micro-label">Points</dt>
              <dd className="tnum mt-0.5 text-[12px] text-fog-200">{row.points}</dd>
            </div>
            <div>
              <dt className="micro-label">Team AVG</dt>
              <dd className="tnum mt-0.5 text-[12px] text-fog-200">
                {row.average ? row.average.toFixed(3) : "—"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="text-[12px] text-fog-500">
          The round's standings did not answer, so this club's form is unknown.
        </p>
      )}

      <p className="micro-label mt-3.5">Ones to watch</p>
      {watch.length > 0 ? (
        <ul className="mt-1.5 space-y-1.5">
          {watch.map((player) => (
            <li key={player.code} className="flex items-center gap-2.5">
              <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-fog-200">
                {player.name}
              </span>
              <span className="tnum shrink-0 text-[10.5px] text-fog-550">
                {player.singlesWins}–{player.singlesLosses}
              </span>
              <span className="tnum w-12 shrink-0 text-right font-display text-[12px] font-bold text-fog-100">
                {player.average.toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11px] text-fog-600">
          {code ? "No season figures for this club's roster yet." : "Roster unknown — the fixture did not name its clubs."}
        </p>
      )}
    </div>
  );
}

/**
 * Match a terminal-published player name to the season roster.
 *
 * The two feeds spell names differently enough to need three passes: exact on
 * either script, exact without the display initial ("Q.응우옌"), then a suffix
 * walk — a name the roster carries in longer form still matches.
 */
function lookupPlayer(name: string, squad: TeamPlayer[]): TeamPlayer | null {
  const raw = name.trim();
  if (!raw) return null;

  const byName = new Map<string, TeamPlayer>();
  for (const player of squad) {
    for (const key of [player.name, player.nameEn]) {
      const trimmed = (key ?? "").trim();
      if (trimmed && !byName.has(trimmed)) byName.set(trimmed, player);
    }
  }

  const direct = byName.get(raw);
  if (direct) return direct;

  const stripped = raw.replace(/^[A-Za-z가-힣]\.\s*/, "").trim();
  if (stripped && stripped !== raw) {
    const initialled = byName.get(stripped);
    if (initialled) return initialled;
  }

  const needle = stripped || raw;
  for (const [key, player] of byName) {
    if (key.endsWith(needle) || needle.endsWith(key)) return player;
  }
  return null;
}
