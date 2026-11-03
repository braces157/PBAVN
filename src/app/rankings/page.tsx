import type { Metadata } from "next";
import Link from "next/link";
import { getRanking, getRankingTours, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import { PLAYER_LEAGUES, leagueByCode } from "@/lib/normalize";
import { grouped, wonCompact, pick } from "@/lib/format";
import { asset, isRealAsset } from "@/lib/pba/http";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { RankingTable } from "@/components/domain/ranking-table";
import { PlayerAvatar, NationPlate } from "@/components/ui/media";
import { Chip, EmptyState, RankBadge } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Official PBA and LPBA prize-money and ranking-point tables, filterable by season and tournament.",
};

interface PageProps {
  searchParams: Promise<{ league?: string; season?: string; tour?: string; metric?: string }>;
}

export default async function RankingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const seasons = await getSeasonList();
  const currentSeason = await getCurrentSeason();

  const leagueCode = params.league ?? "PBA1";
  const league = leagueByCode(leagueCode);
  const season =
    params.season && seasons.some((s) => s.SeasonCode === params.season)
      ? params.season
      : currentSeason.SeasonCode;
  const tourCode = params.tour ?? "0";
  const metric = params.metric === "point" ? "point" : "prize";

  const { tours, rows, failures } = await trackFailures(async () => {
    const [tours, rows] = await Promise.all([
      getRankingTours({ leagueCode, season }),
      getRanking({ kind: metric === "point" ? "point" : "prize", leagueCode, season, tourCode }),
    ]);
    return { tours, rows, failures: getRequestFailures() };
  });

  const podium = rows.slice(0, 3);
  const tourName = tours.find((t) => t.TourCode === tourCode)?.TourTitleEn;

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Standings"
        title={`${league.name} money list`}
        description={`Prize money and ranking points as published by the association${tourName ? ` for ${tourName}` : " across every event of the season"}.`}
      >
        <div className="flex flex-col gap-4">
          <FilterRow
            label="Circuit"
            basePath="/rankings"
            paramKey="league"
            active={leagueCode}
            params={{ season, tour: tourCode, metric }}
            options={PLAYER_LEAGUES.map((l) => ({ value: l.code, label: l.name }))}
          />
          <FilterRow
            label="Season"
            basePath="/rankings"
            paramKey="season"
            active={season}
            params={{ league: leagueCode, tour: tourCode, metric }}
            options={seasons.map((s) => ({ value: s.SeasonCode, label: s.SeasonTitle || s.SeasonCode }))}
          />
          <FilterRow
            label="Metric"
            basePath="/rankings"
            paramKey="metric"
            active={metric}
            params={{ league: leagueCode, season, tour: tourCode }}
            options={[
              { value: "prize", label: "Prize money" },
              { value: "point", label: "Ranking points" },
            ]}
          />
          {tours.length > 0 && (
            <FilterRow
              label="Event"
              basePath="/rankings"
              paramKey="tour"
              active={tourCode}
              params={{ league: leagueCode, season, metric }}
              options={[
                { value: "0", label: "All events" },
                ...tours.map((tour) => {
                  const label = tour.TourTitleEn || tour.TourTitle;
                  return {
                    value: tour.TourCode,
                    label: label.length > 34 ? `${label.slice(0, 32).trimEnd()}…` : label,
                  };
                }),
              ]}
            />
          )}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {rows.length === 0 ? (
          <EmptyState
            title="No ranking published"
            description="The association has not released a table for this combination of circuit, season and event."
            action={
              <Link
                href={`/rankings?league=${leagueCode}`}
                className="mt-1 rounded-md border border-ink-700 px-3 py-1.5 text-[12.5px] text-fog-300 hover:border-ink-500 hover:text-fog-100"
              >
                Reset filters
              </Link>
            }
          />
        ) : (
          <>
            {/* podium */}
            <div className="grid gap-3 sm:grid-cols-3">
              {podium.map((row, index) => (
                <Link
                  key={row.MemCode}
                  href={`/players/${row.MemCode}`}
                  className="surface card-hover group relative overflow-hidden p-5"
                >
                  {index === 0 && (
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl"
                      style={{ background: "var(--color-gold-400)" }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex items-start justify-between">
                    <RankBadge rank={row.Rank || index + 1} />
                    <Chip tone={index === 0 ? "gold" : "neutral"}>
                      {metric === "prize" ? wonCompact(row.Prize) : `${grouped(row.RankingPoint)} pts`}
                    </Chip>
                  </div>
                  <div className="relative mt-4 flex items-center gap-3">
                    <PlayerAvatar
                      path={row.ImgURL}
                      src={isRealAsset(row.ImgURL) ? asset(row.ImgURL) : null}
                      name={row.PlayerNameEN || row.PlayerNameKO}
                      size="lg"
                      ring={index === 0}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] font-bold text-fog-100 group-hover:text-lime-300">
                        {pick(row.PlayerNameEN, row.PlayerNameKO)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <NationPlate code={row.NationCode} />
                        <span className="tnum text-[11px] text-fog-500">
                          {metric === "prize"
                            ? `${grouped(row.RankingPoint)} pts`
                            : wonCompact(row.Prize)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
                <p className="text-[12px] font-semibold text-fog-300">
                  Full table{" "}
                  <span className="tnum ml-1 font-normal text-fog-600">{rows.length} players</span>
                </p>
                <p className="text-[11px] text-fog-600">
                  {metric === "prize" ? "Sorted by prize money" : "Sorted by ranking points"}
                </p>
              </div>
              <RankingTable rows={rows} metric={metric} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
