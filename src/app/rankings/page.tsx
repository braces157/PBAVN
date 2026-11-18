import type { Metadata } from "next";
import Link from "next/link";
import { getRanking, getRankingTours, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import { PLAYER_LEAGUES, leagueByCode } from "@/lib/normalize";
import { cleanDisplayText, cleanPlayerName, grouped, wonCompact, pick } from "@/lib/format";
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
        title={`${league.name} Rankings`}
        description={`${metric === "prize" ? "Prize money" : "Ranking points"}${tourName ? ` · ${tourName}` : " · Full season"}`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <FilterRow
              label="Circuit"
              basePath="/rankings"
              paramKey="league"
              active={leagueCode}
              params={{ season, tour: tourCode, metric }}
              options={PLAYER_LEAGUES.map((l) => ({ value: l.code, label: l.name }))}
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
          </div>
          <FilterRow
            label="Season"
            basePath="/rankings"
            paramKey="season"
            active={season}
            params={{ league: leagueCode, tour: tourCode, metric }}
            options={seasons.map((s) => ({ value: s.SeasonCode, label: s.SeasonTitle || s.SeasonCode }))}
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
                  const raw = cleanDisplayText(tour.TourTitleEn || tour.TourTitle)
                    .replace(/Recreation area for Nationals\s*/i, "")
                    .replace(/\b(LPBA|PBA)\s+Championship(\s+20\d{2}(-\d{2})?)?/i, "")
                    .replace(/\bCHAMPIONSHIP\b/gi, "")
                    .replace(/\s+/g, " ")
                    .trim();
                  const label = raw || cleanDisplayText(tour.TourTitleEn || tour.TourTitle);
                  return {
                    value: tour.TourCode,
                    label: label.length > 24 ? `${label.slice(0, 22).trimEnd()}…` : label,
                  };
                }),
              ]}
            />
          )}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        {rows.length === 0 ? (
          <EmptyState
            title="No ranking published"
            description="No ranking table has been released for this combination of circuit, season and event."
            action={
              <Link
                href={`/rankings?league=${leagueCode}`}
                className="mt-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-[12px] font-semibold text-fog-200 hover:border-carom-400/50 hover:text-carom-300"
              >
                Reset filters
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {podium.map((row, index) => (
                <Link
                  key={row.MemCode}
                  href={`/players/${row.MemCode}`}
                  className="surface card-hover group flex items-center gap-3.5 p-4"
                >
                  <RankBadge rank={row.Rank || index + 1} />
                  <PlayerAvatar
                    path={row.ImgURL}
                    src={isRealAsset(row.ImgURL) ? asset(row.ImgURL) : null}
                    name={cleanPlayerName(pick(row.PlayerNameEN, row.PlayerNameKO))}
                    size="md"
                    ring={index === 0}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[14.5px] font-bold text-fog-100 group-hover:text-carom-300">
                      {cleanPlayerName(pick(row.PlayerNameEN, row.PlayerNameKO))}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <NationPlate code={row.NationCode} />
                      <span className="tnum text-[11px] text-fog-450">
                        {metric === "prize"
                          ? `${grouped(row.RankingPoint)} pts`
                          : wonCompact(row.Prize)}
                      </span>
                    </div>
                  </div>
                  <Chip tone={index === 0 ? "gold" : "carom"}>
                    {metric === "prize" ? wonCompact(row.Prize) : `${grouped(row.RankingPoint)}`}
                  </Chip>
                </Link>
              ))}
            </div>

            <div className="surface mt-5 overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-750 bg-ink-850 px-4 py-2.5">
                <p className="text-[12px] font-bold text-fog-100">
                  Full Standings{" "}
                  <span className="tnum ml-1.5 font-normal text-fog-500">{rows.length} players</span>
                </p>
                <p className="text-[11px] text-fog-500">Click any column header to sort</p>
              </div>
              <RankingTable rows={rows} metric={metric} className="border-0 rounded-none" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
