import Link from "next/link";
import { Chip, cn } from "@/components/ui/primitives";
import { InningTable } from "./inning-table";
import { ProgressionChart } from "./progression-chart";
import type { AnalysedSet } from "@/lib/match";

const TONES = ["text-emerald-600 dark:text-emerald-400", "text-amber-600 dark:text-amber-400", "text-sky-600 dark:text-sky-400", "text-violet-600 dark:text-violet-400"];

export function SetPanel({ set }: { set: AnalysedSet }) {
  const winner = set.winner === null ? null : set.sides[set.winner];
  const perfectQSide = set.sides.find(
    (side) => side.won && side.innings === 1 && set.target !== null && side.points >= set.target,
  );
  const isDecider = (set.setNo === 5 || set.setNo === 7) && (set.target === 11 || set.target === 9);

  return (
    <section
      id={`set-${set.setNo}`}
      className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby={`set-${set.setNo}-title`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`set-${set.setNo}-title`} className="text-sm font-semibold text-foreground">
            Set {set.setNo}
          </h3>
          {set.gameType && (
            <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
              {set.target !== null ? `Race to ${set.target}${isDecider ? " · Decider" : ""}` : set.gameType}
            </span>
          )}
          {perfectQSide && (
            <Chip tone="gold" title="Perfect Q: cleared the entire set in 1 single inning (₩10M–₩20M special award)">
              ★ Perfect Q
            </Chip>
          )}
          {set.playedOn && <span className="font-mono text-xs tabular-nums text-muted-foreground">{set.playedOn}</span>}
        </div>
        {winner && (
          <Chip tone="carom">
            {winner.name} · {winner.points}
          </Chip>
        )}
      </header>

      <div className="divide-y divide-border/60">
        {set.sides.map((side, index) => (
          <div key={side.index} className="flex items-baseline gap-3 px-4 py-3">
            <span className={cn("text-sm font-semibold", TONES[index] ?? "text-foreground")}>
              {side.name || `Player ${index + 1}`}
            </span>
            {side.broke && (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Break
              </span>
            )}
            {side.won && (
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Won
              </span>
            )}
            <span className="ml-auto flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{side.points}</span> pts
              </span>
              <span>{side.innings} inn</span>
              <span>avg {side.average?.toFixed(3) ?? "—"}</span>
              <span>HR {side.highRun ?? "—"}</span>
            </span>
          </div>
        ))}
      </div>

      {set.hasTurns ? (
        <div className="border-t border-border/60 px-4 py-4">
          <ProgressionChart
            innings={set.innings}
            target={set.target}
            series={set.sides.map((side, index) => ({
              name: side.name || `Player ${index + 1}`,
              values: side.turns.map((turn) => turn.total),
              tone: TONES[index] ?? "text-muted-foreground",
            }))}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Inning sheet
            </p>
            <p className="text-xs text-muted-foreground">
              1P &amp; 2P bank-shot counts (desktop); Run is inning score and Tot is cumulative score.
            </p>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-border">
            <InningTable set={set} />
          </div>
        </div>
      ) : (
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
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
          className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 font-mono text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-secondary hover:no-underline"
        >
          S{set.setNo}
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            {set.sides.map((side) => side.points).join("–")}
          </span>
        </Link>
      ))}
    </nav>
  );
}
