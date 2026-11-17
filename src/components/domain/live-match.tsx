import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import type { LiveMatch } from "@/lib/pba/live";

export function LiveMatchPanel({ match }: { match: LiveMatch }) {
  const teamLeague = Boolean(match.competition);
  const [home, away] = match.sides;

  return (
    <section className="overflow-hidden rounded-[8px] border border-live-500/45 bg-ink-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 bg-live-500/[0.08] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-live-400">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-live-500" />
            Live
          </span>
          {match.competition && (
            <span className="rounded-[4px] border border-ink-700 bg-ink-850 px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-fog-300">
              {match.competition}
            </span>
          )}
          <span className="text-[11.5px] text-fog-400">
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
              className="press inline-flex items-center gap-1 rounded-md bg-live-500 px-2.5 py-1 text-[11.5px] font-bold text-white transition-colors hover:bg-live-400"
            >
              Watch live ↗
            </a>
          )}
          {match.pstCode && (
            <Link
              href={`/matches/${match.pstCode}?live=1`}
              className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
            >
              Match card →
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-px bg-ink-800 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <FieldSide side={home} index={0} match={match} leading={leads(match, 0)} />

        <div className="flex items-center justify-center bg-ink-950/80 px-6 py-3.5">
          <p className="tnum font-display text-[30px] font-extrabold leading-none text-fog-100">
            <span className={leads(match, 0) ? "text-carom-300" : ""}>{scoreFor(match, 0)}</span>
            <span className="mx-2 text-[18px] font-normal text-fog-600">–</span>
            <span className={leads(match, 1) ? "text-carom-300" : ""}>{scoreFor(match, 1)}</span>
          </p>
        </div>

        <FieldSide side={away} index={1} match={match} leading={leads(match, 1)} align="right" />
      </div>

      {match.bouts && match.bouts.length > 0 && (
        <div className="border-t border-ink-800">
          <div className="flex items-center justify-between gap-2 bg-ink-850 px-4 py-2">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-fog-300">
              Bouts
            </h3>
            <p className="tnum text-[10px] font-semibold uppercase tracking-[0.06em] text-fog-550">
              {match.bouts.filter((bout) => bout.status === "final").length} played ·{" "}
              {match.bouts.filter((bout) => bout.status !== "final").length} remaining
            </p>
          </div>
          <ul className="divide-y divide-ink-800/70">
            {match.bouts.map((bout) => {
              const [left, right] = bout.sides;
              const played = bout.status === "final";
              return (
                <li
                  key={`bout-${bout.setNo}`}
                  className={cn("px-4 py-2", !played && "opacity-75")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-fog-450">
                      Set {bout.setNo}
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-fog-550">
                        {bout.format ?? (played ? "" : "line-up")}
                      </span>
                    </span>
                    <span className="tnum text-[10px] text-fog-550">
                      {bout.playedAt ? bout.playedAt.slice(11) : ""}
                    </span>
                  </div>
                  <div className="mt-1 space-y-[3px]">
                    <BoutSideLine side={left} played={played} />
                    <BoutSideLine side={right} played={played} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="border-t border-ink-800 bg-ink-850/40 px-4 py-2 text-[10.5px] text-fog-550">
        {teamLeague
          ? "Bouts and averages sync from the Team League scoreboard every 20 seconds."
          : "Sets sync from the association scoring terminal every 20 seconds."}
      </p>
    </section>
  );
}

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
        "flex items-center gap-3 bg-ink-900 px-4 py-3",
        align === "right" && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-ink-750 bg-ink-850">
        {side?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={side.logo} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-[11px] font-bold text-fog-450">
            {(side?.name ?? "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-display text-[14.5px] leading-tight",
            leading ? "font-bold text-fog-100" : "font-semibold text-fog-300",
          )}
        >
          {side?.name ?? "—"}
        </p>
        {player && <p className="mt-0.5 truncate text-[11px] text-fog-450">{player}</p>}
        <p className="tnum mt-0.5 text-[11px] text-carom-300">
          {side?.points !== null && side?.points !== undefined ? `${side.points} pts in set` : "On table"}
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
          won ? "font-semibold text-fog-100" : played ? "text-fog-450" : "text-fog-300",
        )}
      >
        {side.name}
      </span>
      <span
        className={cn(
          "tnum shrink-0 text-[11.5px]",
          won ? "font-semibold text-fog-100" : "text-fog-400",
        )}
      >
        {side.points !== null ? `${side.points}P / ${side.innings}` : "–"}
      </span>
      {side.average !== null && (
        <span className="tnum hidden w-[88px] shrink-0 text-right text-[10.5px] text-fog-550 sm:inline">
          {side.average.toFixed(3)}
          {side.highRun !== null ? ` · HR ${side.highRun}` : ""}
        </span>
      )}
      {won && <span className="w-3 shrink-0 text-[9.5px] font-bold uppercase text-carom-300">W</span>}
    </span>
  );
}
