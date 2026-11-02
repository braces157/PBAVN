import type { Metadata } from "next";
import {
  getTeamLeagueRounds,
  getTeamLeagueSeasons,
  getTeamStandings,
  trackFailures,
} from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { FIXTURES_ARCHIVE_TTL, FIXTURES_IN_PLAY_TTL, getRoundFixtures } from "@/lib/pba/team-matches";
import { normalizeTeam } from "@/lib/normalize";
import { teamLeagueTitle } from "@/lib/pba/service";
import { FixtureList, type FixtureClub } from "@/components/domain/fixture-list";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { EmptyState } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Team league fixtures",
  description:
    "Every fixture of the current PBA Team League round, played results and scheduled kickoffs, bout by bout.",
};

interface PageProps {
  searchParams: Promise<{ season?: string; round?: string }>;
}

export default async function TeamFixturesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const loaded = await trackFailures(async () => {
    const seasons = await getTeamLeagueSeasons();
    const season = seasons.find((s) => s.시즌코드 === params.season) ?? seasons[0] ?? null;

    if (!season) {
      return {
        seasons,
        season: null,
        rounds: [],
        selectedRound: null,
        fixtures: [],
        clubs: new Map<string, FixtureClub>(),
        failures: getRequestFailures(),
      };
    }

    const rounds = await getTeamLeagueRounds(season.리그코드);
    // Defaults resolve exactly as /teams resolves them.
    const selectedRound =
      rounds.find((r) => String(r.라운드코드) === params.round) ??
      rounds.find((r) => r.진행상황 === "진행중") ??
      rounds[0] ??
      null;

    if (!selectedRound) {
      return {
        seasons,
        season,
        rounds,
        selectedRound: null,
        fixtures: [],
        clubs: new Map<string, FixtureClub>(),
        failures: getRequestFailures(),
      };
    }

    const roundCode = String(selectedRound.라운드코드);

    // The standings feed is where English club names and logos live; the
    // fixture blocks carry the T000xx codes that join to it. The fixtures
    // POST re-reads within the minute while the round is in progress.
    const [fixtures, standingsRaw] = await Promise.all([
      getRoundFixtures(
        roundCode,
        selectedRound.라운드,
        selectedRound.진행상황 === "진행중" ? FIXTURES_IN_PLAY_TTL : FIXTURES_ARCHIVE_TTL,
      ),
      getTeamStandings({
        seasonCode: season.시즌코드,
        leagueCode: String(season.리그코드),
        roundCode,
      }),
    ]);

    const clubs = new Map<string, FixtureClub>();
    for (const raw of standingsRaw) {
      const team = normalizeTeam(raw);
      clubs.set(team.code, { name: team.name, logo: team.logo });
    }

    return {
      seasons,
      season,
      rounds,
      selectedRound,
      fixtures,
      clubs,
      failures: getRequestFailures(),
    };
  });

  const { seasons, season, rounds, selectedRound, fixtures, clubs, failures } = loaded;

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Team league"
        title="Round fixtures"
        description="Every fixture of the selected round — played results with bout pages behind them, scheduled kickoffs ahead."
      >
        {season && (
          <div className="flex flex-col gap-4">
            <FilterRow
              label="Season"
              basePath="/teams/matches"
              paramKey="season"
              active={season.시즌코드}
              params={{ round: params.round }}
              options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
            />
            {rounds.length > 0 && (
              <FilterRow
                label="Round"
                basePath="/teams/matches"
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
        )}
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {!season || !selectedRound ? (
          <EmptyState
            title="No team league season published"
            description="The association has not opened a team league season yet."
          />
        ) : (
          <>
            <div className="surface mb-8 flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
              <div>
                <p className="font-display text-[15px] font-bold text-fog-100">
                  {teamLeagueTitle(season.시즌명)}
                </p>
                <p className="tnum mt-0.5 text-[11.5px] text-fog-500">
                  Round {selectedRound.라운드}
                  {selectedRound.포스트여부 === "Y" ? " · Postseason" : ""} ·{" "}
                  {selectedRound.진행상황 === "진행중" ? "In progress" : selectedRound.진행상황} ·{" "}
                  {selectedRound.시작일자} → {selectedRound.종료일자}
                </p>
              </div>
              <p className="tnum text-[11.5px] text-fog-500">
                {fixtures.length} fixtures · bout records open on played fixtures
              </p>
            </div>

            <FixtureList
              fixtures={fixtures}
              clubs={clubs}
              season={season.시즌코드}
              round={String(selectedRound.라운드코드)}
              emptyTitle="No fixtures published for this round"
              emptyDescription="An undrawn round publishes no fixture blocks yet. Try another round above."
            />
          </>
        )}
      </div>
    </>
  );
}
