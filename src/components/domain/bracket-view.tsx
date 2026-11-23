import Link from "next/link";
import { cn, CountTag } from "@/components/ui/primitives";
import type { BracketMatch } from "@/lib/pba/bracket";

export function BracketView({
  matches,
  tourCode,
  eventSeq,
  maxRounds,
}: {
  matches: BracketMatch[];
  tourCode: string;
  eventSeq: string;
  maxRounds?: number | null;
}) {
  const rounds: { round: string; rows: BracketMatch[] }[] = [];
  for (const match of matches) {
    const bucket = rounds.find((entry) => entry.round === match.round);
    if (bucket) bucket.rows.push(match);
    else rounds.push({ round: match.round, rows: [match] });
  }

  const shown = typeof maxRounds === "number" ? rounds.slice(0, maxRounds) : rounds;

  return (
    <div className="divide-y divide-border/60">
      {shown.map((group) => (
        <section key={group.round}>
          <header className="flex items-center justify-between gap-3 bg-secondary/50 px-4 py-2">
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
              {group.round}
            </h3>
            <CountTag>{group.rows.length}</CountTag>
          </header>
          <ul className="divide-y divide-border/60">
            {group.rows.map((match) => (
              <li key={match.pstCode}>
                <MatchRow
                  match={match}
                  href={`/matches/${match.pstCode}?tour=${encodeURIComponent(tourCode)}&seq=${encodeURIComponent(eventSeq)}&round=${encodeURIComponent(match.round)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MatchRow({ match, href }: { match: BracketMatch; href: string }) {
  const decided = match.sides.some((side) => side.won);
  const stamp = match.scheduledAt;

  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5">
        <div className="row-span-2 flex flex-col justify-center gap-[9px]">
          <i className="ball w" aria-hidden="true" />
          <i className="ball y" aria-hidden="true" />
        </div>
        {match.sides.map((side, index) => {
          const label = (
            <span
              className={cn(
                "flex h-[22px] min-w-0 max-w-full items-center gap-2 text-[13px] leading-none",
                decided && !side.won ? "text-muted-foreground" : "text-foreground",
                side.won && decided && "font-semibold",
              )}
            >
              <span className="min-w-0 truncate">{side.name}</span>
            </span>
          );
          return side.memCode ? (
            <Link
              key={`${side.name}-${index}`}
              href={`/players/${encodeURIComponent(side.memCode)}`}
              className="relative z-[2] w-fit max-w-full rounded-sm transition-colors hover:underline"
            >
              {label}
            </Link>
          ) : (
            <span key={`${side.name}-${index}`}>{label}</span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden w-[104px] flex-col items-end sm:flex">
          {match.sides.map((side, index) => (
            <span
              key={`meta-${index}`}
              className="flex h-[22px] items-center gap-2 font-mono text-[11px] leading-none tabular-nums text-muted-foreground"
            >
              <span className="w-[56px] text-right">
                AVG {side.average !== null ? side.average.toFixed(3) : "—"}
              </span>
              <span className="w-[40px] text-right">HR {side.highRun ?? "—"}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-col items-end">
          {match.sides.map((side, index) => (
            <span
              key={`score-${index}`}
              className={cn(
                "flex h-[22px] w-5 items-center justify-end font-mono text-sm font-semibold tabular-nums",
                side.won ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {side.sets ?? "–"}
            </span>
          ))}
        </div>

        <div className="w-[76px] shrink-0 text-right">
          <p className="font-mono text-[11px] leading-tight tabular-nums text-muted-foreground">No {match.matchNo}</p>
          {stamp && <p className="font-mono text-[10px] leading-tight tabular-nums text-muted-foreground/80">{stamp}</p>}
          {match.table && <p className="text-[10px] leading-tight text-muted-foreground/80">{match.table}</p>}
        </div>
      </div>

      <Link
        href={href}
        aria-label={`Match ${match.matchNo}, ${match.sides.map((side) => side.name).join(" against ")}`}
        className="absolute inset-0 z-[1] rounded-sm focus-visible:z-[3]"
      />
    </div>
  );
}
