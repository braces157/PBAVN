import type { Metadata } from "next";
import Link from "next/link";
import { getTeamLeagueRounds, getTeamLeagueSeasons, getTeamPlayerStats, getTeamRoster, getTeamStandings, trackFailures } from "@/lib/pba/api";
import {
  englishRoundStatus,
  englishSponsor,
  englishVenue,
  getPlayerNameIndex,
  resolveKoreanName,
  resolveOfficialTeamPlayer,
  teamLeagueTitle,
} from "@/lib/pba/service";
import { getRequestFailures } from "@/lib/pba/failures";
import { FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, getRoundFixtures } from "@/lib/pba/team-matches";
import { normalizeTeam, normalizeTeamPlayer, normalizeTeamProfile } from "@/lib/normalize";
import { grouped, hasHangul, percent, wonCompact } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { StandingsTable } from "@/components/domain/standings-table";
import { FixtureList, type FixtureClub } from "@/components/domain/fixture-list";
import { PlayerAvatar, TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, SectionHeading, Stat, TextLink } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Teams",
  description:
    "PBA Team League club standings, rosters and 3-cushion player statistics, round by round.",
};

interface PageProps {
  searchParams: Promise<{ season?: string; round?: string }>;
}

export default async function TeamsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { seasons, seasonFailures } = await trackFailures(async () => {
    const seasons = await getTeamLeagueSeasons();
    return { seasons, seasonFailures: getRequestFailures() };
  });

  const season = seasons.find((s) => s.시즌코드 === params.season) ?? seasons[0] ?? null;

  if (!season) {
    return (
      <>
        <PageHeader failures={seasonFailures} eyebrow="Team league" title="PBA Team League" />
        <div className="wrap py-10">
          <EmptyState title="No team league season published" description="The association has not opened a team league season yet." />
        </div>
      </>
    );
  }

  const {
    rounds,
    selectedRound,
    isOverall,
    roundCode,
    standingsRaw,
    playersRaw,
    rosterRaw,
    fixtures,
    roundWinners,
    failures,
  } = await trackFailures(async () => {
    const rounds = await getTeamLeagueRounds(season.리그코드);
    const isOverall = params.round === "0";
    const selectedRound = isOverall
      ? null
      : rounds.find((r) => String(r.라운드코드) === params.round) ??
        rounds.find((r) => r.진행상황 === "진행중") ??
        rounds[0] ??
        null;
    const roundCode = selectedRound ? String(selectedRound.라운드코드) : "0";

    const completedRegularRounds = [...rounds]
      .filter((r) => r.포스트여부 !== "Y" && r.진행상황 === "종료")
      .sort((a, b) => a.라운드 - b.라운드);

    const [standingsRaw, playersRaw, rosterRaw, fixtures, roundLeaders] = await Promise.all([
      getTeamStandings({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
      getTeamPlayerStats({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
      getTeamRoster({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
      selectedRound
        ? getRoundFixtures(
            String(selectedRound.라운드코드),
            selectedRound.라운드,
            selectedRound.진행상황 === "진행중" ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL,
          )
        : Promise.resolve([]),
      Promise.all(
        completedRegularRounds.map(async (r) => {
          const table = await getTeamStandings({
            seasonCode: season.시즌코드,
            leagueCode: String(season.리그코드),
            roundCode: String(r.라운드코드),
          });
          const winner = table.length > 0 ? normalizeTeam(table[0]) : null;
          return winner ? { roundNo: r.라운드, roundCode: String(r.라운드코드), winner } : null;
        }),
      ),
    ]);
    return {
      rounds,
      selectedRound,
      isOverall,
      roundCode,
      standingsRaw,
      playersRaw,
      rosterRaw,
      fixtures,
      roundWinners: roundLeaders.filter((x): x is NonNullable<typeof x> => Boolean(x)),
      failures: getRequestFailures(),
    };
  });

  const nameIndex = getPlayerNameIndex();
  const standings = standingsRaw.map(normalizeTeam);
  const clubs = new Map<string, FixtureClub>(
    standings.map((team) => [team.code, { name: team.name, logo: team.logo }]),
  );
  const players = playersRaw.map(normalizeTeamPlayer).map((p) => resolveOfficialTeamPlayer(p, nameIndex));

  const profiles = new Map<string, ReturnType<typeof normalizeTeamProfile>>();
  for (const raw of rosterRaw) {
    const normalized = normalizeTeamProfile(raw);
    const officialCoach =
      raw.팀감독 && hasHangul(raw.팀감독) ? resolveKoreanName(raw.팀감독, nameIndex) : "";
    const resolvedCoach =
      officialCoach && !/^[\s\-ㆍ·.미정없음0]+$/.test(officialCoach) ? officialCoach : normalized.coach;
    const prev = profiles.get(raw.팀코드);
    profiles.set(raw.팀코드, {
      ...normalized,
      coach: resolvedCoach || prev?.coach || "",
      base: normalized.base || prev?.base || "",
      sponsor: normalized.sponsor || prev?.sponsor || "",
      description: normalized.description || prev?.description || "",
    });
  }

  const playersByAverage = [...players].sort((a, b) => b.average - a.average);
  const topScorers = playersByAverage.slice(0, 6);
  const teamPlayersHref = `/teams/players?season=${encodeURIComponent(season.시즌코드)}&round=${encodeURIComponent(roundCode)}`;

  return (
    <>
      <PageHeader
        failures={[...seasonFailures, ...failures]}
        eyebrow="Team league"
        title={teamLeagueTitle(season.시즌명)}
        description={`${englishSponsor(season.스폰서)} · ${wonCompact(season.상금)} prize purse`}
      >
        <div className="flex flex-col gap-2">
          <FilterRow
            label="Season"
            basePath="/teams"
            paramKey="season"
            active={season.시즌코드}
            params={{}}
            options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
          />
          {rounds.length > 0 && (
            <FilterRow
              label="Round"
              basePath="/teams"
              paramKey="round"
              active={isOverall ? "0" : selectedRound ? String(selectedRound.라운드코드) : "0"}
              params={{ season: season.시즌코드 }}
              options={[
                { value: "0", label: "Overall" },
                ...[...rounds]
                  .sort((a, b) => a.라운드 - b.라운드)
                  .map((r) => ({
                    value: String(r.라운드코드),
                    label: `${r.포스트여부 === "Y" ? "PO " : ""}R${r.라운드}`,
                  })),
              ]}
            />
          )}
        </div>
      </PageHeader>

      <div className="wrap py-6">
        {selectedRound ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-3">
              {selectedRound.진행상황 === "진행중" ? (
                <LiveChip label="In progress" />
              ) : (
                <Chip tone="neutral">{englishRoundStatus(selectedRound.진행상황)}</Chip>
              )}
              <div>
                <p className="text-base font-semibold text-foreground">
                  Round {selectedRound.라운드}
                  {selectedRound.포스트여부 === "Y" ? " · Postseason" : ""}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {selectedRound.시작일자} → {selectedRound.종료일자}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-2">
              <Stat label="Venue" value={<span className="text-sm font-medium">{englishVenue(selectedRound.경기장소)}</span>} />
              <Stat label="Clubs" value={grouped(standings.length)} />
              <Stat label="Players" value={grouped(players.length)} />
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl border border-border bg-card px-5 py-4">
            <div>
              <Chip tone="carom">Full Season</Chip>
              <p className="mt-1.5 text-base font-semibold text-foreground">
                Overall Standings · {season.시즌명}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cumulative table across all rounds. Each round winner clinches Postseason; duplicate winners open Wild Card spots by overall rank.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-2">
              <Stat label="Rounds" value={grouped(rounds.length)} />
              <Stat label="Clubs" value={grouped(standings.length)} />
              <Stat label="Players" value={grouped(players.length)} />
            </div>
          </div>
        )}

        {roundWinners.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-secondary/35 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Postseason Qualifiers · Round Winners
              </p>
              <span className="text-[11px] text-muted-foreground">
                7-set matches · 4–0/1/2 = 3 pts · 4–3 = 2 pts (loser 1 pt)
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {roundWinners.map((rw) => (
                <Link
                  key={rw.roundCode}
                  href={`/teams/${encodeURIComponent(rw.winner.code)}?season=${season.시즌코드}&round=${rw.roundCode}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/50 hover:no-underline"
                >
                  <span className="font-mono text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    R{rw.roundNo} ✓
                  </span>
                  <TeamLogo src={rw.winner.logo} name={rw.winner.name} size="xs" />
                  <span className="font-medium text-foreground">{rw.winner.shortName || rw.winner.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:gap-8">
          <section className="min-w-0">
            <SectionHeading
              eyebrow="Standings"
              title={isOverall ? "Overall Season Standings" : `Round ${selectedRound?.라운드 ?? ""} Standings`}
              action={<TextLink href={teamPlayersHref}>Player statistics</TextLink>}
            />
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
              {standings.length > 0 ? (
                <StandingsTable rows={standings} />
              ) : (
                <EmptyState className="border-0" title="No standings for this round" />
              )}
            </div>
          </section>

          <section className="min-w-0">
            <SectionHeading eyebrow="Leaders" title="Best Averages" />
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
              {topScorers.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {topScorers.map((player, index) => (
                    <li key={player.code}>
                      <Link
                        href={`/players/${player.code}`}
                        className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-accent/50 hover:no-underline"
                      >
                        <span className="w-4 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">{player.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{player.team}</p>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                          {player.average.toFixed(3)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="border-0" title="No player data" />
              )}
            </div>
          </section>
        </div>

        {selectedRound && (
          <section className="mt-10">
            <SectionHeading
              eyebrow="Fixtures"
              title={`Round ${selectedRound.라운드} Fixtures`}
              description={
                fixtures.length > 12
                  ? `Showing 12 of ${fixtures.length} round fixtures.`
                  : `${fixtures.length} fixtures`
              }
              action={
                <TextLink
                  href={`/teams/matches?season=${season.시즌코드}&round=${roundCode}`}
                >
                  All {fixtures.length} round fixtures
                </TextLink>
              }
            />
            <div className="mt-4">
              <FixtureList
                fixtures={fixtures.slice(0, 12)}
                clubs={clubs}
                season={season.시즌코드}
                round={roundCode}
              />
            </div>
          </section>
        )}

        <section className="mt-10">
          <SectionHeading eyebrow="Clubs" title="Clubs" />
          {standings.length === 0 ? (
            <EmptyState className="mt-4" title="No club rosters published" />
          ) : (
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {standings.map((team) => {
                const profile = profiles.get(team.code);
                const displayName = profile?.name ?? team.name;
                const subtitle = profile?.coach
                  ? `Coach ${profile.coach}`
                  : profile?.base || (team.shortName !== displayName ? team.shortName : "Team League club");
                return (
                  <Link
                    key={team.code}
                    href={`/teams/${encodeURIComponent(team.code)}?season=${season.시즌코드}&round=${roundCode}`}
                    className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40 hover:no-underline"
                  >
                    <div className="flex items-start justify-between">
                      <TeamLogo src={team.logo} name={team.name} size="md" />
                      <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-foreground">
                        #{team.rank}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:underline">
                      {displayName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {team.wins}W {team.losses}L
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {team.points} pts
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <SectionHeading
            eyebrow="Player stats"
            title="Player Leaders"
            action={<TextLink href={teamPlayersHref}>Full table</TextLink>}
          />
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            {playersByAverage.length === 0 ? (
              <EmptyState className="border-0" title="No player stats published" />
            ) : (
              <table className="stat-table">
                <thead>
                  <tr>
                    <th scope="col" className="!text-left">Player</th>
                    <th scope="col" className="!text-left hidden sm:table-cell">Team</th>
                    <th scope="col">Avg</th>
                    <th scope="col">Win%</th>
                    <th scope="col" className="hidden sm:table-cell">HR</th>
                    <th scope="col" className="hidden md:table-cell">Sets</th>
                    <th scope="col" className="hidden md:table-cell">Singles</th>
                    <th scope="col" className="hidden lg:table-cell">Doubles</th>
                  </tr>
                </thead>
                <tbody>
                  {playersByAverage.slice(0, 12).map((player) => (
                    <tr key={player.code}>
                      <td className="!text-left">
                        <Link href={`/players/${player.code}`} className="flex items-center gap-2 hover:underline">
                          <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
                          <span className="truncate text-[13px] font-medium text-foreground">{player.name}</span>
                        </Link>
                      </td>
                      <td className="!text-left hidden text-muted-foreground sm:table-cell">{player.team}</td>
                      <td className="font-mono font-semibold tabular-nums text-foreground">{player.average.toFixed(3)}</td>
                      <td className="font-mono tabular-nums text-muted-foreground">{percent(player.winRate)}</td>
                      <td className="hidden font-mono tabular-nums text-muted-foreground sm:table-cell">{player.highRun}</td>
                      <td className="hidden font-mono tabular-nums text-muted-foreground md:table-cell">
                        {player.setWins}–{player.setLosses}
                      </td>
                      <td className="hidden font-mono tabular-nums text-muted-foreground md:table-cell">
                        {player.singlesWins}–{player.singlesLosses}
                      </td>
                      <td className="hidden font-mono tabular-nums text-muted-foreground lg:table-cell">
                        {player.doublesWins}–{player.doublesLosses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
