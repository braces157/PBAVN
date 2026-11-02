import { cn } from "@/components/ui/primitives";
import type { AnalysedSet } from "@/lib/match";

/**
 * One set, one row per inning, both players side by side.
 *
 * This is the turn-by-turn record the association's scoring terminal keeps and
 * the tour API never exposed: what each player scored on their own visit, how
 * they scored it, and where the set turned. The 1-point and 2-point columns are
 * hidden on phones so the running score survives at 390px; the inning totals
 * are what a reader follows.
 */
export function InningTable({ set }: { set: AnalysedSet }) {
  if (!set.hasTurns || set.sides.length < 2) return null;

  const [first, second] = set.sides;
  const tone = ["text-lime-400", "text-cyan-450"];

  const columns = [
    { key: "1P", label: "1P", hidden: true },
    { key: "2P", label: "2P", hidden: true },
    { key: "run", label: "Run", hidden: false },
    { key: "total", label: "Tot", hidden: false },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11.5px]">
        <caption className="sr-only">
          Turn by turn scoring for set {set.setNo}: {first.name} against {second.name}, one row per
          inning.
        </caption>
        <thead>
          <tr className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-fog-600">
            <th scope="col" className="sticky left-0 z-10 bg-ink-900 px-2 py-1.5 text-left">
              Inn
            </th>
            {columns.map((column) => (
              <th
                key={`first-${column.key}`}
                scope="col"
                className={cn(
                  "px-1.5 py-1.5 text-right font-semibold",
                  column.hidden && "hidden sm:table-cell",
                  tone[0],
                )}
              >
                {column.label}
              </th>
            ))}
            {columns.map((column) => (
              <th
                key={`second-${column.key}`}
                scope="col"
                className={cn(
                  "px-1.5 py-1.5 text-right font-semibold",
                  column.hidden && "hidden sm:table-cell",
                  tone[1],
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum">
          {set.sides[0].turns.map((turn, index) => {
            const other = set.sides[1].turns[index];
            // Dim an inning only when neither player scored on their visit.
            const blank = turn.empty && (other?.empty ?? true);
            return (
              <tr
                key={turn.inning}
                className={cn("border-t border-ink-800/70", blank && "opacity-60")}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-ink-900 px-2 py-1 text-left font-medium text-fog-500"
                >
                  {turn.inning}
                </th>
                <td className={cn("px-1.5 py-1 text-right", turn.onePoint ? "text-fog-200" : "text-fog-600", "hidden sm:table-cell")}>
                  {turn.onePoint || "·"}
                </td>
                <td className={cn("px-1.5 py-1 text-right", turn.twoPoint ? "text-fog-200" : "text-fog-600", "hidden sm:table-cell")}>
                  {turn.twoPoint || "·"}
                </td>
                <td
                  className={cn(
                    "px-1.5 py-1 text-right font-semibold",
                    turn.empty ? "text-fog-600" : "text-lime-300",
                  )}
                >
                  {turn.empty ? "—" : turn.scored}
                </td>
                <td className="px-1.5 py-1 text-right text-fog-300">{turn.total}</td>
                <td className={cn("px-1.5 py-1 text-right", other?.onePoint ? "text-fog-200" : "text-fog-600", "hidden sm:table-cell")}>
                  {other?.onePoint || "·"}
                </td>
                <td className={cn("px-1.5 py-1 text-right", other?.twoPoint ? "text-fog-200" : "text-fog-600", "hidden sm:table-cell")}>
                  {other?.twoPoint || "·"}
                </td>
                <td
                  className={cn(
                    "px-1.5 py-1 text-right font-semibold",
                    other?.empty === false ? "text-cyan-450" : "text-fog-600",
                  )}
                >
                  {other?.empty === false ? other.scored : "—"}
                </td>
                <td className="px-1.5 py-1 text-right text-fog-300">{other?.total ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink-700 text-[10.5px] font-semibold text-fog-500">
            <th scope="row" className="sticky left-0 z-10 bg-ink-900 px-2 py-1.5 text-left">
              Sum
            </th>
            <td className="hidden px-1.5 py-1.5 text-right sm:table-cell">{first.ones}</td>
            <td className="hidden px-1.5 py-1.5 text-right sm:table-cell">{first.twos}</td>
            <td className="px-1.5 py-1.5 text-right text-fog-200">{first.points}</td>
            <td className="px-1.5 py-1.5 text-right text-fog-400">{first.innings}</td>
            <td className="hidden px-1.5 py-1.5 text-right sm:table-cell">{second.ones}</td>
            <td className="hidden px-1.5 py-1.5 text-right sm:table-cell">{second.twos}</td>
            <td className="px-1.5 py-1.5 text-right text-fog-200">{second.points}</td>
            <td className="px-1.5 py-1.5 text-right text-fog-400">{second.innings}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
