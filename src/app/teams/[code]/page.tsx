import type { Metadata } from "next";
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
import {
  getPlayerNameIndex,
  resolveKoreanName,
  resolveOfficialTeamPlayer,
} from "@/lib/pba/service";
import { FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, getRoundFixtures, type TeamFixture } from "@/lib/pba/team-matches";
import {
  matchMatrix,
  normalizeTeam,
  normalizeTeamPlayer,
  normalizeTeamProfile,
} from "@/lib/normalize";
import { average, grouped, hasHangul, percent } from "@/lib/format";
import { PlayerAvatar, TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, KeyValue, SectionHeading, Stat, TextLink } from "@/components/ui/primitives";
import { TeamStatGrid } from "@/components/domain/standings-table";
import { FixtureList, type FixtureClub } from "@/components/domain/fixture-list";
import { DataStatus } from "@/components/site/data-status";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ season?: string; round?: string }>;
}

async function resolveTeam(code: string, seasonParam?: string, roundParam?: string) {
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

  const nameIndex = getPlayerNameIndex();
  const profileMap = new Map<string, ReturnType<typeof normalizeTeamProfile>>();
  const activeRosterToClub = new Map<string, string>();
  const latestRosterCodeByClub = new Map<string, string>();

  for (const raw of rosterRaw) {
    const normalized = normalizeTeamProfile(raw);
    const officialCoach =
      raw.팀감독 && hasHangul(raw.팀감독) ? resolveKoreanName(raw.팀감독, nameIndex) : "";
    const resolvedCoach =
      officialCoach && !/^[\s\-ㆍ·.미정없음0]+$/.test(officialCoach) ? officialCoach : normalized.coach;
    const prev = profileMap.get(normalized.code);
    profileMap.set(normalized.code, {
      ...normalized,
      coach: resolvedCoach || prev?.coach || "",
      base: normalized.base || prev?.base || "",
      sponsor: normalized.sponsor || prev?.sponsor || "",
      description: normalized.description || prev?.description || "",
    });
    if (raw.리그참여팀코드) {
      latestRosterCodeByClub.set(normalized.code, String(raw.리그참여팀코드));
    }
  }

  for (const [clubCode, rCode] of latestRosterCodeByClub) {
    activeRosterToClub.set(rCode, clubCode);
  }

  const profile = profileMap.get(decoded);
  if (!profile) return null;

  const standings = standingsRaw.map(normalizeTeam);
  const standing = standings.find((s) => s.code === profile.code) ?? null;
  const players = playersRaw
    .map(normalizeTeamPlayer)
    .filter((p) => p.teamCode === profile.code || p.team === profile.name)
    .map((p) => resolveOfficialTeamPlayer(p, nameIndex))
    .sort((a, b) => b.average - a.average);

  return {
    season,
    round,
    roundCode,
    profile,
    standing,
    players,
    standings,
    matrix: matchMatrix(matrixRaw, activeRosterToClub),
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
    profileIndex: profileMap,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const resolved = await resolveTeam(code);
  if (!resolved) return { title: "Team not found" };
  return {
    title: `${resolved.profile.name} — Roster & Stats`,
    description: `${resolved.profile.name} — roster, coaching staff, team statistics and head-to-head record in the PBA Team League.`,
  };
}

export default async function TeamDetailPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const search = await searchParams;
  const resolved = await resolveTeam(code, search.season, search.round);
  if (!resolved) notFound();

  const { season, round, roundCode, profile, standing, players, standings, matrix, fixtures, clubs, failures, profileIndex } =
    resolved;

  return (
    <>
      <section className="border-b border-ink-800 bg-ink-900/60">
        <div className="mx-auto max-w-[1440px] px-4 pb-6 pt-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-[11.5px] text-fog-500" aria-label="Breadcrumb">
            <Link href="/teams" className="transition-colors hover:text-carom-300">
              Team League
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fog-300">{season.시즌명}</span>
          </nav>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <TeamLogo src={profile.logo} name={profile.name} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="violet">Team league</Chip>
                  {standing && <Chip tone="neutral">Rank #{standing.rank}</Chip>}
                  {round && <Chip tone="neutral">Round {round.라운드}</Chip>}
                </div>
                <h1 className="display-lg mt-2 text-fog-100">{profile.name}</h1>
                <p className="mt-1 text-[12.5px] text-fog-450">
                  {profile.base || "Team League"}
                  {profile.coach ? ` · Coach ${profile.coach}` : ""}
                </p>
              </div>
            </div>
            {standing && (
              <dl className="grid grid-cols-3 gap-4 border-t border-ink-800 pt-3 sm:flex sm:gap-7 sm:border-t-0 sm:pt-0">
                <Stat label="Points" value={grouped(standing.points)} accent />
                <Stat label="Record" value={`${standing.wins}–${standing.losses}`} />
                <Stat label="Set ratio" value={standing.setRatio ? standing.setRatio.toFixed(3) : "—"} />
              </dl>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <DataStatus failures={failures} />
        {standing && <TeamStatGrid team={standing} />}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_340px]">
          <div className="min-w-0">
            <section>
              <SectionHeading
                eyebrow="Roster"
                title={`${players.length} Players`}
                description="Sorted by season average across singles, doubles and mixed-doubles appearances."
              />
              {players.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {players.map((player) => (
                    <Link
                      key={player.code}
                      href={`/players/${player.code}`}
                      className="surface card-hover group flex items-center gap-3 p-3.5"
                    >
                      <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-fog-100 group-hover:text-carom-300">
                          {player.name}
                          {player.isCaptain && (
                            <span className="ml-1.5 rounded bg-gold-400/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-gold-300">
                              C
                            </span>
                          )}
                        </p>
                        <p className="tnum mt-0.5 truncate text-[11px] text-fog-500">
                          {player.nation} · {player.sets} sets · HR {player.highRun}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tnum font-display text-[14px] font-bold text-carom-300">
                          {average(player.average)}
                        </p>
                        <p className="tnum text-[10.5px] text-fog-500">{percent(player.winRate, 0)} win</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="mt-4"
                  title={
                    standing
                      ? "No roster published"
                      : `${profile.shortName} is not competing this round`
                  }
                  description={
                    standing
                      ? "Player data is not available for this round."
                      : `${season.시즌명} round ${round?.라운드 ?? "—"} does not include this club.`
                  }
                  action={
                    <TextLink href={`/teams?season=${season.시즌코드}&round=${roundCode}`}>
                      See this round&apos;s clubs
                    </TextLink>
                  }
                />
              )}
            </section>

            <section className="mt-10">
              <SectionHeading
                eyebrow="Fixtures"
                title={`Round ${round?.라운드 ?? ""} Fixtures`}
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
                  emptyTitle={
                    standing
                      ? "No fixtures published for this club"
                      : `${profile.shortName} is not competing this round`
                  }
                />
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="surface p-4">
              <p className="eyebrow">Club Info</p>
              <dl className="mt-2.5">
                <KeyValue label="Coach">{profile.coach || "—"}</KeyValue>
                <KeyValue label="Base">{profile.base || "—"}</KeyValue>
                <KeyValue label="Sponsor">{profile.sponsor || "—"}</KeyValue>
                <KeyValue label="Season">{season.시즌명}</KeyValue>
                <KeyValue label="Club code">{profile.code}</KeyValue>
              </dl>
            </div>

            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-750 bg-ink-850 px-4 py-2.5">
                <p className="eyebrow">Head-to-Head Matrix</p>
                <span className="text-[10.5px] font-semibold text-fog-500">{season.시즌명}</span>
              </div>
              <div className="divide-y divide-ink-800">
                {standings
                  .filter((other) => other.code !== profile.code)
                  .map((other) => {
                    const key = [profile.code, other.code].sort().join("|");
                    const cell = matrix.get(key);
                    const ownWins = cell && profile.code <= other.code ? cell.wins : cell?.losses ?? 0;
                    const ownLosses = cell && profile.code <= other.code ? cell.losses : cell?.wins ?? 0;
                    return (
                      <div key={other.code} className="flex items-center gap-2.5 px-3.5 py-2">
                        <TeamLogo src={other.logo} name={other.name} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fog-200">
                          {profileIndex.get(other.code)?.shortName ?? other.shortName}
                        </span>
                        <span
                          className={`tnum shrink-0 text-[12px] font-bold ${
                            !cell
                              ? "text-fog-600"
                              : ownWins > ownLosses
                                ? "text-carom-300"
                                : ownWins < ownLosses
                                  ? "text-live-400"
                                  : "text-fog-450"
                          }`}
                        >
                          {cell ? `${ownWins}–${ownLosses}` : "—"}
                        </span>
                      </div>
                    );
                  })}
              </div>
              {!standing && (
                <p className="border-t border-ink-800 px-4 py-2.5 text-[11px] text-fog-550">
                  No meetings recorded for this club in round {round?.라운드 ?? "—"}.
                </p>
              )}
            </div>

            <div className="surface p-4">
              <p className="eyebrow">Navigation</p>
              <div className="mt-2.5 flex flex-col gap-2">
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
