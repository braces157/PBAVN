import type { ReactNode } from "react";
import Link from "next/link";
import { Chip, cn } from "@/components/ui/primitives";
import type { AnalysedSet, ComparisonRow, MatchSummary } from "@/lib/match";

const TONES = ["text-fog-100", "text-fog-100", "text-fog-100", "text-fog-100"];

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
}) {
  const sides = analysed[0]?.sides.length ?? 2;
  const names = Array.from({ length: sides }, (_, index) => analysed[0]?.sides[index]?.name ?? "");
  const setsWon = Array.from({ length: sides }, (_, index) => summary.setsWon[index] ?? 0);
  const decided = setsWon.some((won) => won * 2 > analysed.length) && analysed.length > 0;
  const isFinal = !live && decided;
  const maxWon = Math.max(...setsWon);

  return (
    <section className="surface overflow-hidden" aria-label="Match scorecard">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-750 bg-ink-850 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[12px] font-bold text-fog-100">
            {eventTitle ? (
              eventHref ? (
                <Link href={eventHref} className="transition-colors hover:text-carom-300">
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
          {summary.playedOn && <span className="tnum text-[11px] text-fog-450">{summary.playedOn}</span>}
          {isFinal && <Chip tone="carom">FT</Chip>}
        </div>
      </div>

      {/* Centered Scoreboard */}
      {sides === 2 ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-ink-900 px-4 py-4 sm:gap-5 sm:px-6">
          <div className="min-w-0">
            <dt
              className={cn(
                "truncate font-display text-[15px] font-bold sm:text-[18px]",
                isFinal && setsWon[0] === maxWon ? "text-carom-300" : "text-fog-100",
              )}
            >
              {names[0] || "Player 1"}
            </dt>
            {summary.average[0] !== null && summary.average[0] !== undefined && (
              <dd className="tnum mt-1 text-[11px] text-fog-450">
                AVG {summary.average[0].toFixed(3)} · {summary.totalPoints[0] ?? 0} pts
              </dd>
            )}
          </div>
          <div>
            <dt className="sr-only">Sets score</dt>
            <dd className="flex items-center gap-2 rounded-[6px] border border-ink-750 bg-ink-850 px-3.5 py-2 sm:gap-3 sm:px-4">
              <span
                className={cn(
                  "tnum font-display text-[28px] font-extrabold leading-none sm:text-[36px]",
                  isFinal && setsWon[0] === maxWon ? "text-carom-300" : "text-fog-300",
                )}
              >
                {setsWon[0]}
              </span>
              <span className="text-[18px] font-bold text-fog-550" aria-hidden="true">–</span>
              <span
                className={cn(
                  "tnum font-display text-[28px] font-extrabold leading-none sm:text-[36px]",
                  isFinal && setsWon[1] === maxWon ? "text-carom-300" : "text-fog-300",
                )}
              >
                {setsWon[1]}
              </span>
            </dd>
          </div>
          <div className="min-w-0 text-right">
            <dt
              className={cn(
                "truncate font-display text-[15px] font-bold sm:text-[18px]",
                isFinal && setsWon[1] === maxWon ? "text-carom-300" : "text-fog-100",
              )}
            >
              {names[1] || "Player 2"}
            </dt>
            {summary.average[1] !== null && summary.average[1] !== undefined && (
              <dd className="tnum mt-1 text-[11px] text-fog-450">
                AVG {summary.average[1].toFixed(3)} · {summary.totalPoints[1] ?? 0} pts
              </dd>
            )}
          </div>
        </dl>
      ) : (
        <dl className="grid grid-cols-2 divide-x divide-ink-800 bg-ink-900">
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
                    "max-w-full truncate font-display text-[15px] font-bold sm:text-[17px]",
                    won ? "text-carom-300" : TONES[index] ?? "text-fog-100",
                  )}
                >
                  {name || `Player ${index + 1}`}
                </dt>
                <dd className="mt-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "tnum font-display text-[34px] font-extrabold leading-none",
                      won ? "text-carom-300" : "text-fog-300",
                    )}
                  >
                    {setsWon[index]}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-fog-550">sets</span>
                </dd>
                {avg !== null && avg !== undefined && (
                  <dd className="tnum mt-1.5 text-[11px] text-fog-500">
                    AVG {avg.toFixed(3)} · {summary.totalPoints[index] ?? 0} pts
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      )}

      {analysed.length > 0 && (
        <div className="border-t border-ink-800 px-4 py-3">
          {setNav ? (
            setNav
          ) : (
            <ol className="tnum flex flex-wrap gap-1.5">
              {analysed.map((set) => (
                <li
                  key={set.setNo}
                  className="rounded-md border border-ink-750 bg-ink-850 px-2.5 py-1 text-[11.5px] text-fog-300"
                >
                  <span className="mr-1 text-[10px] font-bold text-fog-550">S{set.setNo}</span>
                  {set.sides.map((side, index) => (
                    <span key={side.index} className={index > 0 ? "ml-1" : undefined}>
                      {index > 0 && <span className="mr-1 text-fog-550">–</span>}
                      <span className={side.won ? "font-bold text-fog-100" : "text-fog-400"}>
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

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 bg-ink-850/40 px-4 py-2.5">
        {watchUrl ? (
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-live-500/45 bg-live-500/12 px-2.5 py-1 text-[11.5px] font-bold text-live-400 transition-colors hover:bg-live-500/20"
          >
            <span aria-hidden="true" className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Watch broadcast <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : null}
        <a
          href={officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
        >
          Official sheet <span aria-hidden="true">↗</span>
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
    <div className="surface overflow-hidden">
      <div className="border-b border-ink-750 bg-ink-850 px-4 py-2.5">
        <h2 className="font-display text-[11.5px] font-bold uppercase tracking-[0.08em] text-fog-100">
          Match Stats
        </h2>
      </div>
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2 text-[11.5px] font-bold text-fog-100">
        <span className="truncate">{names[0] || "Player 1"}</span>
        <span className="truncate text-right">{names[1] || "Player 2"}</span>
      </div>
      <ul className="divide-y divide-ink-800/70">
        {rows.map((row) => {
          const leftNum = parseSingleNumber(String(row.left));
          const rightNum = parseSingleNumber(String(row.right));
          const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum + rightNum > 0;
          const leftPct = bothNumeric ? (leftNum / (leftNum + rightNum)) * 100 : 50;

          return (
            <li key={row.label} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span
                  className={cn(
                    "tnum w-16 text-left",
                    row.better === "left" ? "font-bold text-carom-300" : "text-fog-300",
                  )}
                >
                  {row.left}
                </span>
                <span className="text-center text-[11.5px] font-semibold text-fog-450">{row.label}</span>
                <span
                  className={cn(
                    "tnum w-16 text-right",
                    row.better === "right" ? "font-bold text-carom-300" : "text-fog-300",
                  )}
                >
                  {row.right}
                </span>
              </div>
              {bothNumeric && (
                <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
                  <span
                    className={row.better === "left" ? "bg-carom-400" : "bg-ink-600"}
                    style={{ width: `${leftPct}%` }}
                  />
                  <span
                    className={row.better === "right" ? "bg-carom-400" : "bg-ink-600"}
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
