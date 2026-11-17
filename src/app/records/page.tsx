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
            params={{ circuit }}
            options={seasons.map((s) => ({ value: s.SeasonCode, label: s.SeasonTitle || s.SeasonCode }))}
          />
          <FilterRow
            label="Circuit"
            basePath="/records"
            paramKey="circuit"
            active={circuit}
            params={{ season: seasonCode }}
            options={CIRCUITS}
          />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((cat) => (
              <div key={cat.key} className="surface overflow-hidden">
                <div className="flex items-baseline justify-between border-b border-ink-750 bg-ink-850 px-3.5 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-fog-100">
                    {cat.label}
                  </p>
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-carom-300">
                    {circuit.startsWith("LPBA") ? "LPBA" : circuit}
                  </span>
                </div>
                <ul className="divide-y divide-ink-800/70">
                  {cat.rows.map((row) => (
                    <li key={`${cat.key}-${row.MemCode}-${row.Rank}`}>
                      <Link
                        href={`/players/${row.MemCode}`}
                        className="row-hover group flex items-center gap-2.5 px-3.5 py-2"
                      >
                        <span
                          className={cn(
                            "tnum grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold",
                            row.Rank === 1 ? "bg-gold-400/15 text-gold-300" : "text-fog-550",
                          )}
                        >
                          {row.Rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fog-200 group-hover:text-carom-300">
                          {(() => {
                            const rawName = cleanPlayerName(row.MemNameEn || row.MemName);
                            return hasHangul(rawName) ? resolveKoreanName(rawName, nameIndex) : rawName;
                          })()}
                        </span>
                        <span className="tnum shrink-0 font-display text-[12.5px] font-bold text-fog-100">
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
          <div className="mt-3 overflow-x-auto rounded-[8px] border border-ink-750 bg-ink-900">
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

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <section className="min-w-0">
            <SectionHeading
              eyebrow="This season"
              title="Events & Champions"
              action={<TextLink href={`/schedule?season=${seasonCode}`}>Schedule</TextLink>}
            />
            <div className="mt-4 overflow-x-auto rounded-[8px] border border-ink-750 bg-ink-900">
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
                          <span className="block max-w-[240px] truncate text-[12.5px] font-medium text-fog-100">
                            {seasonLabels[index]?.title ?? tour.투어명}
                          </span>
                        </td>
                        <td className="!text-left">
                          <span className="text-[12.5px] font-bold text-gold-300">
                            {seasonLabels[index]?.champion || "—"}
                          </span>
                        </td>
                        <td className="hidden text-[11.5px] text-fog-450 sm:table-cell">{leagueShort(tour.PBA타입)}</td>
                        <td className="tnum hidden text-[11.5px] text-fog-500 md:table-cell">
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
            <div className="mt-4 overflow-x-auto rounded-[8px] border border-ink-750 bg-ink-900">
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
                        <td className="tnum !text-left text-[11.5px] text-fog-500">{tour.시즌코드}</td>
                        <td className="!text-left">
                          <span className="block max-w-[220px] truncate text-[12px] text-fog-200">
                            {honourLabels[index]?.title ?? tour.투어명}
                          </span>
                        </td>
                        <td className="!text-left text-[12px] font-bold text-gold-300">
                          {honourLabels[index]?.champion || "—"}
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
