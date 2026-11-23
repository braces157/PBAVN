import type { Metadata } from "next";
import Link from "next/link";
import { getPeriodStats, getSeasonLeaders, getTourHistory, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import {
  getCurrentSeason,
  getPlayerNameIndex,
  getSeasonList,
  resolveKoreanName,
  resolveTourLabels,
} from "@/lib/pba/service";
import { LEADER_CATEGORIES, leagueShort } from "@/lib/normalize";
import {
  PERIOD_CATEGORIES,
  normalizePeriodStat,
  periodCategory,
  periodWindow,
  rankPeriod,
  seasonWindow,
} from "@/lib/period";
import { cleanPlayerName, grouped, hasHangul, percent } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { PeriodTable } from "@/components/domain/period-table";
import { EmptyState, SectionHeading, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Stats & Records",
  description:
    "Season 3-cushion statistical leaders and the full roll of honour for the PBA and LPBA tours — averages, high runs, bank-shot rates and titles.",
};

const CIRCUITS = [
  { value: "PBA1", label: "PBA Tour" },
  { value: "LPBA1", label: "LPBA Tour" },
  { value: "PBA2", label: "Dream Tour" },
];

interface PageProps {
  searchParams: Promise<{ season?: string; circuit?: string; stat?: string }>;
}

export default async function RecordsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const seasons = await getSeasonList();
  const current = await getCurrentSeason();

  const seasonCode =
    params.season && seasons.some((s) => s.SeasonCode === params.season) ? params.season : current.SeasonCode;
  const circuit = CIRCUITS.some((c) => c.value === params.circuit) ? params.circuit! : "PBA1";
  const category = periodCategory(params.stat);
  const window = seasonWindow(seasonCode);

  const { leaders, tours, period, failures } = await trackFailures(async () => {
    const [leaders, tours, period] = await Promise.all([
      getSeasonLeaders({ seasonCode, pbaType: circuit }),
      getTourHistory(),
      getPeriodStats({ startDate: window.startDate, endDate: window.endDate, pbaType: circuit }),
    ]);
    return { leaders, tours, period, failures: getRequestFailures() };
  });

  const ranked = rankPeriod(period.map(normalizePeriodStat), category);
  const nameIndex = getPlayerNameIndex();
  const byCategory = new Map<string, typeof leaders>();
  for (const row of leaders) {
    if (!(Number(row.Value) > 0)) continue;
    const bucket = byCategory.get(row.Category) ?? [];
    bucket.push(row);
    byCategory.set(row.Category, bucket);
  }

  const categories = LEADER_CATEGORIES.filter((cat) => (byCategory.get(cat.key)?.length ?? 0) > 0).map((cat) => ({
    ...cat,
    rows: (byCategory.get(cat.key) ?? []).sort((a, b) => a.Rank - b.Rank).slice(0, 5),
  }));

  const seasonTours = tours
    .filter((tour) => String(tour.시즌코드) === seasonCode)
    .sort((a, b) => (a.투어시작일자 < b.투어시작일자 ? 1 : -1));

  const rollOfHonour = tours
    .filter((tour) => tour.우승자)
    .sort((a, b) => (a.투어종료일자 < b.투어종료일자 ? 1 : -1))
    .slice(0, 40);

  const seasonLabels = resolveTourLabels(
    seasonTours.map((tour) => ({ title: tour.투어명, champion: tour.우승자, code: tour.투어코드 })),
  );
  const honourLabels = resolveTourLabels(
    rollOfHonour.map((tour) => ({ title: tour.투어명, champion: tour.우승자, code: tour.투어코드 })),
  );

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Statistics"
        title="Tour Statistics & Leaders"
        description="3-cushion category leaders, period form tables, and tournament champions."
      >
        <div className="flex flex-col gap-2">
          <FilterRow
            label="Season"
            basePath="/records"
            paramKey="season"
            active={seasonCode}
            params={{ circuit, stat: category.key }}
            options={seasons.map((s) => ({ value: s.SeasonCode, label: s.SeasonTitle || s.SeasonCode }))}
          />
          <FilterRow
            label="Circuit"
            basePath="/records"
            paramKey="circuit"
            active={circuit}
            params={{ season: seasonCode, stat: category.key }}
            options={CIRCUITS}
          />
        </div>
      </PageHeader>

      <div className="wrap py-6">
        <SectionHeading
          eyebrow="Category leaders"
          title="Season Statistical Leaders"
          description="Top five in each recorded 3-cushion category."
        />

        {categories.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No leader data published"
            description="No category leaders have been released for this season and circuit yet."
          />
        ) : (
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((cat) => (
              <div key={cat.key} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-baseline justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
                  <p className="text-sm font-semibold text-foreground">{cat.label}</p>
                </div>
                <ul className="divide-y divide-border/60">
                  {cat.rows.map((row) => (
                    <li key={`${cat.key}-${row.MemCode}-${row.Rank}`}>
                      <Link
                        href={`/players/${row.MemCode}`}
                        className="group flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-accent/50 hover:no-underline"
                      >
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[11px] font-semibold tabular-nums",
                            row.Rank === 1
                              ? "bg-foreground text-background"
                              : "text-muted-foreground",
                          )}
                        >
                          {row.Rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground group-hover:underline">
                          {(() => {
                            const rawName = cleanPlayerName(row.MemNameEn || row.MemName);
                            return hasHangul(rawName) ? resolveKoreanName(rawName, nameIndex) : rawName;
                          })()}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                          {formatValue(cat.unit, row.Value)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <section className="mt-10">
          <SectionHeading
            eyebrow="Season form"
            title={`${category.label} Leaders`}
            description={`${category.hint} Ranked across ${periodWindow(window.startDate, window.endDate)}.`}
          />
          <div className="mt-4">
            <FilterRow
              label="Metric"
              basePath="/records"
              paramKey="stat"
              active={category.key}
              params={{ season: seasonCode, circuit }}
              options={PERIOD_CATEGORIES.map((item) => ({ value: item.key, label: item.label }))}
            />
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
            {ranked.length > 0 ? (
              <PeriodTable rows={ranked} category={category} />
            ) : (
              <EmptyState
                className="border-0"
                title="No period data published"
                description="No per-player statistics published for this circuit and window."
              />
            )}
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <section className="min-w-0">
            <SectionHeading
              eyebrow="This season"
              title="Events & Champions"
              action={<TextLink href={`/schedule?season=${seasonCode}`}>Schedule</TextLink>}
            />
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              {seasonTours.length > 0 ? (
                <table className="stat-table">
                  <thead>
                    <tr>
                      <th className="!text-left">Tour</th>
                      <th className="!text-left">Champion</th>
                      <th className="hidden sm:table-cell">Circuit</th>
                      <th className="hidden md:table-cell">Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonTours.map((tour, index) => (
                      <tr key={tour.투어코드}>
                        <td className="!text-left">
                          <span className="block max-w-[240px] truncate text-[13px] font-medium text-foreground">
                            {seasonLabels[index]?.title ?? tour.투어명}
                          </span>
                        </td>
                        <td className="!text-left">
                          {seasonLabels[index]?.championCode ? (
                            <Link
                              href={`/players/${encodeURIComponent(seasonLabels[index].championCode!)}`}
                              className="text-[13px] font-semibold text-foreground underline-offset-2 transition-colors hover:underline"
                            >
                              {seasonLabels[index]?.champion || "—"}
                            </Link>
                          ) : (
                            <span className="text-[13px] font-semibold text-foreground">
                              {seasonLabels[index]?.champion || "—"}
                            </span>
                          )}
                        </td>
                        <td className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                          {leagueShort(tour.PBA타입)}
                        </td>
                        <td className="hidden font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                          {tour.투어시작일자} → {tour.투어종료일자}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState className="border-0" title="No events recorded" />
              )}
            </div>
          </section>

          <section className="min-w-0">
            <SectionHeading eyebrow="All time" title="Roll of Honour" />
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              {rollOfHonour.length > 0 ? (
                <table className="stat-table">
                  <thead>
                    <tr>
                      <th className="!text-left">Season</th>
                      <th className="!text-left">Tour</th>
                      <th className="!text-left">Champion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollOfHonour.map((tour, index) => (
                      <tr key={`${tour.투어코드}-h`}>
                        <td className="!text-left font-mono text-xs tabular-nums text-muted-foreground">
                          {tour.시즌코드}
                        </td>
                        <td className="!text-left">
                          <span className="block max-w-[220px] truncate text-[13px] text-muted-foreground">
                            {honourLabels[index]?.title ?? tour.투어명}
                          </span>
                        </td>
                        <td className="!text-left text-[13px] font-semibold text-foreground">
                          {honourLabels[index]?.championCode ? (
                            <Link
                              href={`/players/${encodeURIComponent(honourLabels[index].championCode!)}`}
                              className="underline-offset-2 transition-colors hover:underline"
                            >
                              {honourLabels[index]?.champion || "—"}
                            </Link>
                          ) : (
                            honourLabels[index]?.champion || "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState className="border-0" title="No champions recorded" />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function formatValue(unit: "avg" | "int" | "pct", value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return percent(n);
  return grouped(n);
}
