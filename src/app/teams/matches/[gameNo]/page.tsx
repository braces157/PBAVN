import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
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
import { ArrowLeft } from "lucide-react";
import { TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, SectionHeading, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ gameNo: string }>;
  searchParams: Promise<{ season?: string; round?: string; set?: string }>;
}

const GAME_NO = /^\d{1,4}$/;
const SET = /^\d{1,2}$/;

const loadFixture = cache(async (gameNo: string, seasonParam?: string, roundParam?: string, setRaw?: string) => {
  const setParam = SET.test(setRaw ?? "") ? Number(setRaw) : null;
  return trackFailures(async () => {
    if (!GAME_NO.test(gameNo)) return null;

    const seasons = await getTeamLeagueSeasons();
    const season = seasons.find((s) => s.시즌코드 === seasonParam) ?? seasons[0] ?? null;
    if (!season) return null;

    const rounds = await getTeamLeagueRounds(season.리그코드);
    const selectedRound =
      rounds.find((r) => String(r.라운드코드) === roundParam) ??
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
});

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ gameNo }, search] = await Promise.all([params, searchParams]);
  if (!GAME_NO.test(gameNo)) return { title: "Fixture not found" };
  const loaded = await loadFixture(gameNo, search.season, search.round, search.set);
  const bouts = loaded?.bouts;
  const title = bouts
    ? `${bouts.homeName} vs ${bouts.awayName}${bouts.homeSets !== null && bouts.awaySets !== null ? ` (${bouts.homeSets}–${bouts.awaySets})` : ""} — Team League`
    : `Fixture No ${gameNo}`;
  const description = bouts
    ? `Set-by-set bouts and per-inning records for ${bouts.homeName} vs ${bouts.awayName} in the PBA Team League.`
    : "Set-by-set bouts of one PBA Team League fixture, with per-inning records.";
  const canonical = loaded
    ? `/teams/matches/${gameNo}?season=${encodeURIComponent(loaded.season.시즌코드)}&round=${encodeURIComponent(loaded.roundCode)}`
    : `/teams/matches/${gameNo}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function FixturePage({ params, searchParams }: PageProps) {
  const [{ gameNo }, search] = await Promise.all([params, searchParams]);
  const loaded = await loadFixture(gameNo, search.season, search.round, search.set);

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
      <div className="wrap py-5">
        <h1 className="sr-only">Fixture No {gameNo}</h1>
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/teams" className="hover:text-foreground">Team League</Link>
          <span className="text-border">/</span>
          <Link href={`/teams/matches?season=${season.시즌코드}&round=${roundCode}`} className="hover:text-foreground">
            Fixtures
          </Link>
          <span className="text-border">/</span>
          <span className="text-foreground">No {gameNo}</span>
        </nav>
        <div className="mb-5 flex flex-col gap-2">
          <FilterRow
            label="Season"
            basePath={`/teams/matches/${gameNo}`}
            paramKey="season"
            active={season.시즌코드}
            params={{}}
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
      <header className="border-b border-border bg-card">
        <div className="wrap py-4">
          <h1 className="sr-only">
            {bouts.homeName} vs {bouts.awayName} — Round {selectedRound.라운드} Fixture #{gameNo}
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
              <Link href="/teams" className="hover:text-foreground">Team League</Link>
              <span className="text-border">/</span>
              <Link
                href={`/teams/matches?season=${encodeURIComponent(season.시즌코드)}&round=${encodeURIComponent(roundCode)}`}
                className="hover:text-foreground"
              >
                Round {selectedRound.라운드} Fixtures
              </Link>
              <span className="text-border">/</span>
              <span className="font-mono tabular-nums text-foreground">Fixture #{gameNo}</span>
            </nav>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {bouts.bouts.length} sets · {totalHomePoints}–{totalAwayPoints} pts
              {totalInnings > 0 ? ` · ${totalInnings} inn` : ""}
              {bouts.winner ? "" : " · in play"}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <FilterRow
              label="Season"
              basePath="/teams/matches"
              paramKey="season"
              active={season.시즌코드}
              params={{}}
              options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
            />
            {roundChips.length > 0 && (
              <FilterRow
                label="Round"
                basePath="/teams/matches"
                paramKey="round"
                active={roundCode}
                params={{ season: season.시즌코드 }}
                options={roundChips}
              />
            )}
          </div>
          <DataStatus failures={failures} />
        </div>
      </header>

      <div className="wrap py-6">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
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
                        "truncate text-base font-semibold transition-colors",
                        side.won ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                        side.href && "group-hover:underline",
                      )}
                    >
                      {side.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
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
                    <Link href={side.href} className="group flex min-w-0 flex-1 items-center gap-3 hover:no-underline">
                      {clubContent}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">{clubContent}</div>
                  )}
                  {side.won && <Chip tone="carom">W</Chip>}
                  <span
                    className={cn(
                      "font-mono text-3xl font-semibold tabular-nums",
                      side.won ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
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
                      "block truncate text-lg font-semibold underline-offset-2 transition-colors hover:underline",
                      bouts.winner === "home" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {homeDisplayName}
                  </Link>
                ) : (
                  <p
                    className={cn(
                      "truncate text-lg font-semibold",
                      bouts.winner === "home" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {homeDisplayName}
                  </p>
                )}
                {bouts.homeAverage !== null && (
                  <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
                    AVG {bouts.homeAverage.toFixed(3)} · HR {bouts.homeHighRun ?? "—"} · {totalHomePoints} pts
                  </p>
                )}
                {homeTeam && (
                  <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
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
              <p className="font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl">
                <span className={bouts.winner === "home" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
                  {bouts.homeSets ?? "–"}
                </span>
                <span className="mx-1.5 align-middle text-[0.6em] font-medium text-muted-foreground">–</span>
                <span className={bouts.winner === "away" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
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
                      "block truncate text-lg font-semibold underline-offset-2 transition-colors hover:underline",
                      bouts.winner === "away" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {awayDisplayName}
                  </Link>
                ) : (
                  <p
                    className={cn(
                      "truncate text-lg font-semibold",
                      bouts.winner === "away" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {awayDisplayName}
                  </p>
                )}
                {bouts.awayAverage !== null && (
                  <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
                    AVG {bouts.awayAverage.toFixed(3)} · HR {bouts.awayHighRun ?? "—"} · {totalAwayPoints} pts
                  </p>
                )}
                {awayTeam && (
                  <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
                    Round #{awayTeam.rank} · {awayTeam.wins}W–{awayTeam.losses}L · {awayTeam.points} pts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
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

        <p className="mt-6 text-xs text-muted-foreground">
          <Link
            href={`/teams/matches?season=${encodeURIComponent(season?.시즌코드 ?? "")}&round=${encodeURIComponent(roundCode)}`}
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to round fixtures
          </Link>
          {selectedBout === null && selectedSet !== null
            ? " — this bout number has no record in the fixture."
            : ""}
        </p>
      </div>
    </>
  );
}
