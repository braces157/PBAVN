import Link from "next/link";
import { Chip, cn } from "@/components/ui/primitives";
import { InningTable } from "./inning-table";
import { ProgressionChart } from "./progression-chart";
import type { AnalysedSet } from "@/lib/match";

const TONES = ["text-[var(--ink)]", "text-[var(--red)]", "text-[var(--cloth)]", "text-[var(--yellow-ink)]"];

export function SetPanel({ set }: { set: AnalysedSet }) {
  const winner = set.winner === null ? null : set.sides[set.winner];

  return (
    <section
      id={`set-${set.setNo}`}
      className="surface scroll-mt-20 overflow-hidden"
      aria-labelledby={`set-${set.setNo}-title`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-750 bg-ink-850 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <h3 id={`set-${set.setNo}-title`} className="font-display text-[14px] font-bold text-fog-100">
            Set {set.setNo}
          </h3>
          {set.gameType && (
            <span className="rounded-[4px] border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-fog-400">
              {set.target !== null ? `Race to ${set.target}` : set.gameType}
            </span>
          )}
          {set.playedOn && <span className="tnum text-[11px] text-fog-550">{set.playedOn}</span>}
        </div>
        {winner && (
          <Chip tone="carom">
            {winner.name} · {winner.points}
          </Chip>
        )}
      </header>

      <div className="divide-y divide-ink-800">
        {set.sides.map((side, index) => (
          <div key={side.index} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className={cn("font-display text-[13.5px] font-bold", TONES[index] ?? "text-fog-200")}>
              {side.name || `Player ${index + 1}`}
            </span>
            {side.broke && (
              <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-fog-450">
                Break
              </span>
            )}
            {side.won && <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-carom-300">Won</span>}
            <span className="ml-auto flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-[11.5px] text-fog-450">
              <span className="tnum">
                <span className="font-semibold text-fog-100">{side.points}</span> pts
              </span>
              <span className="tnum">{side.innings} inn</span>
              <span className="tnum">avg {side.average?.toFixed(3) ?? "—"}</span>
              <span className="tnum">HR {side.highRun ?? "—"}</span>
            </span>
          </div>
        ))}
      </div>

      {set.hasTurns ? (
        <div className="border-t border-ink-800 px-4 py-4">
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
            <p className="eyebrow">Inning sheet</p>
            <p className="text-[10.5px] text-fog-550">
              1P &amp; 2P are points scored per visit; Tot is cumulative score.
            </p>
          </div>
          <div className="mt-2 overflow-hidden rounded-[6px] border border-ink-800">
            <InningTable set={set} />
          </div>
        </div>
      ) : (
        <p className="border-t border-ink-800 px-4 py-3 text-[12px] text-fog-550">
          Turn-by-turn detail was not published for this set.
        </p>
      )}
    </section>
  );
}

export function SetNav({ sets }: { sets: AnalysedSet[] }) {
  if (sets.length < 2) return null;
  return (
    <nav aria-label="Sets" className="flex flex-wrap gap-1.5">
      {sets.map((set) => (
        <Link
          key={set.setNo}
          href={`#set-${set.setNo}`}
          className="tnum rounded-md border border-ink-750 bg-ink-850 px-2.5 py-1 text-[12px] font-semibold text-fog-300 transition-colors hover:border-carom-400/50 hover:text-carom-300"
        >
          S{set.setNo}
          <span className="ml-1.5 text-[11px] text-fog-450">
            {set.sides.map((side) => side.points).join("–")}
          </span>
        </Link>
      ))}
    </nav>
  );
}
