import Link from "next/link";
import { Chip, cn } from "@/components/ui/primitives";
import { InningTable } from "./inning-table";
import { ProgressionChart } from "./progression-chart";
import type { AnalysedSet } from "@/lib/match";

const TONES = ["text-lime-400", "text-cyan-450", "text-amber-450", "text-violet-450"];

/**
 * One set: how it finished, how it got there, and every turn in it.
 *
 * The turn table is shown for every set rather than hidden behind a toggle.
 * It is the reason the page exists, and a fan scanning a five-set match wants
 * to compare sets without opening panels.
 */
export function SetPanel({ set }: { set: AnalysedSet }) {
  const winner = set.winner === null ? null : set.sides[set.winner];

  return (
    <section
      id={`set-${set.setNo}`}
      className="surface scroll-mt-24 overflow-hidden"
      aria-labelledby={`set-${set.setNo}-title`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 id={`set-${set.setNo}-title`} className="font-display text-[15px] font-bold text-fog-100">
            Set {set.setNo}
          </h2>
          {set.gameType && (
            <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fog-500">
              {set.target !== null ? `Race to ${set.target}` : set.gameType}
            </span>
          )}
          {set.playedOn && <span className="tnum text-[11px] text-fog-600">{set.playedOn}</span>}
        </div>
        {winner && (
          <Chip tone="lime">
            {winner.name} · {winner.points}
          </Chip>
        )}
      </header>

      <div className="divide-y divide-ink-800">
        {set.sides.map((side, index) => (
          <div key={side.index} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className={cn("font-display text-[13px] font-semibold", TONES[index] ?? "text-fog-200")}>
              {side.name || `Player ${index + 1}`}
            </span>
            {side.broke && (
              <span className="text-[10px] uppercase tracking-[0.08em] text-fog-600">Broke</span>
            )}
            {side.won && <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-lime-400">Won</span>}
            <span className="ml-auto flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-[11.5px] text-fog-500">
              <span className="tnum">
                <span className="text-fog-200">{side.points}</span> pts
              </span>
              <span className="tnum">{side.innings} inn</span>
              <span className="tnum">avg {side.average?.toFixed(3) ?? "—"}</span>
              <span className="tnum">HR {side.highRun ?? "—"}</span>
            </span>
          </div>
        ))}
      </div>

      {set.hasTurns ? (
        <div className="border-t border-ink-800 px-4 py-3">
          <ProgressionChart
            innings={set.innings}
            target={set.target}
            series={set.sides.map((side, index) => ({
              name: side.name || `Player ${index + 1}`,
              values: side.turns.map((turn) => turn.total),
              tone: TONES[index] ?? "text-fog-400",
            }))}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Turn by turn</p>
            <p className="text-[10.5px] text-fog-600">
              1P and 2P are the points scored on each visit; Tot is the running score.
            </p>
          </div>
          <div className="mt-2 rounded-lg border border-ink-800">
            <InningTable set={set} />
          </div>
        </div>
      ) : (
        <p className="border-t border-ink-800 px-4 py-3 text-[11.5px] text-fog-600">
          The scoring terminal did not publish a turn-by-turn record for this set. The score above is
          what the association recorded.
        </p>
      )}
    </section>
  );
}

/** Jump links so a five-set match does not need scrolling to navigate. */
export function SetNav({ sets }: { sets: AnalysedSet[] }) {
  if (sets.length < 2) return null;
  return (
    <nav aria-label="Sets" className="flex flex-wrap gap-1.5">
      {sets.map((set) => (
        <Link
          key={set.setNo}
          href={`#set-${set.setNo}`}
          className="tnum rounded-lg border border-ink-700 px-3 py-1.5 text-[12.5px] font-medium text-fog-400 transition-colors hover:border-ink-500 hover:text-fog-100"
        >
          Set {set.setNo}
          <span className="ml-1.5 text-[10.5px] text-fog-600">
            {set.sides.map((side) => side.points).join("–")}
          </span>
        </Link>
      ))}
    </nav>
  );
}
