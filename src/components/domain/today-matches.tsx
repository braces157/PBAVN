import Link from "next/link";
import { Radio } from "lucide-react";
import { cn } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import type { DayBoard, DayMatch, MatchState } from "@/lib/pba/matches-on-day";
import { leagueShort } from "@/lib/normalize";
import { leagueTagTone } from "./scoreboard";

export function TodayMatches({
  board,
  className,
}: {
  board: DayBoard;
  className?: string;
}) {
  if (board.matches.length === 0) {
    return (
      <div className={cn("px-4 py-6 text-center", className)}>
        <p className="text-[13px] font-medium text-fog-300">
          {board.partial
            ? "Live match feed did not respond completely for this date."
            : "No matches recorded for this date."}
        </p>
        {board.events.length > 0 && (
          <p className="mt-1.5 text-[12px] text-fog-450">
            Active event:{" "}
            <Link
              href={`/schedule/${board.events[0].id}`}
              className="font-semibold text-carom-300 hover:underline"
            >
              {board.events[0].title}
            </Link>
            {board.events.length > 1 ? ` (+${board.events.length - 1} more)` : ""}
          </p>
        )}
      </div>
    );
  }

  // Group matches by event so each tournament gets one clean header bar (FotMob pattern).
  const groups: {
    key: string;
    event: DayMatch["event"];
    matches: DayMatch[];
  }[] = [];

  for (const match of board.matches) {
    const key = match.event?.id ?? "other";
    const bucket = groups.find((g) => g.key === key);
    if (bucket) bucket.matches.push(match);
    else groups.push({ key, event: match.event, matches: [match] });
  }

  return (
    <div className={cn("divide-y divide-ink-750", className)}>
      {groups.map((group) => (
        <section key={group.key}>
          {group.event && (
            <header className="flex items-center justify-between gap-2 border-b border-ink-800 bg-ink-850/75 px-3.5 py-2">
              <Link
                href={`/schedule/${group.event.id}`}
                className="flex min-w-0 items-center gap-2 transition-colors hover:text-carom-300"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-[4px] border border-ink-700 bg-ink-900 px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.06em]",
                    leagueTagTone(group.event.league),
                  )}
                >
                  {leagueShort(group.event.league)}
                </span>
                <span className="truncate text-[12px] font-bold text-fog-100 hover:text-carom-300">
                  {group.event.title}
                </span>
              </Link>
              <span className="tnum shrink-0 text-[10.5px] font-semibold text-fog-500">
                {group.matches.length}
              </span>
            </header>
          )}
          <ul className="divide-y divide-ink-800/70">
            {group.matches.map((match) => (
              <MatchLine key={match.key} match={match} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function boardSummary(board: DayBoard): string {
  if (board.matches.length === 0) return "0 matches";
  const count = (value: MatchState) => board.matches.filter((match) => match.state === value).length;
  const finals = count("final");
  const live = count("live");
  const next = count("next");
  const parts = [
    finals > 0 ? `${finals} final` : "",
    live > 0 ? `${live} live` : "",
    next > 0 ? `${next} scheduled` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function MatchLine({ match }: { match: DayMatch }) {
  const drawn = match.homeWon && match.awayWon;
  const upcoming = match.state !== "final";
  const body = (
    <>
      <span className="flex w-[60px] shrink-0 flex-col items-start gap-0.5">
        {match.state === "live" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
            <Radio className="size-3" />
            Live
          </span>
        ) : (
          <span className="mono text-xs font-semibold leading-none text-foreground">
            {match.clock ?? (match.state === "final" ? "FT" : "—")}
          </span>
        )}
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {shortRound(match.round)}
        </span>
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        <SideRow
          name={match.home}
          memCode={match.homeMemCode}
          won={match.homeWon && !drawn}
          dim={!upcoming && !match.homeWon && !drawn}
          average={upcoming ? null : match.homeAverage}
          highRun={upcoming ? null : match.homeHighRun}
          sideIndex={0}
        />
        <SideRow
          name={match.away}
          memCode={match.awayMemCode}
          won={match.awayWon && !drawn}
          dim={!upcoming && !match.awayWon && !drawn}
          average={upcoming ? null : match.awayAverage}
          highRun={upcoming ? null : match.awayHighRun}
          sideIndex={1}
        />
      </span>

      {match.state === "next" ? (
        <Badge variant="outline" className="mono shrink-0 text-[11px]">
          {match.clock ? `${match.clock} KST` : "Scheduled"}
        </Badge>
      ) : (
        <span className="flex w-[28px] shrink-0 flex-col items-end justify-center gap-1">
          <ScoreCell value={match.homeSets} won={match.homeWon} />
          <ScoreCell value={match.awaySets} won={match.awayWon} />
        </span>
      )}
    </>
  );

  return (
    <li>
      {match.href ? (
        <Link
          href={match.href}
          className="row-hover flex items-center gap-3 px-3.5 py-2.5"
          aria-label={`${match.home} against ${match.away}`}
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-2.5">{body}</div>
      )}
    </li>
  );
}

function ScoreCell({ value, won }: { value: number | null; won: boolean }) {
  return (
    <span
      className={cn(
        "score-cell flex h-[18px] items-center text-[14px]",
        value === null
          ? "text-[var(--muted)]"
          : won
            ? "font-bold text-[var(--win)]"
            : "text-[var(--muted)]",
      )}
    >
      {value ?? "–"}
    </span>
  );
}

function SideRow({
  name,
  won,
  dim,
  average,
  highRun,
  sideIndex = 0,
}: {
  name: string;
  memCode: string | null;
  won: boolean;
  dim: boolean;
  average: number | null;
  highRun: number | null;
  sideIndex?: number;
}) {
  return (
    <span className="flex h-[20px] items-center gap-2">
      <i className={sideIndex === 0 ? "ball w" : "ball y"} aria-hidden="true" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] leading-none",
          won ? "font-bold text-[var(--text)]" : dim ? "text-[var(--muted)]" : "font-medium text-[var(--text)]",
        )}
      >
        {name}
      </span>
      {average !== null && (
        <span className="tnum hidden shrink-0 text-[11px] text-[var(--muted)] sm:inline">
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
    "Semi-final": "SF",
    "Quarter-final": "QF",
    "Round of 128": "R128",
    "Round of 64": "R64",
    "Round of 32": "R32",
    "Round of 16": "R16",
    "Team League": "TLG",
  };
  return map[round] ?? round;
}
