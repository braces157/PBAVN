"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFeed, LiveMatch } from "@/lib/pba/live";

const POLL_MS = 20_000;

function MatchRow({ match }: { match: LiveMatch }) {
  // `live=1` tells the card to read past the archive cache, because this match
  // is still being scored.
  const query = new URLSearchParams({ live: "1" });
  if (match.watchUrl) query.set("watch", match.watchUrl);
  const cardHref = `/matches/${match.pstCode}?${query.toString()}`;

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live-500/40 bg-live-500/12 px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-live-400">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
              On table
            </span>
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-fog-600">
              Set {match.latestSet.setNo}
              {match.latestSet.target !== null
                ? ` · race to ${match.latestSet.target}`
                : match.latestSet.gameType
                  ? ` · ${match.latestSet.gameType}`
                  : ""}
            </span>
          </div>

          <dl className="mt-2 space-y-1">
            {match.sides.map((side, index) => (
              <div key={`${side.name}-${index}`} className="flex items-baseline gap-3">
                <dt
                  className={`min-w-0 flex-1 truncate text-[13px] font-medium ${
                    index === 0 ? "text-lime-400" : "text-cyan-450"
                  }`}
                >
                  {side.name || `Player ${index + 1}`}
                </dt>
                <dd className="tnum flex shrink-0 items-baseline gap-2 text-[13px]">
                  <span className="text-fog-100">{side.points}</span>
                  <span className="text-[10.5px] text-fog-600">{side.innings} inn</span>
                  <span className="w-9 text-right text-[11px] text-fog-400">{side.setsWon} sets</span>
                </dd>
              </div>
            ))}
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
          <Link
            href={cardHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
          >
            Card
            <span aria-hidden="true">→</span>
          </Link>
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

export function LiveBoard({ initial, tourCode }: { initial: LiveFeed; tourCode?: string }) {
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
      // A dropped poll is not worth surfacing; the next tick retries.
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

  const onTable = feed.matches.length > 0;
  const reachable = feed.reachable !== false;
  const readable = onTable || feed.lines.length > 0;

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
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

      {onTable ? (
        <ul className="divide-y divide-ink-800">
          {feed.matches.map((match) => (
            <MatchRow key={match.pstCode} match={match} />
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
            No match is being scored right now
          </p>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-fog-500">
            The association&apos;s scoreboard reports no table in play. This panel refreshes every 20
            seconds and will show the score, the set and a broadcast link as soon as a match goes
            live.
          </p>
        </div>
      )}

      <div className="border-t border-ink-800 px-4 py-2.5">
        <p className="text-[10.5px] text-fog-600">Source: {feed.source} · polled every 20s</p>
      </div>
    </div>
  );
}
