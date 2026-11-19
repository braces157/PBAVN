import { cn } from "@/components/ui/primitives";
import type { AnalysedSet } from "@/lib/match";

export function InningTable({ set }: { set: AnalysedSet }) {
  if (!set.hasTurns || set.sides.length < 2) return null;

  const [first, second] = set.sides;
  const tone = ["text-carom-300", "text-[var(--live)]"];

  const columns = [
    { key: "1P", label: "1P", hidden: true },
    { key: "2P", label: "2P", hidden: true },
    { key: "run", label: "Run", hidden: false },
    { key: "total", label: "Tot", hidden: false },
  ];

  const rowCount = Math.max(first.turns.length, second.turns.length);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11.5px]">
        <caption className="sr-only">
          Turn by turn scoring for set {set.setNo}: {first.name} against {second.name}, one row per
          inning.
        </caption>
        <thead>
          <tr className="border-b border-ink-800/70 bg-ink-850/90 text-[10.5px] font-bold">
            <th scope="col" className="sticky left-0 z-10 bg-ink-850 px-2.5 py-1.5 text-left text-fog-500">
              <span className="sr-only">Player</span>
            </th>
            <th colSpan={2} scope="colgroup" className={cn("px-2 py-1.5 text-right sm:hidden", tone[0])}>
              <span className="block truncate">{first.name}</span>
            </th>
            <th colSpan={4} scope="colgroup" className={cn("hidden px-2 py-1.5 text-right sm:table-cell", tone[0])}>
              <span className="block truncate">{first.name}</span>
            </th>
            <th colSpan={2} scope="colgroup" className={cn("px-2 py-1.5 text-right sm:hidden", tone[1])}>
              <span className="block truncate">{second.name}</span>
            </th>
            <th colSpan={4} scope="colgroup" className={cn("hidden px-2 py-1.5 text-right sm:table-cell", tone[1])}>
              <span className="block truncate">{second.name}</span>
            </th>
          </tr>
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
          {Array.from({ length: rowCount }, (_, index) => {
            const turn = first.turns[index];
            const other = second.turns[index];
            const inning = turn?.inning ?? other?.inning ?? index + 1;
            const blank = (turn?.empty ?? true) && (other?.empty ?? true);
            return (
              <tr
                key={inning}
                className={cn(
                  "border-t border-ink-800/70 transition-colors hover:bg-ink-850/50",
                  blank && "bg-ink-950/20",
                )}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-ink-900 px-2.5 py-1.5 text-left font-semibold text-fog-450"
                >
                  {inning}
                </th>
                <td className={cn("px-2 py-1.5 text-right", turn?.onePoint ? "text-fog-200" : "text-fog-550", "hidden sm:table-cell")}>
                  {turn?.onePoint || "·"}
                </td>
                <td className={cn("px-2 py-1.5 text-right", turn?.twoPoint ? "font-semibold text-[var(--gold)]" : "text-fog-550", "hidden sm:table-cell")}>
                  {turn?.twoPoint || "·"}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold",
                    turn && !turn.empty ? tone[0] : "text-fog-550",
                  )}
                >
                  {turn && !turn.empty ? turn.scored : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-fog-200">{turn?.total ?? first.turns.at(-1)?.total ?? 0}</td>
                <td className={cn("px-2 py-1.5 text-right", other?.onePoint ? "text-fog-200" : "text-fog-550", "hidden sm:table-cell")}>
                  {other?.onePoint || "·"}
                </td>
                <td className={cn("px-2 py-1.5 text-right", other?.twoPoint ? "font-semibold text-[var(--gold)]" : "text-fog-550", "hidden sm:table-cell")}>
                  {other?.twoPoint || "·"}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-bold",
                    other && !other.empty ? tone[1] : "text-fog-550",
                  )}
                >
                  {other && !other.empty ? other.scored : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-fog-200">{other?.total ?? second.turns.at(-1)?.total ?? 0}</td>
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
            <td className={cn("px-2 py-2 text-right", tone[0])}>{first.points}</td>
            <td className="px-2 py-2 text-right text-fog-300">{first.innings}</td>
            <td className="hidden px-2 py-2 text-right sm:table-cell">{second.ones}</td>
            <td className="hidden px-2 py-2 text-right sm:table-cell">{second.twos}</td>
            <td className={cn("px-2 py-2 text-right", tone[1])}>{second.points}</td>
            <td className="px-2 py-2 text-right text-fog-300">{second.innings}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
