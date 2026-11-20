import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamLeagueRounds, getTeamLeagueSeasons, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import {
  getPlayerNameIndex,
  getTeamBoard,
  resolveOfficialTeamPlayer,
  resolvePlayerCode,
} from "@/lib/pba/service";
import {
  FIXTURES_ARCHIVE_TTL,
  FIXTURES_IN_PLAY_TTL,
  getBoutInnings,
  getFixtureBouts,
  getRoundFixtures,
} from "@/lib/pba/team-matches";
import { normalizeTeam, normalizeTeamPlayer } from "@/lib/normalize";
import {
  extractClubCodeFromLogo,
  matchRosterPlayer,
  matchTeamByNameOrLogo,
  type RosterEntry,
} from "@/lib/team-links";
import { FilterRow } from "@/components/domain/filter-bar";
import { FixtureList, type FixtureClub } from "@/components/domain/fixture-list";
import { TeamBoutList, type ResolvedBoutPlayer } from "@/components/domain/team-bout-list";
import { DataStatus } from "@/components/site/data-status";
import { TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, SectionHeading, TextLink, cn } from "@/components/ui/primitives";

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
    const ttl = inProgress ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL;

    const [bouts, board, roundFixtures] = await Promise.all([
      getFixtureBouts(roundCode, selectedRound.라운드, gameNo, ttl),
      getTeamBoard(season.시즌코드, String(season.리그코드), roundCode),
      getRoundFixtures(roundCode, selectedRound.라운드, ttl),
    ]);

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
      board,
      roundFixtures,
      setParam,
      selectedBout: selectedBout ?? null,
      innings,
      failures: getRequestFailures(),
    };
  });

  if (!loaded) notFound();
  const {
    season,
    seasons,
    rounds,
    selectedRound,
    roundCode,
    bouts,
    board,
    roundFixtures,
    setParam: selectedSet,
    selectedBout,
    innings,
    failures,
  } = loaded;

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

  const standings = board.standings.map(normalizeTeam);
  const nameIndex = getPlayerNameIndex();
  const allTeamPlayers = board.players
    .map(normalizeTeamPlayer)
    .map((p) => resolveOfficialTeamPlayer(p, nameIndex));

  const homeTeam = matchTeamByNameOrLogo(standings, bouts.homeName, bouts.homeLogo);
  const awayTeam = matchTeamByNameOrLogo(standings, bouts.awayName, bouts.awayLogo);
  const homeCode = homeTeam?.code ?? extractClubCodeFromLogo(bouts.homeLogo);
  const awayCode = awayTeam?.code ?? extractClubCodeFromLogo(bouts.awayLogo);

  const teamHref = (code: string | null) =>
    code
      ? `/teams/${encodeURIComponent(code)}?season=${encodeURIComponent(season.시즌코드)}&round=${encodeURIComponent(roundCode)}`
      : null;

  const homeHref = teamHref(homeCode);
  const awayHref = teamHref(awayCode);

  const toRoster = (list: typeof allTeamPlayers): RosterEntry[] =>
    list
      .filter((p) => Boolean(p.code))
      .map((p) => ({
        code: p.code,
        name: p.name,
        nameEn: p.nameEn,
        rawKo: p.raw.이름 || p.raw.외국이름,
        average: p.average,
        winRate: p.winRate,
        highRun: p.highRun,
      }));

  const homeRoster = homeCode ? toRoster(allTeamPlayers.filter((p) => p.teamCode === homeCode)) : [];
  const awayRoster = awayCode ? toRoster(allTeamPlayers.filter((p) => p.teamCode === awayCode)) : [];
  const fullRoster = toRoster(allTeamPlayers);

  const playerMap: Record<string, ResolvedBoutPlayer> = {};
  for (const bout of bouts.bouts) {
    bout.sides.forEach((side, sideIndex) => {
      const sideRoster = sideIndex === 0 ? homeRoster : awayRoster;
      for (const rawName of side.names) {
        const key = `${sideIndex}:${rawName}`;
        if (playerMap[key]) continue;
        const matched =
          matchRosterPlayer(rawName, sideRoster) ?? matchRosterPlayer(rawName, fullRoster);
        if (matched) {
          playerMap[key] = {
            code: matched.code,
            name: matched.name,
            average: matched.average,
            winRate: matched.winRate,
          };
        } else {
          const fallbackCode = resolvePlayerCode(rawName);
          if (fallbackCode) {
            playerMap[key] = { code: fallbackCode, name: rawName };
          }
        }
      }
    });
  }

  const clubs = new Map<string, FixtureClub>();
  for (const team of standings) {
    clubs.set(team.code, { name: team.name, logo: team.logo });
  }
  const siblingFixtures = roundFixtures
    .filter((f) => f.gameNo && f.gameNo !== gameNo)
    .slice(0, 6);

  const homeDisplayName = homeTeam?.name || bouts.homeName || "—";
  const awayDisplayName = awayTeam?.name || bouts.awayName || "—";

  const totalHomePoints = bouts.bouts.reduce((sum, b) => sum + (b.sides[0]?.points ?? 0), 0);
  const totalAwayPoints = bouts.bouts.reduce((sum, b) => sum + (b.sides[1]?.points ?? 0), 0);
  const totalInnings = bouts.bouts.reduce(
    (sum, b) => sum + Math.max(b.sides[0]?.innings ?? 0, b.sides[1]?.innings ?? 0),
    0,
  );

  return (
    <>
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto max-w-[1300px] px-3 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-fog-500">
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
              <Link href="/teams" className="hover:text-carom-300">Team League</Link>
              <span className="text-ink-600">/</span>
              <Link
                href={`/teams/matches?season=${encodeURIComponent(season.시즌코드)}&round=${encodeURIComponent(roundCode)}`}
                className="hover:text-carom-300"
              >
                Round {selectedRound.라운드} Fixtures
              </Link>
              <span className="text-ink-600">/</span>
              <span className="tnum text-fog-300">Fixture #{gameNo}</span>
            </nav>
            <span className="tnum text-[11px] text-fog-450">
              {bouts.bouts.length} sets · {totalHomePoints}–{totalAwayPoints} pts
              {totalInnings > 0 ? ` · ${totalInnings} inn` : ""}
              {bouts.winner ? "" : " · in play"}
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
                name: homeDisplayName,
                logo: homeTeam?.logo ?? bouts.homeLogo,
                href: homeHref,
                team: homeTeam,
                avg: bouts.homeAverage,
                hr: bouts.homeHighRun,
                sets: bouts.homeSets,
                won: bouts.winner === "home",
              },
              {
                name: awayDisplayName,
                logo: awayTeam?.logo ?? bouts.awayLogo,
                href: awayHref,
                team: awayTeam,
                avg: bouts.awayAverage,
                hr: bouts.awayHighRun,
                sets: bouts.awaySets,
                won: bouts.winner === "away",
              },
            ] as const).map((side, index) => {
              const clubContent = (
                <>
                  <TeamLogo src={side.logo} name={side.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate font-display text-[15px] font-bold transition-colors",
                        side.won ? "text-carom-300" : "text-fog-100",
                        side.href && "group-hover:text-carom-300 group-hover:underline",
                      )}
                    >
                      {side.name}
                    </p>
                    <p className="tnum mt-0.5 truncate text-[11px] text-fog-450">
                      {side.avg !== null && <>AVG {side.avg.toFixed(3)} · HR {side.hr ?? "—"}</>}
                      {side.team && (
                        <>
                          {side.avg !== null ? " · " : ""}#{side.team.rank} ({side.team.wins}W–{side.team.losses}L)
                        </>
                      )}
                    </p>
                  </div>
                </>
              );
              return (
                <div key={index} className="flex items-center gap-3">
                  {side.href ? (
                    <Link href={side.href} className="group flex min-w-0 flex-1 items-center gap-3">
                      {clubContent}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">{clubContent}</div>
                  )}
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
              );
            })}
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
                {homeHref ? (
                  <Link
                    href={homeHref}
                    className={cn(
                      "block truncate font-display text-[17px] font-bold underline-offset-2 transition-colors hover:text-carom-300 hover:underline",
                      bouts.winner === "home" ? "text-carom-300" : "text-fog-100",
                    )}
                  >
                    {homeDisplayName}
                  </Link>
                ) : (
                  <p
                    className={cn(
                      "truncate font-display text-[17px] font-bold",
                      bouts.winner === "home" ? "text-carom-300" : "text-fog-100",
                    )}
                  >
                    {homeDisplayName}
                  </p>
                )}
                {bouts.homeAverage !== null && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-450">
                    AVG {bouts.homeAverage.toFixed(3)} · HR {bouts.homeHighRun ?? "—"} · {totalHomePoints} pts
                  </p>
                )}
                {homeTeam && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-500">
                    Round #{homeTeam.rank} · {homeTeam.wins}W–{homeTeam.losses}L · {homeTeam.points} pts
                  </p>
                )}
              </div>
              {homeHref ? (
                <Link href={homeHref} className="shrink-0 transition-opacity hover:opacity-85" aria-label={`Open ${homeDisplayName}`}>
                  <TeamLogo src={homeTeam?.logo ?? bouts.homeLogo} name={homeDisplayName} size="lg" />
                </Link>
              ) : (
                <TeamLogo src={homeTeam?.logo ?? bouts.homeLogo} name={homeDisplayName} size="lg" />
              )}
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
              {awayHref ? (
                <Link href={awayHref} className="shrink-0 transition-opacity hover:opacity-85" aria-label={`Open ${awayDisplayName}`}>
                  <TeamLogo src={awayTeam?.logo ?? bouts.awayLogo} name={awayDisplayName} size="lg" />
                </Link>
              ) : (
                <TeamLogo src={awayTeam?.logo ?? bouts.awayLogo} name={awayDisplayName} size="lg" />
              )}
              <div className="min-w-0">
                {bouts.winner === "away" && (
                  <Chip tone="carom" className="mb-1">
                    Winner
                  </Chip>
                )}
                {awayHref ? (
                  <Link
                    href={awayHref}
                    className={cn(
                      "block truncate font-display text-[17px] font-bold underline-offset-2 transition-colors hover:text-carom-300 hover:underline",
                      bouts.winner === "away" ? "text-carom-300" : "text-fog-100",
                    )}
                  >
                    {awayDisplayName}
                  </Link>
                ) : (
                  <p
                    className={cn(
                      "truncate font-display text-[17px] font-bold",
                      bouts.winner === "away" ? "text-carom-300" : "text-fog-100",
                    )}
                  >
                    {awayDisplayName}
                  </p>
                )}
                {bouts.awayAverage !== null && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-450">
                    AVG {bouts.awayAverage.toFixed(3)} · HR {bouts.awayHighRun ?? "—"} · {totalAwayPoints} pts
                  </p>
                )}
                {awayTeam && (
                  <p className="tnum mt-0.5 truncate text-[11px] text-fog-500">
                    Round #{awayTeam.rank} · {awayTeam.wins}W–{awayTeam.losses}L · {awayTeam.points} pts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11.5px] text-fog-500">
          Click any set to open its inning-by-inning scorecard, or click any player or club name to view full stats.
        </p>

        <TeamBoutList
          bouts={bouts.bouts}
          gameNo={gameNo}
          seasonCode={season?.시즌코드 ?? ""}
          roundCode={roundCode}
          initialSet={selectedSet}
          initialInnings={innings}
          homeTeamName={homeTeam?.shortName || bouts.homeName}
          awayTeamName={awayTeam?.shortName || bouts.awayName}
          playerMap={playerMap}
        />

        {siblingFixtures.length > 0 && (
          <section className="mt-10">
            <SectionHeading
              eyebrow={`Round ${selectedRound.라운드}`}
              title="Other Fixtures in This Round"
              action={
                <TextLink
                  href={`/teams/matches?season=${encodeURIComponent(season.시즌코드)}&round=${encodeURIComponent(roundCode)}`}
                >
                  All fixtures
                </TextLink>
              }
            />
            <div className="mt-4">
              <FixtureList
                fixtures={siblingFixtures}
                clubs={clubs}
                season={season.시즌코드}
                round={roundCode}
              />
            </div>
          </section>
        )}

        <p className="mt-6 text-[12px] text-fog-500">
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
