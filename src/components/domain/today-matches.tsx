/**
 * One day of matches, as a list.
 *
 * The shape mirrors a football score page's day block: the match on the left,
 * the score in a fixed right-hand column, and the event it belongs to underneath.
 * Three states share one row so a reader does not re-learn the layout per block:
 * a result shows sets, a match on the table shows a live mark, and a fixture that
 * has not started yet shows its kickoff.
 */

import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { SafeImage } from "@/components/ui/safe-image";
import type { DayBoard, DayMatch } from "@/lib/pba/matches-on-day";
import { leagueShort } from "@/lib/normalize";
import { leagueTagTone } from "./scoreboard";
import { MatchFilters } from "./match-filters";

export function TodayMatches({
  board,
  className,
}: {
  board: DayBoard;
  className?: string;
}) {
  if (board.matches.length === 0) {
    return (
      <div className={cn("px-3 py-3", className)}>
        <p className="text-[12px] leading-relaxed text-fog-450">
          No match is scheduled or recorded on this date.
          {board.events.length > 0 && (
            <>
              {" "}
              <span className="text-fog-300">{board.events[0].title}</span> is on
              {board.events.length > 1 ? ` (and ${board.events.length - 1} more)` : ""} — matches
              appear here as soon as the draw or fixture list is published.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <MatchFilters className={className} matches={board.matches.map((match) => ({
      key: match.key, state: match.state, row: <MatchLine key={match.key} match={match} />,
    }))} />
  );
}

function MatchLine({ match }: { match: DayMatch }) {
  const drawn = match.homeWon && match.awayWon;
  const upcoming = match.state !== "final";
  const body = (
    <>
      <span className="flex w-[42px] shrink-0 flex-col items-start gap-0.5">
        {match.state === "live" ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase leading-none tracking-[0.06em] text-live-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Live
          </span>
        ) : (
          <span className="tnum text-[11px] font-semibold leading-none text-fog-400">
            {match.clock ?? "—"}
          </span>
        )}
        <span
          className={cn(
            "truncate text-[9px] font-bold uppercase leading-none tracking-[0.06em]",
            match.state === "live" ? "text-live-400/70" : "text-fog-600",
          )}
        >
          {shortRound(match.round)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <SideRow
          name={match.home}
          memCode={match.homeMemCode}
          won={match.homeWon && !drawn}
          dim={!upcoming && !match.homeWon && !drawn}
          average={upcoming ? null : match.homeAverage}
          highRun={upcoming ? null : match.homeHighRun}
        />
        <SideRow
          name={match.away}
          memCode={match.awayMemCode}
          won={match.awayWon && !drawn}
          dim={!upcoming && !match.awayWon && !drawn}
          average={upcoming ? null : match.awayAverage}
          highRun={upcoming ? null : match.awayHighRun}
        />
      </span>

      <span className="flex shrink-0 flex-col items-end justify-center gap-[3px]">
        <ScoreCell value={upcoming ? null : match.homeSets} won={match.homeWon} />
        <ScoreCell value={upcoming ? null : match.awaySets} won={match.awayWon} />
      </span>
    </>
  );

  return (
    <li>
      {match.href ? (
        <Link
          href={match.href}
          className="row-hover flex items-start gap-2.5 px-3 py-2"
          aria-label={`${match.home} against ${match.away}`}
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-2.5 px-3 py-2">{body}</div>
      )}
      {match.event && (
        <p className="-mt-1 flex items-baseline gap-1.5 px-3 pb-2 pl-[55px] text-[11px]">
          <span
            className={cn(
              "shrink-0 font-semibold uppercase tracking-[0.06em]",
              leagueTagTone(match.event.league),
            )}
          >
            {leagueShort(match.event.league)}
          </span>
          <Link
            href={`/schedule/${match.event.id}`}
            className="min-w-0 truncate text-fog-400 transition-colors hover:text-fog-200"
          >
            {match.event.title}
          </Link>
        </p>
      )}
    </li>
  );
}

function ScoreCell({ value, won }: { value: number | null; won: boolean }) {
  return (
    <span
      className={cn(
        "score-cell flex h-[18px] items-center text-[13px]",
        value === null ? "text-fog-600" : won ? "text-fog-100" : "text-fog-500",
      )}
    >
      {value ?? "–"}
    </span>
  );
}

function SideRow({
  name,
  memCode,
  won,
  dim,
  average,
  highRun,
}: {
  name: string;
  memCode: string | null;
  won: boolean;
  dim: boolean;
  average: number | null;
  highRun: number | null;
}) {
  return (
    <span className="flex h-[20px] items-center gap-1.5">
      <span
        className="grid h-[18px] w-[20px] shrink-0 place-items-center overflow-hidden rounded-[3px] bg-ink-800"
        aria-hidden="true"
      >
        <SafeImage
          path={memCode ? `/players/PBA/small/${memCode}.jpg` : null}
          width={40}
          alt=""
          className="h-full w-full object-cover object-top"
          fallback={<span className="text-[7.5px] font-bold text-fog-600">{initials(name)}</span>}
        />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] leading-none",
          won ? "font-semibold text-fog-100" : dim ? "text-fog-500" : "text-fog-200",
        )}
      >
        {name}
      </span>
      {average !== null && (
        <span className="tnum hidden shrink-0 text-[9.5px] text-fog-600 sm:inline">
          {average.toFixed(3)}
          {highRun !== null ? ` · HR ${highRun}` : ""}
        </span>
      )}
    </span>
  );
}

function shortRound(round: string): string {
  const map: Record<string, string> = {
    Final: "Final",
    "Semi-final": "Semi",
    "Quarter-final": "QF",
    "Round of 128": "R128",
    "Round of 64": "R64",
    "Round of 32": "R32",
    "Round of 16": "R16",
    "Team League": "TLG",
  };
  return map[round] ?? round;
}

function initials(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N}\s.]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "–"
  );
}
