import type { Metadata } from "next";
import Link from "next/link";
import { getRanking, getRankingTours, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import { PLAYER_LEAGUES, leagueByCode } from "@/lib/normalize";
import { cleanDisplayText, cleanPlayerName, grouped, wonCompact, pick } from "@/lib/format";
import { asset, isRealAsset } from "@/lib/pba/http";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { RankingTable, type RankingCutline } from "@/components/domain/ranking-table";
import { PlayerAvatar, NationPlate } from "@/components/ui/media";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "@/components/ui/follow-button";
import { EmptyState, RankBadge } from "@/components/ui/primitives";

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
  const [seasons, currentSeason] = await Promise.all([getSeasonList(), getCurrentSeason()]);

  const leagueCode = PLAYER_LEAGUES.some((l) => l.code === params.league) ? params.league! : "PBA1";
  const league = leagueByCode(leagueCode);
  const season =
    params.season && seasons.some((s) => s.SeasonCode === params.season)
      ? params.season
      : currentSeason.SeasonCode;
  const requestedTour = params.tour && /^\d{1,6}$/.test(params.tour) ? params.tour : "0";
  const metric = params.metric === "point" ? "point" : "prize";

  const { tours, rows, tourCode, failures } = await trackFailures(async () => {
    const tours = await getRankingTours({ leagueCode, season });
    const validTour =
      requestedTour !== "0" && tours.some((t) => String(t.TourCode) === requestedTour)
        ? requestedTour
        : "0";
    const [rawRows, pointRows] = await Promise.all([
      getRanking({
        kind: metric === "point" ? "point" : "prize",
        leagueCode,
        season,
        tourCode: validTour,
      }),
      metric === "prize"
        ? getRanking({ kind: "point", leagueCode, season, tourCode: validTour })
        : Promise.resolve([]),
    ]);
    const imgByCode = new Map(
      pointRows.filter((r) => r.ImgURL).map((r) => [r.MemCode, r.ImgURL]),
    );
    const rows = rawRows.map((r) =>
      r.ImgURL ? r : { ...r, ImgURL: imgByCode.get(r.MemCode) ?? r.ImgURL },
    );
    return { tours, rows, tourCode: validTour, failures: getRequestFailures() };
  });

  const podium = rows.slice(0, 3);
  const matchedTour = tours.find((t) => String(t.TourCode) === tourCode);
  const tourName = matchedTour ? cleanDisplayText(matchedTour.TourTitleEn || matchedTour.TourTitle) : "";

  // PBA-specific qualification & survival cutlines (full-season tables only).
  const isFullSeason = tourCode === "0";
  const cutlines: RankingCutline[] = [];
  let stakesSummary: string | null = null;
  if (isFullSeason) {
    if ((leagueCode === "PBA1" || leagueCode === "LPBA1") && metric === "prize") {
      const cutRow = rows[31];
      stakesSummary = `World Championship race: Top 32 in full-season prize money qualify${
        cutRow ? ` (current #32 cutline: ${wonCompact(cutRow.Prize)})` : ""
      }.`;
      if (rows.length > 32) {
        cutlines.push({
          afterIndex: 32,
          label: `▲ Top 32 · World Championship qualification cutline${cutRow ? ` (${wonCompact(cutRow.Prize)})` : ""}`,
          tone: "carom",
        });
      }
    } else if (leagueCode === "PBA1" && metric === "point") {
      const cutRow = rows[59];
      stakesSummary = `Division 1 tour survival: Top ~60 in season ranking points retain their PBA Tour card; lower finishers enter Q-School${
        cutRow ? ` (current #60: ${grouped(cutRow.RankingPoint)} pts)` : ""
      }.`;
      if (rows.length > 60) {
        cutlines.push({
          afterIndex: 60,
          label: `▲ Top 60 · PBA Tour retention cutline · Below enters Q-School${cutRow ? ` (${grouped(cutRow.RankingPoint)} pts)` : ""}`,
          tone: "rose",
        });
      }
    } else if (leagueCode === "PBA2") {
      const cutRow = rows[19];
      stakesSummary = `Dream Tour promotion: Top 20 earn direct promotion to the 1st-division PBA Tour; the next tier advances to Q-School${
        cutRow
          ? ` (current #20: ${metric === "prize" ? wonCompact(cutRow.Prize) : `${grouped(cutRow.RankingPoint)} pts`})`
          : ""
      }.`;
      if (rows.length > 20) {
        cutlines.push({
          afterIndex: 20,
          label: "▲ Top 20 · Direct promotion to PBA Division 1",
          tone: "amber",
        });
      }
    }
  }

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
              params={{ season, metric }}
              options={PLAYER_LEAGUES.map((l) => ({ value: l.code, label: l.name }))}
            />
            <FilterRow
              label="Metric"
              basePath="/rankings"
              paramKey="metric"
              active={metric}
              params={{ league: leagueCode, season, tour: tourCode !== "0" ? tourCode : undefined }}
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
            params={{ league: leagueCode, metric }}
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
                    value: String(tour.TourCode),
                    label: label.length > 24 ? `${label.slice(0, 22).trimEnd()}…` : label,
                  };
                }),
              ]}
            />
          )}
        </div>
      </PageHeader>

      <div className="wrap py-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No ranking published"
            description="No ranking table has been released for this combination of circuit, season and event."
            action={
              <Link
                href={`/rankings?league=${leagueCode}`}
                className="mt-1 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
              >
                Reset filters
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-3.5 sm:grid-cols-3">
              {podium.map((row, index) => {
                const displayName = cleanPlayerName(pick(row.PlayerNameEN, row.PlayerNameKO));
                const avatarSrc = isRealAsset(row.ImgURL) ? asset(row.ImgURL) : null;
                return (
                  <div
                    key={row.MemCode}
                    className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
                  >
                    <Link
                      href={`/players/${row.MemCode}`}
                      className="flex min-w-0 flex-1 items-center gap-3 hover:no-underline"
                    >
                      <RankBadge rank={row.Rank || index + 1} />
                      <PlayerAvatar
                        path={row.ImgURL}
                        src={avatarSrc}
                        name={displayName}
                        size="md"
                        ring={index === 0}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground group-hover:underline">
                          {displayName}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <NationPlate code={row.NationCode} />
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {metric === "prize"
                              ? `${grouped(row.RankingPoint)} pts`
                              : wonCompact(row.Prize)}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge
                        variant={index === 0 ? "default" : "secondary"}
                        className="font-mono text-[11px] tabular-nums"
                      >
                        {metric === "prize" ? wonCompact(row.Prize) : `${grouped(row.RankingPoint)}`}
                      </Badge>
                      <FollowButton
                        player={{
                          code: row.MemCode,
                          name: displayName,
                          circuit: league.name,
                          nation: row.NationCode,
                        }}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {stakesSummary && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
                <p>
                  <strong className="font-semibold text-foreground">PBA Stakes:</strong> {stakesSummary}
                </p>
                <Link href="/about#rules" className="shrink-0 font-medium text-[var(--pba)] hover:underline">
                  How PBA rankings work →
                </Link>
              </div>
            )}

            <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  Full Standings
                  <span className="ml-2 font-mono text-xs font-normal tabular-nums text-muted-foreground">
                    {rows.length} players
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">Official # rank stays pinned when sorting</p>
              </div>
              <RankingTable
                key={`${season}-${leagueCode}-${tourCode}-${metric}`}
                rows={rows}
                metric={metric}
                searchable
                nationFilter
                cutlines={cutlines}
                className="rounded-none border-0"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
