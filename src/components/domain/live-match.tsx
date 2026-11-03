import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import type { LiveMatch } from "@/lib/pba/live";

/**
 * A live match, at the size a live match deserves.
 *
 * The rest of a scoreboard page is reference material — standings, results,
 * fixtures. The thing a reader opened the page for is the match being scored
 * right now, so it gets the top of the page and the most detail available:
 *
 *   - the two sides with crest, sets won and the score in the bout on the table
 *   - which bout it is, its race format, the table and the venue
 *   - every bout of the fixture that the terminal has listed: format, kickoff,
 *     both line-ups, points over innings, average, high run, and the winner
 *
 * A team fixture is six bouts, so the bout table is the substance of the match;
 * a tour match renders the same frame from its set scores.
 */
export function LiveMatchPanel({ match }: { match: LiveMatch }) {
  const teamLeague = Boolean(match.competition);
  const [home, away] = match.sides;

  return (
    <section className="overflow-hidden rounded-[10px] border border-live-500/35 bg-ink-900">
      {/* ---------------------------------------------------------- header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 bg-live-500/[0.06] px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-live-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Live now
          </span>
          {match.competition && (
            <span className="rounded border border-ink-650 bg-ink-800 px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fog-400">
              {match.competition}
            </span>
          )}
          <span className="text-[11px] text-fog-450">
            {match.latestSet.setNo > 0
              ? `${match.competition ? "Bout" : "Set"} ${match.latestSet.setNo}`
              : "In play"}
            {match.latestSet.target !== null
              ? ` · race to ${match.latestSet.target}`
              : match.latestSet.gameType
                ? ` · ${match.latestSet.gameType}`
                : ""}
            {match.venue ? ` · ${match.venue}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {match.watchUrl && (
            <a
              href={match.watchUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md bg-live-500 px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-live-400"
            >
              Watch live <span aria-hidden="true">↗</span>
            </a>
          )}
          {match.pstCode && (
            <Link
              href={`/matches/${match.pstCode}?live=1`}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
            >
              Match card <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </header>

      {/* ----------------------------------------------------------- field */}
      <div className="grid gap-px bg-ink-800 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <FieldSide side={home} index={0} match={match} leading={leads(match, 0)} />

        <div className="flex items-center justify-center bg-ink-900 px-4 py-3">
          <p className="tnum font-display text-[26px] font-bold leading-none text-fog-100">
            {scoreFor(match, 0)}
            <span className="mx-1.5 text-[18px] font-normal text-fog-600">–</span>
            {scoreFor(match, 1)}
          </p>
        </div>

        <FieldSide side={away} index={1} match={match} leading={leads(match, 1)} align="right" />
      </div>

      {/* ---------------------------------------------------------- bouts */}
      {match.bouts && match.bouts.length > 0 && (
        <div className="border-t border-ink-800">
          <div className="flex items-center justify-between gap-2 bg-ink-850/70 px-3.5 py-1.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog-300">
              Bouts
            </h3>
            <p className="tnum text-[10px] font-semibold uppercase tracking-[0.1em] text-fog-600">
              {match.bouts.filter((bout) => bout.status === "final").length} played ·{" "}
              {match.bouts.filter((bout) => bout.status !== "final").length} to come
            </p>
          </div>
          <ul className="divide-y divide-ink-800/70">
            {match.bouts.map((bout) => {
              const [left, right] = bout.sides;
              const played = bout.status === "final";
              return (
                <li
                  key={`bout-${bout.setNo}`}
                  className={cn("px-3.5 py-1.5", !played && "opacity-70")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-fog-500">
                      Set {bout.setNo}
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-fog-600">
                        {bout.format ?? (played ? "" : "line-up")}
                      </span>
                    </span>
                    <span className="tnum text-[9.5px] text-fog-600">
                      {bout.playedAt ? bout.playedAt.slice(11) : ""}
                    </span>
                  </div>
                  {/* Each side gets its own line: on a phone a four-column bout
                      row truncates both names to nothing. */}
                  <div className="mt-0.5 space-y-[3px]">
                    <BoutSideLine side={left} played={played} />
                    <BoutSideLine side={right} played={played} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="border-t border-ink-800 px-3.5 py-1.5 text-[10px] text-fog-600">
        {teamLeague
          ? "Bouts, formats and per-bout averages are read from the Team League scoring board; read again every 20 seconds."
          : "Scorecard sets are read from the association's scoring terminal; read again every 20 seconds."}
      </p>
    </section>
  );
}

/** The headline score for a side: games for a team fixture, sets for a match. */
function scoreFor(match: LiveMatch, index: number): number {
  return match.fixtureScore?.[index] ?? match.sides[index]?.setsWon ?? 0;
}

function leads(match: LiveMatch, index: number): boolean {
  return scoreFor(match, index) > scoreFor(match, 1 - index);
}

function FieldSide({
  side,
  index,
  match,
  leading,
  align = "left",
}: {
  side: LiveMatch["sides"][number] | undefined;
  index: number;
  match: LiveMatch;
  leading: boolean;
  align?: "left" | "right";
}) {
  const player = match.players?.[index];
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 bg-ink-900 px-3.5 py-3",
        align === "right" && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-ink-800">
        {side?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={side.logo} alt="" className="h-full w-full object-contain p-0.5" />
        ) : (
          <span className="text-[10px] font-bold text-fog-600">
            {(side?.name ?? "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-[14px] leading-tight",
            leading ? "font-semibold text-fog-100" : "text-fog-300",
          )}
        >
          {side?.name ?? "—"}
        </p>
        {player && <p className="mt-0.5 truncate text-[11px] text-fog-500">{player}</p>}
        <p className="tnum mt-0.5 text-[10.5px] text-fog-550">
          {side?.points !== null && side?.points !== undefined ? `${side.points} pts in set` : "on the table"}
        </p>
      </div>
    </div>
  );
}

function BoutSideLine({
  side,
  played,
}: {
  side: { name: string; points: number | null; innings: number | null; average: number | null; highRun: number | null; won: boolean };
  played: boolean;
}) {
  const won = played && side.won;
  return (
    <span className="flex items-baseline gap-2">
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] leading-tight",
          won ? "font-semibold text-fog-100" : played ? "text-fog-500" : "text-fog-300",
        )}
      >
        {side.name}
      </span>
      <span
        className={cn(
          "tnum shrink-0 text-[11px]",
          won ? "font-semibold text-fog-100" : "text-fog-400",
        )}
      >
        {side.points !== null ? `${side.points}P / ${side.innings}` : "–"}
      </span>
      {side.average !== null && (
        <span className="tnum hidden w-[84px] shrink-0 text-right text-[10px] text-fog-600 sm:inline">
          {side.average.toFixed(3)}
          {side.highRun !== null ? ` · HR ${side.highRun}` : ""}
        </span>
      )}
      {won && <span className="w-2.5 shrink-0 text-[9px] font-bold uppercase text-lime-400">W</span>}
    </span>
  );
}
