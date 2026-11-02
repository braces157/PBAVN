import type { Metadata } from "next";
import Link from "next/link";
import { getTeamLeagueRounds, getTeamLeagueSeasons, getTeamPlayerStats, getTeamRoster, getTeamStandings } from "@/lib/pba/api";
import { englishSponsor, englishVenue, teamLeagueTitle } from "@/lib/pba/service";
import { trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { normalizeTeam, normalizeTeamPlayer, normalizeTeamProfile } from "@/lib/normalize";
import { grouped, percent, wonCompact } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { StandingsTable } from "@/components/domain/standings-table";
import { PlayerAvatar, TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, SectionHeading, Stat, TextLink } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Teams",
  description:
    "PBA Team League franchise standings, rosters and player statistics, round by round.",
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
        <PageHeader failures={seasonFailures} eyebrow="Team league" title="Franchise competition" />
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10">
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

  const { standingsRaw, playersRaw, rosterRaw, failures } = await trackFailures(async () => {
    const [standingsRaw, playersRaw, rosterRaw] = await Promise.all([
      getTeamStandings({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
      getTeamPlayerStats({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
      getTeamRoster({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
    ]);
    return { standingsRaw, playersRaw, rosterRaw, failures: getRequestFailures() };
  });

  const standings = standingsRaw.map(normalizeTeam);
  const players = playersRaw.map(normalizeTeamPlayer);

  // One profile per club; the roster feed repeats a club for every round it appears in.
  const profiles = new Map<string, ReturnType<typeof normalizeTeamProfile>>();
  for (const raw of rosterRaw) {
    if (!profiles.has(raw.팀코드)) profiles.set(raw.팀코드, normalizeTeamProfile(raw));
  }

  const topScorers = [...players].sort((a, b) => b.average - a.average).slice(0, 6);

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Team league"
        title={teamLeagueTitle(season.시즌명)}
        description={`${englishSponsor(season.스폰서)} presents a ${wonCompact(season.상금)} prize purse. Franchise clubs play singles, doubles and mixed-doubles sets across the regular rounds.`}
      >
        <div className="flex flex-col gap-4">
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

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {selectedRound && (
          <div className="surface mb-8 flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
            <div className="flex items-center gap-3">
              {selectedRound.진행상황 === "진행중" ? <LiveChip label="In progress" /> : <Chip tone="neutral">{selectedRound.진행상황}</Chip>}
              <div>
                <p className="font-display text-[15px] font-bold text-fog-100">
                  Round {selectedRound.라운드}
                  {selectedRound.포스트여부 === "Y" ? " · Postseason" : ""}
                </p>
                <p className="tnum mt-0.5 text-[11.5px] text-fog-500">
                  {selectedRound.시작일자} → {selectedRound.종료일자}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Stat label="Venue" value={<span className="text-[15px]">{englishVenue(selectedRound.경기장소)}</span>} />
              <Stat label="Teams" value={grouped(standings.length)} />
              <Stat label="Players" value={grouped(players.length)} />
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12">
          <section>
            <SectionHeading
              eyebrow="Table"
              title="Standings"
              action={<TextLink href="/teams/players">Player statistics</TextLink>}
            />
            <div className="mt-5 surface overflow-hidden">
              {standings.length > 0 ? (
                <StandingsTable rows={standings} />
              ) : (
                <EmptyState className="border-0" title="No standings for this round" />
              )}
            </div>
          </section>

          <section>
            <SectionHeading eyebrow="Leaders" title="Best averages" />
            <div className="mt-5 surface p-2">
              {topScorers.length > 0 ? (
                <ul className="divide-y divide-ink-800">
                  {topScorers.map((player, index) => (
                    <li key={player.code} className="flex items-center gap-3 px-2 py-2.5">
                      <span className="tnum w-4 text-[11px] text-fog-600">{index + 1}</span>
                      <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-fog-100">{player.name}</p>
                        <p className="truncate text-[10.5px] text-fog-600">{player.team}</p>
                      </div>
                      <span className="tnum shrink-0 font-display text-[12.5px] font-bold text-lime-400">
                        {player.average.toFixed(3)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="border-0" title="No player data" />
              )}
            </div>
          </section>
        </div>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Clubs"
            title="The franchises"
            description="Every club in this season's team league, with its coaching staff and home base."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {standings.map((team) => {
              const profile = profiles.get(team.code);
              return (
                <Link
                  key={team.code}
                  href={`/teams/${encodeURIComponent(team.code)}?season=${season.시즌코드}&round=${roundCode}`}
                  className="surface card-hover group flex flex-col p-4"
                >
                  <div className="flex items-start justify-between">
                    <TeamLogo src={team.logo} name={team.name} size="lg" />
                    <span className="tnum rounded-md bg-ink-800 px-2 py-0.5 font-display text-[11px] font-bold text-fog-300">
                      #{team.rank}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 font-display text-[13.5px] font-bold leading-snug text-fog-100 group-hover:text-lime-300">
                    {profile?.name ?? team.name}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-fog-600">
                    {profile?.coach ? `Coach ${profile.coach}` : team.shortName}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-800 pt-2.5">
                    <span className="tnum text-[11px] text-fog-500">
                      {team.wins}W {team.losses}L
                    </span>
                    <span className="tnum text-[11px] font-semibold text-lime-400">{team.points} pts</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Roster stats"
            title="Every player in the league"
            description="Per-player averages, set records and singles/doubles splits for the selected round."
            action={<TextLink href="/teams/players">Open full table</TextLink>}
          />
          <div className="mt-5 overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900">
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
                      <span className="flex items-center gap-2">
                        <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="xs" />
                        <span className="truncate text-[13px] text-fog-100">{player.name}</span>
                      </span>
                    </td>
                    <td className="!text-left hidden text-fog-400 sm:table-cell">{player.team}</td>
                    <td className="font-semibold text-lime-400">{player.average.toFixed(3)}</td>
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
