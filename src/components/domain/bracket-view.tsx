import Link from "next/link";
import { cn, CountTag } from "@/components/ui/primitives";
import type { BracketMatch } from "@/lib/pba/bracket";

function roundFormatLabel(league: string | undefined, bracketSize: number): string | null {
  if (league === "LPBA1") {
    if (bracketSize >= 64) return "Points format · 25 pts / 50 min";
    if (bracketSize >= 8) return "Best of 5 · 11 / 9 pts";
    return "Best of 7 · 11 / 9 pts";
  }
  if (league === "PBA1" || league === "PBA2" || league === "PBA3") {
    if (bracketSize >= 64) return "Best of 4 + Shootout · 15 pts";
    if (bracketSize >= 8) return "Best of 5 · 15 / 11 pts";
    return "Best of 7 · 15 / 11 pts";
  }
  return null;
}

export function BracketView({
  matches,
  tourCode,
  eventSeq,
  league,
  maxRounds,
}: {
  matches: BracketMatch[];
  tourCode: string;
  eventSeq: string;
  league?: string;
  maxRounds?: number | null;
}) {
  const rounds: { round: string; bracketSize: number; rows: BracketMatch[] }[] = [];
  for (const match of matches) {
    const bucket = rounds.find((entry) => entry.round === match.round);
    if (bucket) bucket.rows.push(match);
    else rounds.push({ round: match.round, bracketSize: match.bracketSize, rows: [match] });
  }

  const shown = typeof maxRounds === "number" ? rounds.slice(0, maxRounds) : rounds;

  return (
    <div className="divide-y divide-border/60">
      {shown.map((group) => {
        const formatNote = roundFormatLabel(league, group.bracketSize);
        const isPointsRound = league === "LPBA1" && group.bracketSize >= 64;
        return (
          <section key={group.round}>
            <header className="flex flex-wrap items-center justify-between gap-2 bg-secondary/50 px-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  {group.round}
                </h3>
                {formatNote && (
                  <span className="text-[11px] text-muted-foreground">· {formatNote}</span>
                )}
              </div>
              <CountTag>{group.rows.length}</CountTag>
            </header>
            <ul className="divide-y divide-border/60">
              {group.rows.map((match) => (
                <li key={match.pstCode}>
                  <MatchRow
                    match={match}
                    isPointsRound={isPointsRound}
                    href={`/matches/${match.pstCode}?tour=${encodeURIComponent(tourCode)}&seq=${encodeURIComponent(eventSeq)}&round=${encodeURIComponent(match.round)}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MatchRow({
  match,
  isPointsRound,
  href,
}: {
  match: BracketMatch;
  isPointsRound: boolean;
  href: string;
}) {
  const decided = match.sides.some((side) => side.won);
  const stamp = match.scheduledAt;
  const isShootout =
    !isPointsRound &&
    decided &&
    match.sides.length === 2 &&
    match.sides[0]?.sets !== null &&
    match.sides[0]?.sets === match.sides[1]?.sets &&
    match.sides[0]?.sets === 2;

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
        <div className="hidden flex-col items-end sm:flex">
          {match.sides.map((side, index) => (
            <span
              key={`meta-${index}`}
              className="flex h-[22px] items-center gap-2.5 whitespace-nowrap font-mono text-[11px] leading-none tabular-nums text-muted-foreground"
            >
              <span className="w-[74px] text-right">
                AVG {side.average !== null ? side.average.toFixed(3) : "—"}
              </span>
              <span className="w-[46px] text-right">HR {side.highRun ?? "—"}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-col items-end">
          {match.sides.map((side, index) => (
            <span
              key={`score-${index}`}
              className={cn(
                "flex h-[22px] min-w-6 items-center justify-end gap-1 whitespace-nowrap font-mono text-sm font-semibold tabular-nums",
                side.won ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {side.sets ?? "–"}
              {isPointsRound && side.sets !== null && (
                <span className="text-[9.5px] font-normal text-muted-foreground">p</span>
              )}
            </span>
          ))}
        </div>

        <div className="w-[78px] shrink-0 text-right">
          <p className="font-mono text-[11px] leading-tight tabular-nums text-muted-foreground">
            No {match.matchNo}
            {isShootout && (
              <span
                title="Decided by sudden-death shootout (2–2 tie)"
                className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-300"
              >
                SO
              </span>
            )}
          </p>
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
