"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFeed, LiveMatch } from "@/lib/pba/live";
import { LiveMatchPanel } from "./live-match";

const POLL_MS = 20_000;

function useLiveFeed(initial: LiveFeed, tourCode?: string) {
  const [feed, setFeed] = useState<LiveFeed>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date(initial.fetchedAt));
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/live${tourCode ? `?tour=${encodeURIComponent(tourCode)}` : ""}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const next = (await response.json()) as LiveFeed;
        if (mounted.current) {
          setFeed(next);
          setLastChecked(new Date());
        }
      }
    } catch {
      // Next poll retries cleanly.
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [tourCode]);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { feed, refreshing, lastChecked, refresh };
}

function MatchRow({ match }: { match: LiveMatch }) {
  const teamLeague = Boolean(match.competition);
  const query = new URLSearchParams({ live: "1" });
  if (match.watchUrl) query.set("watch", match.watchUrl);
  const cardHref = teamLeague || !match.pstCode ? null : `/matches/${match.pstCode}?${query.toString()}`;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-live-500/45 bg-live-500/12 px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-live-400">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
              Live
            </span>
            {match.competition && (
              <span className="rounded border border-ink-700 bg-ink-850 px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-fog-300">
                {match.competition}
              </span>
            )}
            <span className="text-[10.5px] uppercase tracking-[0.06em] text-fog-500">
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
              const mine = match.fixtureScore?.[index] ?? side.setsWon ?? 0;
              const theirs = match.fixtureScore?.[1 - index] ?? match.sides[1 - index]?.setsWon ?? 0;
              const leading = mine > theirs;
              return (
                <div key={`${side.name}-${index}`} className="flex items-baseline gap-3">
                  <dt
                    className={`flex min-w-0 flex-1 items-baseline gap-2 truncate text-[13px] ${
                      leading ? "font-bold text-fog-100" : "text-fog-300"
                    }`}
                  >
                    <span className="truncate">{side.name || `Player ${index + 1}`}</span>
                    {match.players?.[index] && (
                      <span className="hidden shrink-0 truncate text-[10.5px] text-fog-500 sm:inline">
                        {match.players[index]}
                      </span>
                    )}
                  </dt>
                  <dd className="tnum flex shrink-0 items-baseline gap-2.5 text-[13px]">
                    <span className={leading ? "font-bold text-carom-300" : "text-fog-200"}>{mine}</span>
                    {match.fixtureScore ? (
                      <span className="w-[74px] text-right text-[10.5px] text-fog-500">
                        {side.points !== null && side.points !== undefined
                          ? `${side.points} pts in set`
                          : ""}
                      </span>
                    ) : (
                      <>
                        {side.innings !== null && side.innings !== undefined && (
                          <span className="text-[10.5px] text-fog-550">{side.innings} inn</span>
                        )}
                        <span className="w-10 text-right text-[11px] text-fog-400">{side.setsWon} sets</span>
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
              className="inline-flex items-center gap-1 rounded-md border border-live-500/45 bg-live-500/12 px-2.5 py-1 text-[11.5px] font-bold text-live-400 transition-colors hover:bg-live-500/20"
            >
              Watch ↗
            </a>
          )}
          {cardHref && (
            <Link
              href={cardHref}
              className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
            >
              Card →
            </Link>
          )}
        </div>
      </div>

      {match.completedSets.length > 0 && (
        <p className="tnum mt-2 text-[10.5px] text-fog-550">
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
  compact?: boolean;
}) {
  const { feed, refreshing, lastChecked, refresh } = useLiveFeed(initial, tourCode);

  const onTable = feed.matches.length > 0;
  const reachable = feed.reachable !== false;
  const readable = onTable || feed.lines.length > 0;

  return (
    <div className="surface overflow-hidden">
      <div
        className={
          compact
            ? "flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
            : "flex flex-wrap items-center justify-between gap-3 border-b border-ink-750 bg-ink-850 px-4 py-2.5"
        }
      >
        <div className="flex items-center gap-2.5">
          {onTable ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-live-500/45 bg-live-500/12 px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.08em] text-live-400">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
              {feed.matches.length} on table
            </span>
          ) : reachable ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.08em] text-fog-450">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-fog-550" />
              Idle
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-450/40 bg-rose-450/12 px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.08em] text-rose-450">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-450" />
              Unreachable
            </span>
          )}
          <p className="font-display text-[11.5px] font-bold uppercase tracking-[0.08em] text-fog-200">
            Live Scoreboard
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="tnum text-[11px] text-fog-550">
            {refreshing
              ? "Syncing…"
              : `Synced ${lastChecked.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300 disabled:opacity-50"
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
              <span className="tnum w-5 shrink-0 text-[10.5px] text-fog-550">{index + 1}</span>
              <span className="text-[13px] text-fog-200">{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="font-display text-[14.5px] font-bold text-fog-100">
            {feed.reachable ? "No match is currently in play" : "Scoring board unreachable"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-fog-450">
            {feed.reachable
              ? "All individual tour and Team League tables are idle. Checks automatically every 20 seconds."
              : "The scoring terminal did not respond. Checks automatically every 20 seconds."}
          </p>
        </div>
      )}

      <div className="border-t border-ink-800 bg-ink-850/40 px-4 py-2">
        <p className="text-[10.5px] text-fog-550">
          Source: {feed.source} · auto-refresh 20s
        </p>
      </div>
    </div>
  );
}

export function LiveMatchBoards({ initial, tourCode }: { initial: LiveFeed; tourCode?: string }) {
  const { feed, refreshing, lastChecked, refresh } = useLiveFeed(initial, tourCode);

  return (
    <div className="space-y-4">
      {feed.matches.map((match) => (
        <LiveMatchPanel key={match.key} match={match} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
        <p className="tnum text-[11px] text-fog-550">
          Source: {feed.source} · synced{" "}
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
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
