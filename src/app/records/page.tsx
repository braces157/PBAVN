import type { Metadata } from "next";
import Link from "next/link";
import { getSeasonLeaders, getTourHistory, trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getCurrentSeason, getSeasonList, resolveTourLabels } from "@/lib/pba/service";
import { LEADER_CATEGORIES } from "@/lib/normalize";
import { grouped, percent } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { EmptyState, SectionHeading, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Records",
  description:
    "Season statistical leaders and the full roll of honour for the PBA and LPBA tours — averages, high runs, perfect cues and titles.",
};

const CIRCUITS = [
  { value: "PBA1", label: "PBA Tour" },
  { value: "LPBA1", label: "LPBA Tour" },
  { value: "PBA2", label: "Dream Tour" },
];

interface PageProps {
  searchParams: Promise<{ season?: string; circuit?: string }>;
}

export default async function RecordsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const seasons = await getSeasonList();
  const current = await getCurrentSeason();

  const seasonCode =
    params.season && seasons.some((s) => s.SeasonCode === params.season) ? params.season : current.SeasonCode;
  const circuit = CIRCUITS.some((c) => c.value === params.circuit) ? params.circuit! : "PBA1";

  const { leaders, tours, failures } = await trackFailures(async () => {
    const [leaders, tours] = await Promise.all([
      getSeasonLeaders({ seasonCode, pbaType: circuit }),
      getTourHistory(),
    ]);
    return { leaders, tours, failures: getRequestFailures() };
  });
  const byCategory = new Map<string, typeof leaders>();
  for (const row of leaders) {
    const bucket = byCategory.get(row.Category) ?? [];
    bucket.push(row);
    byCategory.set(row.Category, bucket);
  }

  const categories = LEADER_CATEGORIES.filter((category) => byCategory.has(category.key)).map((category) => ({
    ...category,
    rows: (byCategory.get(category.key) ?? []).sort((a, b) => a.Rank - b.Rank).slice(0, 5),
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
        eyebrow="Record book"
        title="The numbers behind the titles"
        description="Statistical leaders for the selected season, plus every champion the tour has crowned."
      >
        <div className="flex flex-col gap-4">
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

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <SectionHeading
          eyebrow="Leaders"
          title="Season category leaders"
          description="Top five in each recorded statistical category. Categories the association does not publish for this circuit are omitted."
        />

        {categories.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="No leader data published"
            description="The association has not released category leaders for this season and circuit yet."
          />
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => (
              <div key={category.key} className="surface overflow-hidden">
                <div className="flex items-baseline justify-between border-b border-ink-800 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fog-400">
                    {category.label}
                  </p>
                  <span className="text-[9.5px] uppercase tracking-[0.1em] text-fog-600">
                    {circuit.startsWith("LPBA") ? "LPBA" : circuit}
                  </span>
                </div>
                <ul className="divide-y divide-ink-800">
                  {category.rows.map((row) => (
                    <li key={`${category.key}-${row.MemCode}-${row.Rank}`}>
                      <Link
                        href={`/players/${row.MemCode}`}
                        className="group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-ink-850"
                      >
                        <span
                          className={cn(
                            "tnum grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold",
                            row.Rank === 1 ? "bg-gold-400/15 text-gold-400" : "text-fog-600",
                          )}
                        >
                          {row.Rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-fog-200 group-hover:text-lime-300">
                          {row.MemNameEn || row.MemName}
                        </span>
                        <span className="tnum shrink-0 font-display text-[12.5px] font-bold text-fog-100">
                          {formatValue(category.unit, row.Value)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <section className="min-w-0">
            <SectionHeading
              eyebrow="This season"
              title="Events and champions"
              action={<TextLink href={`/schedule?season=${seasonCode}`}>Schedule</TextLink>}
            />
            <div className="mt-5 overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900">
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
                          <span className="block max-w-[240px] truncate text-[12.5px] text-fog-100">
                            {seasonLabels[index]?.title ?? tour.투어명}
                          </span>
                        </td>
                        <td className="!text-left">
                          <span className="text-[12.5px] font-semibold text-gold-400">
                            {seasonLabels[index]?.champion || "—"}
                          </span>
                        </td>
                        <td className="hidden text-[11.5px] text-fog-500 sm:table-cell">{tour.PBA타입}</td>
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
            <SectionHeading eyebrow="All time" title="Roll of honour" />
            <div className="mt-5 overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900">
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
                          <span className="block max-w-[220px] truncate text-[12px] text-fog-300">
                            {honourLabels[index]?.title ?? tour.투어명}
                          </span>
                        </td>
                        <td className="!text-left text-[12px] font-semibold text-gold-400">
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
