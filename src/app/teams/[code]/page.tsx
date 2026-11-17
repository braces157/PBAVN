import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTeamLeagueRounds,
  getTeamLeagueSeasons,
  getTeamMatchMatrix,
  getTeamPlayerStats,
  getTeamRoster,
  getTeamStandings,
  trackFailures,
} from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, getRoundFixtures, type TeamFixture } from "@/lib/pba/team-matches";
import {
  matchMatrix,
  normalizeTeam,
  normalizeTeamPlayer,
  normalizeTeamProfile,
} from "@/lib/normalize";
import { average, grouped, percent } from "@/lib/format";
import { PlayerAvatar, TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, KeyValue, SectionHeading, Stat, TextLink } from "@/components/ui/primitives";
import { TeamStatGrid } from "@/components/domain/standings-table";
import { FixtureList, type FixtureClub } from "@/components/domain/fixture-list";
import { DataStatus } from "@/components/site/data-status";
import { FilterRow } from "@/components/domain/filter-bar";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ season?: string; round?: string }>;
}

/**
 * One resolution per request: `generateMetadata` and the page both ask for the
 * same club, and without React's cache the whole seven-read fan-out below ran
 * twice per view.
 */
const resolveTeam = cache(
  async (code: string, seasonParam?: string, roundParam?: string) => {
  const seasons = await getTeamLeagueSeasons();
  const season = seasons.find((s) => s.시즌코드 === seasonParam) ?? seasons[0] ?? null;
  if (!season) return null;

  const rounds = await getTeamLeagueRounds(season.리그코드);
  const round =
    rounds.find((r) => String(r.라운드코드) === roundParam) ??
    rounds.find((r) => r.진행상황 === "진행중") ??
    rounds[0] ??
    null;
  const roundCode = round ? String(round.라운드코드) : "0";
  const decoded = decodeURIComponent(code);

  const { rosterRaw, standingsRaw, playersRaw, matrixRaw, fixtures, failures } = await trackFailures(
    async () => {
      const [rosterRaw, standingsRaw, playersRaw, matrixRaw, fixtures] = await Promise.all([
        getTeamRoster({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
        getTeamStandings({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
        getTeamPlayerStats({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
        getTeamMatchMatrix({ seasonCode: season.시즌코드, leagueCode: String(season.리그코드), roundCode }),
        // The round-wide fixtures POST, shared with /teams and /teams/matches
        // through the transport cache; the section below filters it by club.
        round
          ? getRoundFixtures(
              String(round.라운드코드),
              round.라운드,
              round.진행상황 === "진행중" ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL,
            )
          : Promise.resolve([] as TeamFixture[]),
      ]);
      return {
        rosterRaw,
        standingsRaw,
        playersRaw,
        matrixRaw,
        fixtures,
        failures: getRequestFailures(),
      };
    },
  );

  const profileRaw = rosterRaw.find((r) => r.팀코드 === decoded || r.리그참여팀코드 === decoded);
  if (!profileRaw) return null;

  const profile = normalizeTeamProfile(profileRaw);
  const standings = standingsRaw.map(normalizeTeam);
  const standing = standings.find((s) => s.code === profile.code) ?? null;
  const players = playersRaw
    .map(normalizeTeamPlayer)
    .filter((p) => p.teamCode === profile.code || p.team === profile.name)
    .sort((a, b) => b.average - a.average);

  return {
    season,
    seasons,
    round,
    rounds,
    roundCode,
    profile,
    standing,
    players,
    standings,
    matrix: matchMatrix(matrixRaw),
    fixtures: fixtures.filter(
      (fixture) => fixture.home.clubCode === profile.code || fixture.away.clubCode === profile.code,
    ),
    failures,
    clubs: new Map<string, FixtureClub>(
      standingsRaw.map((raw) => {
        const team = normalizeTeam(raw);
        return [team.code, { name: team.name, logo: team.logo }];
      }),
    ),
    profileIndex: new Map(rosterRaw.map((r) => [r.팀코드, normalizeTeamProfile(r)])),
  };
  },
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const resolved = await resolveTeam(code);
  if (!resolved) return { title: "Team not found" };
  return {
    title: resolved.profile.name,
    description: `${resolved.profile.name} — roster, coaching staff, team statistics and head-to-head record in the PBA Team League.`,
  };
}

export default async function TeamDetailPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const search = await searchParams;
  const resolved = await resolveTeam(code, search.season, search.round);
  if (!resolved) notFound();

  const { season, seasons, round, rounds, roundCode, profile, standing, players, standings, matrix, fixtures, clubs, failures, profileIndex } =
    resolved;
  const playedFixtures = fixtures.filter((fixture) => fixture.played);
  const fixtureWins = playedFixtures.filter((fixture) =>
    fixture.home.clubCode === profile.code ? fixture.home.won : fixture.away.won,
  ).length;

  return (
    <>
      <section className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-40" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[400px] w-[400px] rounded-full opacity-[0.10] blur-[110px]"
          style={{ background: "var(--color-violet-450)" }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-8 sm:px-6 lg:px-10">
          <nav className="flex items-center gap-2 text-[11.5px] text-fog-600" aria-label="Breadcrumb">
            <Link href="/teams" className="transition-colors hover:text-fog-300">
              Team league
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fog-400">{season.시즌명}</span>
          </nav>

          <div className="mt-7 flex flex-wrap items-start gap-6">
            <TeamLogo src={profile.logo} name={profile.name} size="2xl" className="!h-24 !w-24 !rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="violet">Team league</Chip>
                {standing && <Chip tone="neutral">Rank #{standing.rank}</Chip>}
                {round && <Chip tone="neutral">Round {round.라운드}</Chip>}
              </div>
              <h1 className="display-lg mt-3 text-fog-100">{profile.name}</h1>
              <p className="mt-2 text-[13px] text-fog-500">
                {profile.base || "Team League"}
                {profile.coach ? ` · Coach ${profile.coach}` : ""}
              </p>
            </div>
            {standing && (
              <dl className="flex gap-8">
                <Stat label="Points" value={grouped(standing.points)} accent />
                <Stat label="Record" value={`${standing.wins}–${standing.losses}`} />
                <Stat label="Set ratio" value={standing.setRatio ? standing.setRatio.toFixed(3) : "—"} />
              </dl>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <DataStatus failures={failures} />
        <div className="mb-6 space-y-3 rounded-lg border border-ink-750 p-4">
          <FilterRow label="Season" basePath={`/teams/${profile.code}`} paramKey="season" active={season.시즌코드} params={{}} options={seasons.map((item) => ({ value: item.시즌코드, label: item.시즌명 }))} />
          <FilterRow label="Round" basePath={`/teams/${profile.code}`} paramKey="round" active={roundCode} params={{ season: season.시즌코드 }} options={[...rounds].sort((a, b) => a.라운드 - b.라운드).map((item) => ({ value: String(item.라운드코드), label: `R${item.라운드}` }))} />
        </div>
        {standing && <TeamStatGrid team={standing} />}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:gap-14">
          <div className="min-w-0">
          <section>
            <SectionHeading
              eyebrow="Fixtures"
              title={`Fixtures in this round${round ? ` (R${round.라운드})` : ""}`}
              description="Results and scheduled matches for the selected round."
              action={
                <TextLink
                  href={`/teams/matches?season=${season.시즌코드}&round=${roundCode}`}
                >
                  All fixtures of the round
                </TextLink>
              }
            />
            <div className="mt-5">
              {playedFixtures.length > 0 && <p className="mb-3 text-sm text-fog-300">{fixtureWins} wins in {playedFixtures.length} recorded matches · {fixtures.length - playedFixtures.length} scheduled</p>}
              <FixtureList
                fixtures={fixtures}
                clubs={clubs}
                season={season.시즌코드}
                round={roundCode}
                emptyTitle={
                  standing
                    ? "No fixtures published for this club"
                    : `${profile.shortName} is not competing this round`
                }
                emptyDescription={
                  standing
                    ? "The round's schedule has no fixture blocks for this club yet."
                    : undefined
                }
              />
            </div>
          </section>

          <section className="mt-10">
            <SectionHeading
              eyebrow="Roster"
              title={`${players.length} players`}
              description="Sorted by average in the selected round. Set records combine singles, doubles and mixed-doubles appearances."
            />
            {players.length > 0 ? (
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {players.map((player) => (
                  <Link
                    key={player.code}
                    href={`/players/${player.code}`}
                    className="surface card-hover group flex items-center gap-3 p-3"
                  >
                    <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-fog-100 group-hover:text-lime-300">
                        {player.name}
                        {player.isCaptain && (
                          <span className="ml-1.5 rounded bg-gold-400/15 px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-gold-400">
                            C
                          </span>
                        )}
                      </p>
                      <p className="tnum mt-0.5 truncate text-[10.5px] text-fog-600">
                        {player.nation}{player.matches > 0 ? ` · ${player.matches} matches` : ""}{player.highRun > 0 ? ` · HR ${player.highRun}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum font-display text-[14px] font-bold text-lime-400">
                        {average(player.average)}
                      </p>
                      <p className="tnum text-[10px] text-fog-600">{percent(player.winRate, 0)} win</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                className="mt-5"
                title={
                  standing
                    ? "No roster published"
                    : `${profile.shortName} is not competing this round`
                }
                description={
                  standing
                    ? "Player data is not available for this round. Try another round from the team league page."
                    : `${season.시즌명} round ${round?.라운드 ?? "—"} does not include this club. It appears in the historical club register, so older seasons may still hold its records.`
                }
                action={
                  <TextLink href={`/teams?season=${season.시즌코드}&round=${roundCode}`}>
                    See this round's clubs
                  </TextLink>
                }
              />
            )}
          </section>

          </div>

          <aside className="space-y-4">
            <div className="surface p-4">
              <p className="eyebrow">Club</p>
              <dl className="mt-3">
                <KeyValue label="Coach">{profile.coach || "—"}</KeyValue>
                <KeyValue label="Base">{profile.base || "—"}</KeyValue>
                <KeyValue label="Sponsor">{profile.sponsor || "—"}</KeyValue>
                <KeyValue label="Season">{season.시즌명}</KeyValue>
                <KeyValue label="Club code">{profile.code}</KeyValue>
              </dl>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-ink-800 px-4 py-3">
                <p className="eyebrow">Head-to-head</p>
              </div>
              {matrix.size === 0 ? <p className="px-4 py-3 text-xs text-fog-400">Head-to-head records are unavailable for this round.</p> : <div className="divide-y divide-ink-800">
                {standings
                  .filter((other) => other.code !== profile.code)
                  .map((other) => {
                    const key = [profile.code, other.code].sort().join("|");
                    const cell = matrix.get(key);
                    const ownWins = cell && profile.code <= other.code ? cell.wins : cell?.losses ?? 0;
                    const ownLosses = cell && profile.code <= other.code ? cell.losses : cell?.wins ?? 0;
                    return (
                      <div key={other.code} className="flex items-center gap-2.5 px-3 py-2">
                        <TeamLogo src={other.logo} name={other.name} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-fog-300">
                          {profileIndex.get(other.code)?.shortName || other.shortName || other.name}
                        </span>
                        <span
                          className={`tnum shrink-0 text-[12px] font-semibold ${
                            !cell
                              ? "text-fog-600"
                              : ownWins > ownLosses
                                ? "text-lime-400"
                                : ownWins < ownLosses
                                  ? "text-live-400"
                                  : "text-fog-500"
                          }`}
                        >
                          {cell ? `${ownWins}–${ownLosses}` : "—"}
                        </span>
                      </div>
                    );
                  })}
              </div>}
              {!standing && (
                <p className="border-t border-ink-800 px-4 py-2.5 text-[11px] leading-relaxed text-fog-600">
                  No meetings recorded for this club in round {round?.라운드 ?? "—"}.
                </p>
              )}
            </div>

            <div className="surface p-4">
              <p className="eyebrow">Back to league</p>
              <div className="mt-3 flex flex-col gap-2">
                <TextLink href={`/teams?season=${season.시즌코드}&round=${roundCode}`}>Standings &amp; clubs</TextLink>
                <TextLink href="/teams/players">All player statistics</TextLink>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
