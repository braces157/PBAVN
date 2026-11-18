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
        <div className="mx-auto max-w-[1300px] px-3 py-10">
          <EmptyState title="No team league season published" description="The association has not opened a team league season yet." />
        </div>
      </>
    );
  }

  const rounds = await getTeamLeagueRounds(season.리그코드);
  const selectedRound =
    rounds.find((r) => String(r.라운드코드) === params.round) ??
    rounds.find((r) => r.진행상황 === "진행중") ??
    rounds[0] ??
    null;
  const roundCode = selectedRound ? String(selectedRound.라운드코드) : "0";

  const { standingsRaw, playersRaw, rosterRaw, fixtures, failures } = await trackFailures(async () => {
    const [standingsRaw, playersRaw, rosterRaw, fixtures] = await Promise.all([
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
    ]);
    return { standingsRaw, playersRaw, rosterRaw, fixtures, failures: getRequestFailures() };
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

  const topScorers = [...players].sort((a, b) => b.average - a.average).slice(0, 6);

  return (
    <>
      <PageHeader
        failures={failures}
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
            params={{ round: params.round }}
            options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
          />
          {rounds.length > 0 && (
            <FilterRow
              label="Round"
              basePath="/teams"
              paramKey="round"
              active={selectedRound ? String(selectedRound.라운드코드) : ""}
              params={{ season: season.시즌코드 }}
              options={[...rounds]
                .sort((a, b) => a.라운드 - b.라운드)
                .map((r) => ({
                  value: String(r.라운드코드),
                  label: `${r.포스트여부 === "Y" ? "PO " : ""}R${r.라운드}`,
                }))}
            />
          )}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        {selectedRound && (
          <div className="surface-raised mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3.5">
            <div className="flex items-center gap-3">
              {selectedRound.진행상황 === "진행중" ? (
                <LiveChip label="In progress" />
              ) : (
                <Chip tone="neutral">{englishRoundStatus(selectedRound.진행상황)}</Chip>
              )}
              <div>
                <p className="font-display text-[15px] font-bold text-fog-100">
                  Round {selectedRound.라운드}
                  {selectedRound.포스트여부 === "Y" ? " · Postseason" : ""}
                </p>
                <p className="tnum mt-0.5 text-[11px] text-fog-450">
                  {selectedRound.시작일자} → {selectedRound.종료일자}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-2">
              <Stat label="Venue" value={<span className="text-[14px]">{englishVenue(selectedRound.경기장소)}</span>} />
              <Stat label="Clubs" value={grouped(standings.length)} />
              <Stat label="Players" value={grouped(players.length)} />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:gap-8">
          <section className="min-w-0">
            <SectionHeading
              eyebrow="Standings"
              title="Club Standings"
              action={<TextLink href="/teams/players">Player statistics</TextLink>}
            />
            <div className="surface mt-3 overflow-hidden">
              {standings.length > 0 ? (
                <StandingsTable rows={standings} />
              ) : (
                <EmptyState className="border-0" title="No standings for this round" />
              )}
            </div>
          </section>

          <section className="min-w-0">
            <SectionHeading eyebrow="Leaders" title="Best Averages" />
            <div className="surface mt-3 p-1.5">
              {topScorers.length > 0 ? (
                <ul className="divide-y divide-ink-800">
                  {topScorers.map((player, index) => (
                    <li key={player.code}>
                      <Link href={`/players/${player.code}`} className="row-hover flex items-center gap-2.5 px-2.5 py-2">
                        <span className="tnum w-4 text-[11px] font-bold text-fog-550">{index + 1}</span>
                        <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-fog-100">{player.name}</p>
                          <p className="truncate text-[10.5px] text-fog-500">{player.team}</p>
                        </div>
                        <span className="tnum shrink-0 font-display text-[13px] font-bold text-carom-300">
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
              action={
                <TextLink
                  href={`/teams/matches?season=${season.시즌코드}&round=${roundCode}`}
                >
                  All round fixtures
                </TextLink>
              }
            />
            <div className="mt-4">
              <FixtureList
                fixtures={fixtures}
                clubs={clubs}
                season={season.시즌코드}
                round={roundCode}
              />
            </div>
          </section>
        )}

        <section className="mt-10">
          <SectionHeading
            eyebrow="Clubs"
            title="Clubs"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {standings.map((team) => {
              const profile = profiles.get(team.code);
              return (
                <Link
                  key={team.code}
                  href={`/teams/${encodeURIComponent(team.code)}?season=${season.시즌코드}&round=${roundCode}`}
                  className="surface card-hover group flex flex-col p-3.5"
                >
                  <div className="flex items-start justify-between">
                    <TeamLogo src={team.logo} name={team.name} size="md" />
                    <span className="tnum rounded-[5px] border border-ink-700 bg-ink-850 px-2 py-0.5 font-display text-[11px] font-bold text-fog-200">
                      #{team.rank}
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 font-display text-[13.5px] font-bold leading-snug text-fog-100 group-hover:text-carom-300">
                    {profile?.name ?? team.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-fog-500">
                    {profile?.coach ? `Coach ${profile.coach}` : team.shortName}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between border-t border-ink-800 pt-2">
                    <span className="tnum text-[11px] text-fog-450">
                      {team.wins}W {team.losses}L
                    </span>
                    <span className="tnum text-[11.5px] font-bold text-carom-300">{team.points} pts</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <SectionHeading
            eyebrow="Player stats"
            title="Player Leaders"
            action={<TextLink href="/teams/players">Full table</TextLink>}
          />
          <div className="mt-4 overflow-x-auto rounded-[8px] border border-ink-750 bg-ink-900">
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="!text-left">Player</th>
                  <th className="!text-left hidden sm:table-cell">Team</th>
                  <th>Avg</th>
                  <th>Win%</th>
                  <th className="hidden sm:table-cell">HR</th>
                  <th className="hidden md:table-cell">Sets</th>
                  <th className="hidden md:table-cell">Singles</th>
                  <th className="hidden lg:table-cell">Doubles</th>
                </tr>
              </thead>
              <tbody>
                {players.slice(0, 12).map((player) => (
                  <tr key={player.code}>
                    <td className="!text-left">
                      <Link href={`/players/${player.code}`} className="flex items-center gap-2 hover:text-carom-300">
                        <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
                        <span className="truncate text-[12.5px] font-semibold text-fog-100">{player.name}</span>
                      </Link>
                    </td>
                    <td className="!text-left hidden text-fog-400 sm:table-cell">{player.team}</td>
                    <td className="font-bold text-carom-300">{player.average.toFixed(3)}</td>
                    <td className="text-fog-300">{percent(player.winRate)}</td>
                    <td className="hidden text-fog-300 sm:table-cell">{player.highRun}</td>
                    <td className="hidden text-fog-400 md:table-cell">
                      {player.setWins}–{player.setLosses}
                    </td>
                    <td className="hidden text-fog-400 md:table-cell">
                      {player.singlesWins}–{player.singlesLosses}
                    </td>
                    <td className="hidden text-fog-400 lg:table-cell">
                      {player.doublesWins}–{player.doublesLosses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
