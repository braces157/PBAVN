import type { ReactNode } from "react";
import Link from "next/link";
import { Chip, cn } from "@/components/ui/primitives";
import type { AnalysedSet, ComparisonRow, MatchSummary } from "@/lib/match";

const TONES = ["text-fog-100", "text-fog-100", "text-fog-100", "text-fog-100"];

export function MatchHeader({
  analysed,
  summary,
  round,
  eventTitle,
  eventHref,
  officialUrl,
  watchUrl,
  setNav,
}: {
  analysed: AnalysedSet[];
  summary: MatchSummary;
  round: string | null;
  eventTitle: string | null;
  eventHref: string | null;
  officialUrl: string;
  watchUrl: string | null;
  setNav?: ReactNode;
}) {
  const sides = analysed[0]?.sides.length ?? 2;
  const names = Array.from({ length: sides }, (_, index) => analysed[0]?.sides[index]?.name ?? "");
  const setsWon = Array.from({ length: sides }, (_, index) => summary.setsWon[index] ?? 0);
  const decided = setsWon.some((won) => won * 2 > analysed.length) && analysed.length > 0;
  const maxWon = Math.max(...setsWon);

  return (
    <section className="surface overflow-hidden" aria-label="Match scorecard">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-750 bg-ink-850 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {eventTitle ? (
            eventHref ? (
              <Link href={eventHref} className="text-[12px] font-bold text-fog-100 transition-colors hover:text-carom-300">
                {eventTitle}
              </Link>
            ) : (
              <span className="text-[12px] font-bold text-fog-100">{eventTitle}</span>
            )
          ) : (
            <span className="text-[12px] font-bold text-fog-100">Match Scorecard</span>
          )}
          {round && <Chip tone="neutral">{round}</Chip>}
        </div>
        <div className="flex items-center gap-2">
          {summary.playedOn && <span className="tnum text-[11px] text-fog-450">{summary.playedOn}</span>}
          {decided && <Chip tone="carom">FT</Chip>}
        </div>
      </div>

      {/* Centered FotMob/HLTV Scoreboard */}
      {sides === 2 ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-ink-900 px-4 py-4 sm:gap-5 sm:px-6">
          <div className="min-w-0">
            <dt
              className={cn(
                "truncate font-display text-[15px] font-bold sm:text-[18px]",
                decided && setsWon[0] === maxWon ? "text-carom-300" : "text-fog-100",
              )}
            >
              {names[0] || "Player 1"}
            </dt>
            {summary.average[0] !== null && summary.average[0] !== undefined && (
              <p className="tnum mt-1 text-[11px] text-fog-450">
                AVG {summary.average[0].toFixed(3)} · {summary.totalPoints[0] ?? 0} pts
              </p>
            )}
          </div>
          <dd className="flex items-center gap-2 rounded-[6px] border border-ink-750 bg-ink-850 px-3.5 py-2 sm:gap-3 sm:px-4">
            <span
              className={cn(
                "tnum font-display text-[28px] font-extrabold leading-none sm:text-[36px]",
                decided && setsWon[0] === maxWon ? "text-carom-300" : "text-fog-300",
              )}
            >
              {setsWon[0]}
            </span>
            <span className="text-[18px] font-bold text-fog-550">–</span>
            <span
              className={cn(
                "tnum font-display text-[28px] font-extrabold leading-none sm:text-[36px]",
                decided && setsWon[1] === maxWon ? "text-carom-300" : "text-fog-300",
              )}
            >
              {setsWon[1]}
            </span>
          </dd>
          <div className="min-w-0 text-right">
            <dt
              className={cn(
                "truncate font-display text-[15px] font-bold sm:text-[18px]",
                decided && setsWon[1] === maxWon ? "text-carom-300" : "text-fog-100",
              )}
            >
              {names[1] || "Player 2"}
            </dt>
            {summary.average[1] !== null && summary.average[1] !== undefined && (
              <p className="tnum mt-1 text-[11px] text-fog-450">
                AVG {summary.average[1].toFixed(3)} · {summary.totalPoints[1] ?? 0} pts
              </p>
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
                  <span className="tnum mt-1.5 text-[11px] text-fog-500">
                    AVG {avg.toFixed(3)} · {summary.totalPoints[index] ?? 0} pts
                  </span>
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
                    <span
                      key={side.index}
                      className={cn(index > 0 && "ml-1 text-ink-500", side.won ? "font-bold text-fog-100" : "")}
                    >
                      {index > 0 && "–"}
                      {side.points}
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
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Watch broadcast ↗
          </a>
        ) : null}
        <a
          href={officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
        >
          Official sheet ↗
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
      <dl className="divide-y divide-ink-800/70">
        {rows.map((row) => {
          const leftNum = parseFloat(String(row.left).replace(/[^0-9.]/g, ""));
          const rightNum = parseFloat(String(row.right).replace(/[^0-9.]/g, ""));
          const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum + rightNum > 0;
          const leftPct = bothNumeric ? (leftNum / (leftNum + rightNum)) * 100 : 50;

          return (
            <div key={row.label} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <dd
                  className={cn(
                    "tnum w-16 text-left",
                    row.better === "left" ? "font-bold text-carom-300" : "text-fog-300",
                  )}
                >
                  {row.left}
                </dd>
                <dt className="text-center text-[11.5px] font-semibold text-fog-450">{row.label}</dt>
                <dd
                  className={cn(
                    "tnum w-16 text-right",
                    row.better === "right" ? "font-bold text-carom-300" : "text-fog-300",
                  )}
                >
                  {row.right}
                </dd>
              </div>
              {bothNumeric && (
                <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-ink-800">
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
            </div>
          );
        })}
      </dl>
    </div>
  );
}
