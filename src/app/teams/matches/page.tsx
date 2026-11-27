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
import { englishRoundStatus, teamLeagueTitle } from "@/lib/pba/service";
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
  searchParams: Promise<{ season?: string; round?: string; club?: string }>;
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
  const selectedClub = params.club && clubs.has(params.club) ? params.club : "";
  const visibleFixtures = selectedClub
    ? fixtures.filter((f) => f.home.clubCode === selectedClub || f.away.clubCode === selectedClub)
    : fixtures;
  const clubOptions = [
    { value: "", label: "All clubs" },
    ...[...clubs.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([code, club]) => ({ value: code, label: club.name })),
  ];

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Team league"
        title="Round Fixtures"
        description={
          season && selectedRound
            ? `${teamLeagueTitle(season.시즌명)} · Round ${selectedRound.라운드} · ${visibleFixtures.length} fixtures`
            : "Played results and scheduled fixtures by round"
        }
      >
        {season && (
          <div className="flex flex-col gap-2">
            <FilterRow
              label="Season"
              basePath="/teams/matches"
              paramKey="season"
              active={season.시즌코드}
              params={{}}
              options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
            />
            {rounds.length > 0 && (
              <FilterRow
                label="Round"
                basePath="/teams/matches"
                paramKey="round"
                active={selectedRound ? String(selectedRound.라운드코드) : ""}
                params={{ season: season.시즌코드, club: selectedClub || undefined }}
                options={[...rounds]
                  .sort((a, b) => a.라운드 - b.라운드)
                  .map((r) => ({
                    value: String(r.라운드코드),
                    label: `${r.포스트여부 === "Y" ? "PO " : ""}R${r.라운드}`,
                  }))}
              />
            )}
            {clubs.size > 1 && (
              <FilterRow
                label="Club"
                basePath="/teams/matches"
                paramKey="club"
                active={selectedClub}
                params={{
                  season: season.시즌코드,
                  round: selectedRound ? String(selectedRound.라운드코드) : undefined,
                }}
                options={clubOptions}
              />
            )}
          </div>
        )}
      </PageHeader>

      <div className="wrap py-5">
        {!season || !selectedRound ? (
          <EmptyState
            title="No team league season published"
            description="The association has not opened a team league season yet."
          />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                <span className="font-sans font-semibold text-foreground">
                  Round {selectedRound.라운드}
                  {selectedRound.포스트여부 === "Y" ? " · Postseason" : ""}
                </span>
                <span className="mx-2 text-border">·</span>
                <span className="font-sans">{englishRoundStatus(selectedRound.진행상황)}</span>
                <span className="mx-2 text-border">·</span>
                {selectedRound.시작일자} → {selectedRound.종료일자}
              </p>
              <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {visibleFixtures.length} {visibleFixtures.length === 1 ? "fixture" : "fixtures"}
              </p>
            </div>

            <FixtureList
              fixtures={visibleFixtures}
              clubs={clubs}
              season={season.시즌코드}
              round={String(selectedRound.라운드코드)}
              emptyTitle="No fixtures published for this filter"
              emptyDescription="Try another club or round above."
            />
          </>
        )}
      </div>
    </>
  );
}
