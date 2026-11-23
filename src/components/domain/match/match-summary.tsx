import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Radio } from "lucide-react";
import { Chip, cn } from "@/components/ui/primitives";
import type { AnalysedSet, ComparisonRow, MatchSummary } from "@/lib/match";

const TONES = ["text-foreground", "text-foreground", "text-foreground", "text-foreground"];

function parseSingleNumber(value: string): number {
  const trimmed = value.trim().replace(/%$/, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

export function MatchHeader({
  analysed,
  summary,
  round,
  eventTitle,
  eventHref,
  officialUrl,
  watchUrl,
  live = false,
  setNav,
  playerCodes,
}: {
  analysed: AnalysedSet[];
  summary: MatchSummary;
  round: string | null;
  eventTitle: string | null;
  eventHref: string | null;
  officialUrl: string;
  watchUrl: string | null;
  live?: boolean;
  setNav?: ReactNode;
  playerCodes?: (string | null)[];
}) {
  const sides = analysed[0]?.sides.length ?? 2;
  const names = Array.from({ length: sides }, (_, index) => analysed[0]?.sides[index]?.name ?? "");
  const setsWon = Array.from({ length: sides }, (_, index) => summary.setsWon[index] ?? 0);
  const decided = setsWon.some((won) => won * 2 > analysed.length) && analysed.length > 0;
  const isFinal = !live && decided;
  const maxWon = Math.max(...setsWon);
  const h2hHref =
    sides === 2 && playerCodes?.[0] && playerCodes?.[1]
      ? `/compare?a=${encodeURIComponent(playerCodes[0])}&b=${encodeURIComponent(playerCodes[1])}`
      : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Match scorecard">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">
            {eventTitle ? (
              eventHref ? (
                <Link href={eventHref} className="transition-colors hover:underline">
                  {eventTitle}
                </Link>
              ) : (
                eventTitle
              )
            ) : (
              names.filter(Boolean).join(" vs ") || "Match Scorecard"
            )}
          </h1>
          {round && <Chip tone="neutral">{round}</Chip>}
        </div>
        <div className="flex items-center gap-2">
          {summary.playedOn && <span className="font-mono text-xs tabular-nums text-muted-foreground">{summary.playedOn}</span>}
          {isFinal && <Chip tone="carom">FT</Chip>}
        </div>
      </div>

      {/* Centered Scoreboard */}
      {sides === 2 ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-card px-4 py-5 sm:gap-5 sm:px-6">
          <div className="min-w-0">
            <dt
              className={cn(
                "truncate text-base font-semibold sm:text-lg",
                isFinal && setsWon[0] === maxWon ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
              )}
            >
              {playerCodes?.[0] ? (
                <Link
                  href={`/players/${encodeURIComponent(playerCodes[0])}`}
                  className="underline-offset-2 transition-colors hover:underline"
                >
                  {names[0] || "Player 1"}
                </Link>
              ) : (
                names[0] || "Player 1"
              )}
            </dt>
            {summary.average[0] !== null && summary.average[0] !== undefined && (
              <dd className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                AVG {summary.average[0].toFixed(3)} · {summary.totalPoints[0] ?? 0} pts
              </dd>
            )}
          </div>
          <div>
            <dt className="sr-only">Sets score</dt>
            <dd className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3.5 py-2 sm:gap-3 sm:px-4">
              <span
                className={cn(
                  "tnum font-mono text-3xl font-semibold leading-none tabular-nums sm:text-4xl",
                  isFinal && setsWon[0] === maxWon ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                )}
              >
                {setsWon[0]}
              </span>
              <span className="text-lg font-medium text-muted-foreground" aria-hidden="true">–</span>
              <span
                className={cn(
                  "tnum font-mono text-3xl font-semibold leading-none tabular-nums sm:text-4xl",
                  isFinal && setsWon[1] === maxWon ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                )}
              >
                {setsWon[1]}
              </span>
            </dd>
          </div>
          <div className="min-w-0 text-right">
            <dt
              className={cn(
                "truncate text-base font-semibold sm:text-lg",
                isFinal && setsWon[1] === maxWon ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
              )}
            >
              {playerCodes?.[1] ? (
                <Link
                  href={`/players/${encodeURIComponent(playerCodes[1])}`}
                  className="underline-offset-2 transition-colors hover:underline"
                >
                  {names[1] || "Player 2"}
                </Link>
              ) : (
                names[1] || "Player 2"
              )}
            </dt>
            {summary.average[1] !== null && summary.average[1] !== undefined && (
              <dd className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                AVG {summary.average[1].toFixed(3)} · {summary.totalPoints[1] ?? 0} pts
              </dd>
            )}
          </div>
        </dl>
      ) : (
        <dl className="grid grid-cols-2 divide-x divide-border/60 bg-card">
          {names.map((name, index) => {
            const won = decided && setsWon[index] === maxWon;
            const avg = summary.average[index];
            return (
              <div
                key={`${name}-${index}`}
                className={cn(
                  "flex flex-col justify-between px-4 py-4 sm:px-5",
                  index % 2 === 1 ? "items-end text-right" : "items-start text-left",
                )}
              >
                <dt
                  className={cn(
                    "max-w-full truncate text-base font-semibold",
                    won ? "text-emerald-600 dark:text-emerald-400" : TONES[index] ?? "text-foreground",
                  )}
                >
                  {playerCodes?.[index] ? (
                    <Link
                      href={`/players/${encodeURIComponent(playerCodes[index]!)}`}
                      className="underline-offset-2 transition-colors hover:underline"
                    >
                      {name || `Player ${index + 1}`}
                    </Link>
                  ) : (
                    name || `Player ${index + 1}`
                  )}
                </dt>
                <dd className="mt-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-mono text-3xl font-semibold leading-none tabular-nums",
                      won ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {setsWon[index]}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">sets</span>
                </dd>
                {avg !== null && avg !== undefined && (
                  <dd className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                    AVG {avg.toFixed(3)} · {summary.totalPoints[index] ?? 0} pts
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      )}

      {analysed.length > 0 && (
        <div className="border-t border-border/60 px-4 py-3">
          {setNav ? (
            setNav
          ) : (
            <ol className="flex flex-wrap gap-1.5 font-mono tabular-nums">
              {analysed.map((set) => (
                <li
                  key={set.setNo}
                  className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <span className="mr-1 text-[10px] font-semibold">S{set.setNo}</span>
                  {set.sides.map((side, index) => (
                    <span key={side.index} className={index > 0 ? "ml-1" : undefined}>
                      {index > 0 && <span className="mr-1 text-muted-foreground/60">–</span>}
                      <span className={side.won ? "font-semibold text-foreground" : "text-muted-foreground"}>
                        {side.points}
                      </span>
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-secondary/30 px-4 py-2.5">
        {watchUrl ? (
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/20 hover:no-underline dark:text-rose-400"
          >
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            Watch broadcast
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : null}
        {h2hHref && (
          <Link
            href={h2hHref}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
          >
            Compare H2H
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
        <a
          href={officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
        >
          Official sheet
          <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      </div>
    </section>
  );
}

export function MatchTotals({
  rows,
  names,
}: {
  rows: ComparisonRow[];
  names: string[];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Match Stats</h2>
      </div>
      <div className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-2 text-xs font-semibold text-foreground">
        <span className="truncate">{names[0] || "Player 1"}</span>
        <span className="truncate text-right">{names[1] || "Player 2"}</span>
      </div>
      <ul className="divide-y divide-border/60">
        {rows.map((row) => {
          const leftNum = parseSingleNumber(String(row.left));
          const rightNum = parseSingleNumber(String(row.right));
          const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum + rightNum > 0;
          const leftPct = bothNumeric ? (leftNum / (leftNum + rightNum)) * 100 : 50;

          return (
            <li key={row.label} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={cn(
                    "w-16 text-left font-mono tabular-nums",
                    row.better === "left" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {row.left}
                </span>
                <span className="text-center text-xs font-medium text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    "w-16 text-right font-mono tabular-nums",
                    row.better === "right" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {row.right}
                </span>
              </div>
              {bothNumeric && (
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                  <span
                    className={row.better === "left" ? "bg-emerald-500" : "bg-muted-foreground/30"}
                    style={{ width: `${leftPct}%` }}
                  />
                  <span
                    className={row.better === "right" ? "bg-emerald-500" : "bg-muted-foreground/30"}
                    style={{ width: `${100 - leftPct}%` }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
