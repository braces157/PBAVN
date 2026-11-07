import { Chip, cn } from "@/components/ui/primitives";
import type { AnalysedSet, ComparisonRow, MatchSummary } from "@/lib/match";

const TONES = ["text-lime-400", "text-cyan-450", "text-amber-450", "text-violet-450"];

/**
 * The scoreboard head: who played, who won, and the set scores in order.
 *
 * Set scores are shown as a strip rather than a sentence because a carom
 * follower reads a match by its set line, the same way a tennis follower does.
 */
export function MatchHeader({
  analysed,
  summary,
  round,
  eventTitle,
  eventHref,
  officialUrl,
  watchUrl,
  live,
}: {
  analysed: AnalysedSet[];
  summary: MatchSummary;
  round: string | null;
  eventTitle: string | null;
  eventHref: string | null;
  officialUrl: string;
  watchUrl: string | null;
  live: boolean;
}) {
  const sides = analysed[0]?.sides.length ?? 2;
  const names = Array.from({ length: sides }, (_, index) => analysed[0]?.sides[index]?.name ?? "");
  const decided = summary.setsWon.some((won) => won * 2 > analysed.length) && analysed.length > 0;

  return (
    <section className="surface overflow-hidden" aria-label="Match card">
      <div className="grid-field border-b border-ink-800 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Match card</p>
          {round && <Chip tone="neutral">{round}</Chip>}
          {/* A finished match already names its round, so this says what the
              reader wants to know rather than repeating it. */}
          {live ? <Chip tone="rose">Live</Chip> : decided && <Chip tone="gold">Result</Chip>}
          {summary.playedOn && <span className="tnum text-[11px] text-fog-600">{summary.playedOn}</span>}
        </div>

        {eventTitle && (
          <p className="mt-2 text-[13px] text-fog-400">
            {eventHref ? (
              <a href={eventHref} className="text-fog-200 underline-offset-4 hover:text-lime-400 hover:underline">
                {eventTitle}
              </a>
            ) : (
              eventTitle
            )}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 divide-x divide-ink-800">
        {names.map((name, index) => (
          <div key={`${name}-${index}`} className="px-5 py-4">
            <dt className={cn("truncate text-[12.5px] font-semibold", TONES[index] ?? "text-fog-300")}>
              {name || `Player ${index + 1}`}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="tnum font-display text-[34px] font-bold leading-none text-fog-100">
                {summary.setsWon[index] ?? 0}
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.1em] text-fog-600">sets</span>
            </dd>
          </div>
        ))}
      </dl>

      {analysed.length > 0 && (
        <div className="border-t border-ink-800 px-5 py-3">
          <p className="eyebrow">Set scores</p>
          <ol className="tnum mt-2 flex flex-wrap gap-1.5">
            {analysed.map((set) => (
              <li
                key={set.setNo}
                className="rounded-md border border-ink-750 bg-ink-850 px-2 py-1 text-[12px] text-fog-300"
              >
                <span className="mr-1.5 text-[10px] text-fog-600">{set.setNo}</span>
                {set.sides.map((side, index) => (
                  <span
                    key={side.index}
                    className={cn(
                      index > 0 && "ml-1 text-ink-500",
                      side.won ? "font-semibold text-fog-100" : "",
                    )}
                  >
                    {index > 0 && "–"}
                    {side.points}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 px-5 py-3">
        {watchUrl ? (
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-md border border-live-500/40 bg-live-500/10 px-3 py-1.5 text-[12.5px] font-semibold text-live-400 transition-colors hover:bg-live-500/15"
          >
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Watch this match
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <a
          href={officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-md border border-ink-700 px-3 py-1.5 text-[12.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
        >
          Official sheet
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

/** Match totals as published, with the stronger side of each row marked. */
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
      <div className="border-b border-ink-800 px-4 py-3">
        <p className="eyebrow">Match totals</p>
        <p className="mt-1 text-[11.5px] text-fog-500">
          Published by the scoring terminal for the whole match.
        </p>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <caption className="sr-only">Match totals, {names.join(" against ")}</caption>
        <thead>
          <tr className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-fog-600">
            <th scope="col" className="px-4 py-2 text-left font-semibold">
              <span className="sr-only">Statistic</span>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-lime-400">
              {names[0] || "Player 1"}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-cyan-450">
              {names[1] || "Player 2"}
            </th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-ink-800/70">
              <th scope="row" className="px-4 py-2 text-left font-medium text-fog-500">
                {row.label}
              </th>
              <td
                className={cn(
                  "px-3 py-2 text-right",
                  row.better === "left" ? "font-semibold text-fog-100" : "text-fog-400",
                )}
              >
                {row.left}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right",
                  row.better === "right" ? "font-semibold text-fog-100" : "text-fog-400",
                )}
              >
                {row.right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
