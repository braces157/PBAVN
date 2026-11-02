"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFeed } from "@/lib/pba/live";

const POLL_MS = 20_000;

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

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-2.5">
          {feed.available ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live-500/40 bg-live-500/12 px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-live-400">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
              Scoring
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-650 bg-ink-800 px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-fog-600" />
              Idle
            </span>
          )}
          <p className="text-[12px] text-fog-400">Scoreboard wire</p>
        </div>

        <div className="flex items-center gap-3">
          <p className="tnum text-[11px] text-fog-600">
            {refreshing ? "Refreshing…" : `Updated ${lastChecked.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
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

      {feed.available ? (
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
            seconds and will show the wire as soon as a match goes live.
          </p>
        </div>
      )}

      <div className="border-t border-ink-800 px-4 py-2.5">
        <p className="text-[10.5px] text-fog-600">
          Source: {feed.source} · polled every 20s
        </p>
      </div>
    </div>
  );
}
