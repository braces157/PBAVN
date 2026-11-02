import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { formatPeriodValue, type PeriodCategory, type PeriodStat } from "@/lib/period";

/**
 * The season form table: one row per player, ranked by the selected statistic.
 *
 * Supporting columns are shown alongside the ranked one so the table answers
 * "who leads" and "why" in the same glance, which is what a reader does with a
 * stats page. Columns that need a wider viewport are dropped below the
 * breakpoint rather than forcing a horizontal scroll on a phone.
 */
export function PeriodTable({
  rows,
  category,
}: {
  rows: PeriodStat[];
  category: PeriodCategory;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[12.5px] text-fog-500">
        The association has published no {category.label.toLowerCase()} figures for this window.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="stat-table w-full">
        <caption className="sr-only">
          Players ranked by {category.label}. {category.hint}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="!text-left">
              #
            </th>
            <th scope="col" className="!text-left">
              Player
            </th>
            <th scope="col">{category.column}</th>
            <th scope="col" className="hidden sm:table-cell">
              Avg
            </th>
            <th scope="col" className="hidden sm:table-cell">
              Inn
            </th>
            <th scope="col" className="hidden md:table-cell">
              1P
            </th>
            <th scope="col" className="hidden md:table-cell">
              LR%
            </th>
            <th scope="col" className="hidden lg:table-cell">
              BS%
            </th>
            <th scope="col" className="hidden lg:table-cell">
              1st%
            </th>
            <th scope="col" className="hidden xl:table-cell">
              xPts
            </th>
            <th scope="col" className="hidden xl:table-cell">
              HR
            </th>
            <th scope="col">W–L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.memCode}>
              <td
                className={cn(
                  "tnum !text-left",
                  index === 0 ? "font-bold text-gold-400" : "text-fog-600",
                )}
              >
                {index + 1}
              </td>
              <td className="!text-left">
                <Link
                  href={`/players/${row.memCode}`}
                  className="block max-w-[190px] truncate text-[12.5px] text-fog-100 hover:text-lime-300"
                >
                  {row.name}
                </Link>
              </td>
              <td className="tnum font-semibold text-lime-300">
                {formatPeriodValue(category.unit, category.value(row))}
              </td>
              <td className="tnum hidden text-fog-300 sm:table-cell">
                {formatPeriodValue("avg", row.average)}
              </td>
              <td className="tnum hidden text-fog-400 sm:table-cell">{row.innings.toLocaleString("en-US")}</td>
              <td className="tnum hidden text-fog-300 md:table-cell">{row.onePoints.toLocaleString("en-US")}</td>
              <td className="tnum hidden text-fog-300 md:table-cell">
                {formatPeriodValue("pct", row.longRunRate)}
              </td>
              <td className="tnum hidden text-fog-300 lg:table-cell">
                {formatPeriodValue("pct", row.bankShotRate)}
              </td>
              <td className="tnum hidden text-fog-300 lg:table-cell">
                {formatPeriodValue("pct", row.firstShotRate)}
              </td>
              <td className="tnum hidden text-fog-300 xl:table-cell">
                {formatPeriodValue("num", row.expectedPoints)}
              </td>
              <td className="tnum hidden text-fog-300 xl:table-cell">{row.highRun}</td>
              <td className="tnum text-fog-200">
                {row.wins}–{row.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
