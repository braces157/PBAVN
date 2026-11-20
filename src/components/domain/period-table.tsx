import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { formatPeriodValue, type PeriodCategory, type PeriodStat } from "@/lib/period";

export function PeriodTable({
  rows,
  category,
}: {
  rows: PeriodStat[];
  category: PeriodCategory;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[12.5px] text-fog-450">
        The association has published no {category.label.toLowerCase()} figures for this window.
      </p>
    );
  }

  const showAvg = category.key !== "average";
  const showOnePoints = category.key !== "onePoints";
  const showLongRun = category.key !== "longRunRate";
  const showBankShot = category.key !== "bankShotRate";
  const showFirstShot = category.key !== "firstShotRate";
  const showExpected = category.key !== "expectedPoints";
  const showHighRun = category.key !== "highRun";

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
            <th scope="col" className="!text-carom-300">{category.column}</th>
            {showAvg && (
              <th scope="col" className="hidden sm:table-cell">
                <abbr title="Points per inning" className="no-underline">Avg</abbr>
              </th>
            )}
            <th scope="col" className="hidden sm:table-cell">
              <abbr title="Innings played" className="no-underline">Inn</abbr>
            </th>
            {showOnePoints && (
              <th scope="col" className="hidden md:table-cell">
                <abbr title="1-point shots" className="no-underline">1P</abbr>
              </th>
            )}
            {showLongRun && (
              <th scope="col" className="hidden md:table-cell">
                <abbr title="Long-run rate" className="no-underline">LR%</abbr>
              </th>
            )}
            {showBankShot && (
              <th scope="col" className="hidden lg:table-cell">
                <abbr title="Bank-shot rate" className="no-underline">BS%</abbr>
              </th>
            )}
            {showFirstShot && (
              <th scope="col" className="hidden lg:table-cell">
                <abbr title="First-shot success rate" className="no-underline">1st%</abbr>
              </th>
            )}
            {showExpected && (
              <th scope="col" className="hidden xl:table-cell">
                <abbr title="Expected points per inning" className="no-underline">xPts</abbr>
              </th>
            )}
            {showHighRun && (
              <th scope="col" className="hidden xl:table-cell">
                <abbr title="High run" className="no-underline">HR</abbr>
              </th>
            )}
            <th scope="col">
              <abbr title="Wins and losses" className="no-underline">W–L</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.memCode}>
              <td
                className={cn(
                  "tnum !text-left",
                  index === 0 ? "font-bold text-gold-300" : "text-fog-550",
                )}
              >
                {index + 1}
              </td>
              <td className="!text-left">
                <Link
                  href={`/players/${row.memCode}`}
                  className="block max-w-[190px] truncate text-[12.5px] font-semibold text-fog-100 hover:text-carom-300"
                >
                  {row.name}
                </Link>
              </td>
              <td className="tnum font-bold text-carom-300">
                {formatPeriodValue(category.unit, category.value(row))}
              </td>
              {showAvg && (
                <td className="tnum hidden text-fog-300 sm:table-cell">
                  {formatPeriodValue("avg", row.average)}
                </td>
              )}
              <td className="tnum hidden text-fog-400 sm:table-cell">{row.innings.toLocaleString("en-US")}</td>
              {showOnePoints && (
                <td className="tnum hidden text-fog-300 md:table-cell">{row.onePoints.toLocaleString("en-US")}</td>
              )}
              {showLongRun && (
                <td className="tnum hidden text-fog-300 md:table-cell">
                  {formatPeriodValue("pct", row.longRunRate)}
                </td>
              )}
              {showBankShot && (
                <td className="tnum hidden text-fog-300 lg:table-cell">
                  {formatPeriodValue("pct", row.bankShotRate)}
                </td>
              )}
              {showFirstShot && (
                <td className="tnum hidden text-fog-300 lg:table-cell">
                  {formatPeriodValue("pct", row.firstShotRate)}
                </td>
              )}
              {showExpected && (
                <td className="tnum hidden text-fog-300 xl:table-cell">
                  {formatPeriodValue("num", row.expectedPoints)}
                </td>
              )}
              {showHighRun && (
                <td className="tnum hidden text-fog-300 xl:table-cell">{row.highRun}</td>
              )}
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
