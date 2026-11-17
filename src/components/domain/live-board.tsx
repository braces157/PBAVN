"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFeed, LiveMatch } from "@/lib/pba/live";
import { LiveMatchPanel } from "./live-match";

const POLL_MS = 20_000;
/** Jitter so every open tab does not hit the wire on the same tick. */
const POLL_JITTER_MS = 4_000;

/**
 * One short line a screen reader can announce when the wire moves.
 *
 * The poll re-renders every 20 seconds, but an aria-live region only announces
 * when its text actually changes — so this string is built from the headline
 * scores alone and stays identical between polls. A quiet terminal is announced
 * once, a score change the moment it lands.
 */
function feedAnnouncement(feed: LiveFeed): string {
  if (feed.matches.length === 0) {
    return feed.reachable !== false
      ? "No match is being scored right now."
      : "The scoring boards are unreachable.";
  }
  const lines = feed.matches.slice(0, 4).map((match) => {
    const [a, b] = match.sides;
    const score = match.fixtureScore ?? [a?.setsWon ?? 0, b?.setsWon ?? 0];
    return `${a?.name || "Home"} ${score[0] ?? 0} to ${score[1] ?? 0}, ${b?.name || "Away"}`;
  });
  return `${feed.matches.length} ${feed.matches.length === 1 ? "match" : "matches"} on: ${lines.join("; ")}`;
}

/** The live feed, re-read every 20 seconds. Every live surface on a page shares
 * this poll so a reader never watches a stale score. */
function useLiveFeed(initial: LiveFeed, tourCode?: string) {
  const [feed, setFeed] = useState<LiveFeed>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date(initial.fetchedAt));
  const mounted = useRef(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/live${tourCode ? `?tour=${encodeURIComponent(tourCode)}` : ""}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const next = (await response.json()) as LiveFeed;
        if (mounted.current && id === requestId.current) {
          setFeed(next);
          setLastChecked(new Date(next.fetchedAt));
        }
      }
    } catch {
      // A dropped poll is not worth surfacing; the next tick retries.
    } finally {
      if (mounted.current && id === requestId.current) setRefreshing(false);
    }
  }, [tourCode]);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A timeout chain rather than an interval, so each tick carries its own
    // jitter and every open tab does not hit the wire on the same beat. Hidden
    // tabs skip their polls; the wire does not need to know the score of a page
    // nobody is looking at.
    const schedule = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") void refresh();
        schedule();
      }, POLL_MS + Math.random() * POLL_JITTER_MS);
    };
    schedule();
    // A tab returning to the foreground gets current scores now, not on the
    // next tick.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      requestId.current++;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { feed, refreshing, lastChecked, refresh };
}

function MatchRow({ match }: { match: LiveMatch }) {
  // `live=1` tells the card to read past the archive cache, because this match
  // is still being scored. A team-league fixture has no scorecard of its own on
  // the tour terminal, so it offers its broadcast and nothing else rather than a
  // link that would open an empty page.
  const teamLeague = Boolean(match.competition);
  const query = new URLSearchParams({ live: "1" });
  if (match.watchUrl) query.set("watch", match.watchUrl);
  const cardHref = teamLeague || !match.pstCode ? null : `/matches/${match.pstCode}?${query.toString()}`;

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live-500/40 bg-live-500/12 px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-live-400">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
              On table
            </span>
            {match.competition && (
              <span className="rounded border border-ink-650 bg-ink-800 px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fog-400">
                {match.competition}
              </span>
            )}
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-fog-600">
              {match.latestSet.setNo > 0 ? `Set ${match.latestSet.setNo}` : "In play"}
              {match.latestSet.target !== null
                ? ` · race to ${match.latestSet.target}`
                : match.latestSet.gameType
                  ? ` · ${match.latestSet.gameType}`
                  : match.venue
                    ? ` · ${match.venue}`
                    : ""}
            </span>
          </div>

          <dl className="mt-2 space-y-1">
            {match.sides.map((side, index) => {
              // A team fixture is a series of bouts: the fixture score is the
              // headline, the bout being played is the detail underneath. For an
              // individual match the set count already is the headline.
              const mine = match.fixtureScore?.[index] ?? side.setsWon ?? 0;
              const theirs = match.fixtureScore?.[1 - index] ?? match.sides[1 - index]?.setsWon ?? 0;
              const leading = mine > theirs;
              return (
                <div key={`${side.name}-${index}`} className="flex items-baseline gap-3">
                  <dt
                    className={`flex min-w-0 flex-1 items-baseline gap-2 truncate text-[13px] ${
                      leading ? "font-semibold text-fog-100" : "text-fog-300"
                    }`}
                  >
                    <span className="truncate">{side.name || `Player ${index + 1}`}</span>
                    {match.players?.[index] && (
                      <span className="hidden shrink-0 truncate text-[10.5px] text-fog-500 sm:inline">
                        {match.players[index]}
                      </span>
                    )}
                  </dt>
                  <dd className="tnum flex shrink-0 items-baseline gap-2 text-[13px]">
                    <span className={leading ? "font-semibold text-lime-400" : "text-fog-200"}>{mine}</span>
                    {match.fixtureScore ? (
                      <span className="w-[74px] text-right text-[10.5px] text-fog-500">
                        {side.points !== null && side.points !== undefined
                          ? `${side.points} pts in set`
                          : ""}
                      </span>
                    ) : (
                      <>
                        {side.innings !== null && side.innings !== undefined && (
                          <span className="text-[10.5px] text-fog-600">{side.innings} inn</span>
                        )}
                        <span className="w-9 text-right text-[11px] text-fog-400">{side.setsWon} sets</span>
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {match.watchUrl && (
            <a
              href={match.watchUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-live-500/40 bg-live-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-live-400 transition-colors hover:bg-live-500/15"
            >
              Watch
              <span aria-hidden="true">↗</span>
            </a>
          )}
          {cardHref && (
            <Link
              href={cardHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
            >
              Card
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>

      {match.completedSets.length > 0 && (
        <p className="tnum mt-2 text-[10.5px] text-fog-600">
          Sets {match.completedSets.map((pair) => pair.join("–")).join(" · ")}
        </p>
      )}
    </li>
  );
}

export function LiveBoard({
  initial,
  tourCode,
  compact = false,
}: {
  initial: LiveFeed;
  tourCode?: string;
  /** Render only the refresh strip, when a full live panel is shown above. */
  compact?: boolean;
}) {
  const { feed, refreshing, lastChecked, refresh } = useLiveFeed(initial, tourCode);

  const onTable = feed.matches.length > 0;
  const reachable = feed.reachable !== false;
  const readable = onTable || feed.lines.length > 0;

  return (
    <div className="surface overflow-hidden">
      {/* Score changes land here for assistive tech; visually the panel is silent. */}
      <p role="status" className="sr-only">
        {feedAnnouncement(feed)}
      </p>
      <div className={compact ? "flex flex-wrap items-center justify-between gap-3 px-4 py-2.5" : "flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3"}>
        <div className="flex items-center gap-2.5">
          {onTable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live-500/40 bg-live-500/12 px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-live-400">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
              {feed.matches.length} on table
            </span>
          ) : reachable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-650 bg-ink-800 px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-fog-600" />
              Idle
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-450/35 bg-rose-450/10 px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-rose-450">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-450" />
              Unreachable
            </span>
          )}
          <p className="text-[12px] text-fog-400">Scoreboard wire</p>
        </div>

        <div className="flex items-center gap-3">
          <p className="tnum text-[11px] text-fog-600">
            {refreshing
              ? "Refreshing…"
              : `Updated ${lastChecked.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {compact ? null : onTable ? (
        <ul className="divide-y divide-ink-800">
          {feed.matches.map((match) => (
            <MatchRow key={match.key} match={match} />
          ))}
        </ul>
      ) : readable ? (
        <ul className="divide-y divide-ink-800">
          {feed.lines.map((line, index) => (
            <li key={`${index}-${line}`} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="tnum w-5 shrink-0 text-[10.5px] text-fog-600">{index + 1}</span>
              <span className="text-[13px] text-fog-200">{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-12 text-center">
          <p className="font-display text-[15px] font-semibold text-fog-200">
            {feed.reachable ? "No match is being scored right now" : "The scoring boards are unreachable"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-fog-500">
            {feed.reachable
              ? "Both scoring boards — the tour terminal and the Team League board — report an idle table. This panel refreshes every 20 seconds and will show the score, the set and a broadcast link as soon as a match goes live."
              : "Neither scoring board answered, so whether a match is on is unknown. This panel refreshes every 20 seconds and will show the score, the set and a broadcast link as soon as a board answers."}
          </p>
        </div>
      )}

      <div className="border-t border-ink-800 px-4 py-2.5">
        <p className="text-[10.5px] text-fog-600">
          Source: {feed.source} · polled every 20s
          {feed.origin === "team-terminal"
            ? " · club names matched to the standings"
            : ""}
        </p>
      </div>
    </div>
  );
}

/** The full live match panels, kept current by the same 20-second poll as the
 * wire. The server snapshot renders first; the poll takes over from there. */
export function LiveMatchBoards({ initial, tourCode }: { initial: LiveFeed; tourCode?: string }) {
  const { feed, refreshing, lastChecked, refresh } = useLiveFeed(initial, tourCode);

  return (
    <div className="space-y-4">
      <p role="status" className="sr-only">
        {feedAnnouncement(feed)}
      </p>
      {feed.matches.map((match) => (
        <LiveMatchPanel key={match.key} match={match} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
        <p className="text-[10.5px] text-fog-600">
          Source: {feed.source} · updated{" "}
          {lastChecked.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
