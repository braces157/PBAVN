import { cn } from "@/components/ui/primitives";
import type { AnalysedSet } from "@/lib/match";

export function InningTable({ set }: { set: AnalysedSet }) {
  if (!set.hasTurns || set.sides.length < 2) return null;

  const [first, second] = set.sides;
  const tone = ["text-carom-300", "text-gold-300"];

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
          <tr className="bg-ink-850/75 text-[9.5px] font-bold uppercase tracking-[0.09em] text-fog-500">
            <th scope="col" className="sticky left-0 z-10 bg-ink-850 px-2.5 py-2 text-left">
              Inn
            </th>
            {columns.map((column) => (
              <th
                key={`first-${column.key}`}
                scope="col"
                className={cn(
                  "px-2 py-2 text-right font-bold",
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
                  "px-2 py-2 text-right font-bold",
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
            const blank = turn.empty && (other?.empty ?? true);
            return (
              <tr
                key={turn.inning}
                className={cn("border-t border-ink-800/70 transition-colors hover:bg-ink-850/50", blank && "opacity-55")}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-ink-900 px-2.5 py-1.5 text-left font-semibold text-fog-450"
                >
                  {turn.inning}
                </th>
                <td className={cn("px-2 py-1.5 text-right", turn.onePoint ? "text-fog-200" : "text-fog-600", "hidden sm:table-cell")}>
                  {turn.onePoint || "·"}
                </td>
                <td className={cn("px-2 py-1.5 text-right", turn.twoPoint ? "text-gold-300 font-semibold" : "text-fog-600", "hidden sm:table-cell")}>
                  {turn.twoPoint || "·"}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold",
                    turn.empty ? "text-fog-600" : "text-carom-300",
                  )}
                >
                  {turn.empty ? "—" : turn.scored}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-fog-200">{turn.total}</td>
                <td className={cn("px-2 py-1.5 text-right", other?.onePoint ? "text-fog-200" : "text-fog-600", "hidden sm:table-cell")}>
                  {other?.onePoint || "·"}
                </td>
                <td className={cn("px-2 py-1.5 text-right", other?.twoPoint ? "text-gold-300 font-semibold" : "text-fog-600", "hidden sm:table-cell")}>
                  {other?.twoPoint || "·"}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold",
                    other?.empty === false ? "text-gold-300" : "text-fog-600",
                  )}
                >
                  {other?.empty === false ? other.scored : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-fog-200">{other?.total ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink-700 bg-ink-850/50 text-[10.5px] font-bold text-fog-400">
            <th scope="row" className="sticky left-0 z-10 bg-ink-850 px-2.5 py-2 text-left">
              Sum
            </th>
            <td className="hidden px-2 py-2 text-right sm:table-cell">{first.ones}</td>
            <td className="hidden px-2 py-2 text-right sm:table-cell">{first.twos}</td>
            <td className="px-2 py-2 text-right text-carom-300">{first.points}</td>
            <td className="px-2 py-2 text-right text-fog-300">{first.innings}</td>
            <td className="hidden px-2 py-2 text-right sm:table-cell">{second.ones}</td>
            <td className="hidden px-2 py-2 text-right sm:table-cell">{second.twos}</td>
            <td className="px-2 py-2 text-right text-gold-300">{second.points}</td>
            <td className="px-2 py-2 text-right text-fog-300">{second.innings}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
