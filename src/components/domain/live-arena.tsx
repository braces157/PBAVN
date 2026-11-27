"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, ExternalLink, Radio, RefreshCw } from "lucide-react";
import type { LiveFeed, LiveMatch } from "@/lib/pba/live";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiveArenaAnalytics } from "./live-arena-analytics";

const POLL_MS = 20_000;

export interface LiveArenaUpcomingItem {
  key: string;
  clock: string;
  round: string;
  circuit: string;
  eventTitle: string;
  home: string;
  away: string;
  href: string;
}

function kstCountdown(clock: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!m) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const min = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    const diff = Number(m[1]) * 60 + Number(m[2]) - (h * 60 + min);
    if (diff <= 0 && diff > -15) return "Starting now";
    if (diff <= 0) return `${clock} KST`;
    if (diff < 60) return `Starts in ${diff}m`;
    const hrs = Math.floor(diff / 60);
    const rem = diff % 60;
    return rem > 0 ? `Starts in ${hrs}h ${rem}m` : `Starts in ${hrs}h`;
  } catch {
    return null;
  }
}

export function LiveArena({
  initial,
  upcoming = [],
  eventTitle,
  broadcastLabel,
}: {
  initial: LiveFeed;
  upcoming?: LiveArenaUpcomingItem[];
  eventTitle: string;
  broadcastLabel: string;
}) {
  const [feed, setFeed] = useState<LiveFeed>(initial);
  const [selectedKey, setSelectedKey] = useState<string>(initial.matches[0]?.key ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRefreshing(true);
    try {
      const res = await fetch("/api/live", { cache: "no-store", signal: controller.signal });
      if (res.ok) {
        const next = (await res.json()) as LiveFeed;
        if (!controller.signal.aborted) setFeed(next);
      }
    } catch {
      // Next poll retries
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) void refresh();
    }, POLL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controllerRef.current?.abort();
    };
  }, [refresh]);

  const matches = feed.matches;
  const nextClock = upcoming[0]?.clock ?? "";

  useEffect(() => {
    if (matches.length > 0 || !nextClock) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(kstCountdown(nextClock));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [matches.length, nextClock]);

  const active: LiveMatch | null =
    matches.find((m) => m.key === selectedKey) ?? matches[0] ?? null;
  const activeIdx = active ? matches.findIndex((m) => m.key === active.key) : -1;

  const sideA = active?.sides[0];
  const sideB = active?.sides[1];
  const setsA = active?.fixtureScore ? active.fixtureScore[0] : sideA?.setsWon ?? 0;
  const setsB = active?.fixtureScore ? active.fixtureScore[1] : sideB?.setsWon ?? 0;
  const ptsA = sideA?.points !== null && sideA?.points !== undefined ? sideA.points : setsA;
  const ptsB = sideB?.points !== null && sideB?.points !== undefined ? sideB.points : setsB;

  const nextBatch = nextClock
    ? upcoming.filter((item) => item.clock === nextClock).slice(0, 8)
    : upcoming.slice(0, 8);

  const activeCircuitLabel =
    active?.competition ||
    (active?.circuit === "PBA1"
      ? "PBA Tour"
      : active?.circuit === "LPBA1"
        ? "LPBA Tour"
        : active?.latestSet.target === 15
          ? "PBA Tour"
          : active?.latestSet.target === 11
            ? "LPBA Tour"
            : /\bLPBA\b/i.test(eventTitle)
              ? "LPBA Tour"
              : "PBA Tour");
  const h2hHref =
    sideA?.memCode && sideB?.memCode
      ? `/compare?a=${encodeURIComponent(sideA.memCode)}&b=${encodeURIComponent(sideB.memCode)}`
      : null;

  return (
    <div>
      {/* Full-Bleed Obsidian Broadcast Arena Header */}
      <section className="border-b border-zinc-800 bg-zinc-950 text-zinc-50" aria-label="Live arena overview">
        <div className="wrap py-6 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium">
                {matches.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-red-400">
                    <Radio className="size-3.5" />
                    Live Match Centre · 20s Auto-Sync
                  </span>
                ) : nextClock ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-400" suppressHydrationWarning>
                    <Clock className="size-3.5" />
                    Next Session · {nextClock} KST{countdown ? ` · ${countdown}` : ""}
                  </span>
                ) : (
                  <span className="text-zinc-400">Live Match Centre · 20s Auto-Sync</span>
                )}
              </div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {eventTitle} — Live Arena
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {matches.length > 0
                  ? `${matches.length} live ${matches.length === 1 ? "table" : "tables"} in play · ${broadcastLabel}`
                  : nextBatch.length > 0
                    ? `${nextBatch.length} queued matches for ${nextClock || "today's next session"} · ${broadcastLabel}`
                    : feed.reachable
                      ? `Between tournament sessions · ${broadcastLabel}`
                      : "Scoring terminal did not answer — retrying automatically"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white"
              >
                <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Syncing…" : "Refresh"}
              </Button>
              {active?.watchUrl ? (
                <Button size="sm" variant="destructive" asChild>
                  <a href={active.watchUrl} target="_blank" rel="noreferrer noopener">
                    Watch Stream <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              ) : (
                <Button size="sm" asChild className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200 hover:text-zinc-950">
                  <Link href="/schedule">
                    Full Schedule <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {matches.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Active tables">
              {matches.map((m, idx) => {
                const a = m.sides[0];
                const b = m.sides[1];
                const sA = m.fixtureScore ? m.fixtureScore[0] : a?.setsWon ?? 0;
                const sB = m.fixtureScore ? m.fixtureScore[1] : b?.setsWon ?? 0;
                const pA = a?.points ?? sA;
                const pB = b?.points ?? sB;
                const isSelected = active?.key === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedKey(m.key)}
                    className={`cursor-pointer rounded-xl border p-3.5 text-left transition-colors ${
                      isSelected
                        ? "border-amber-500/60 bg-zinc-900 text-white"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-zinc-400">
                      <span className="inline-flex items-center gap-1.5 text-zinc-200">
                        <Radio className="size-3 text-red-400" />
                        {m.competition ? m.venue || "Team Table" : `Table ${idx + 1}`}
                      </span>
                      <span className="mono">{m.latestSet.setNo > 0 ? `Set ${m.latestSet.setNo}` : "In Play"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{a?.name ?? "Player 1"}</span>
                      <span className="mono font-semibold text-white">
                        {pA} <span className="text-xs font-normal text-zinc-500">({sA})</span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{b?.name ?? "Player 2"}</span>
                      <span className="mono font-semibold text-white">
                        {pB} <span className="text-xs font-normal text-zinc-500">({sB})</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : nextBatch.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Queued next session tables">
              {nextBatch.map((item, idx) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-zinc-400">
                    <span className="text-amber-400">Table {idx + 1} · {item.circuit}</span>
                    <span className="mono text-zinc-200">{item.clock || "KST"}</span>
                  </div>
                  <div className="truncate text-sm font-medium text-white">{item.home}</div>
                  <div className="mt-0.5 truncate text-sm font-medium text-zinc-300">{item.away}</div>
                  <div className="mt-1.5 text-[11px] text-zinc-500">{item.round}</div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Main Focused Live Match Centre */}
      {active && (
        <div className="wrap pt-6">
          <Card className="overflow-hidden" aria-label="Selected live match centre">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  <Radio className="size-3.5" />
                  Live
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="font-semibold text-[var(--pba)]">
                  {activeCircuitLabel}
                </span>
                <span className="text-xs text-muted-foreground">
                  Table {activeIdx + 1}
                  {active.latestSet.setNo > 0 ? ` · Set ${active.latestSet.setNo}` : ""}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                {active.latestSet.target && (
                  <span className="mono text-muted-foreground">Race to {active.latestSet.target}</span>
                )}
                {h2hHref && (
                  <Link href={h2hHref} className="font-medium text-muted-foreground hover:text-foreground hover:underline">
                    Compare H2H
                  </Link>
                )}
                {active.pstCode && (
                  <Link
                    href={`/matches/${active.pstCode}?live=1`}
                    className="font-medium text-[var(--pba)] hover:underline"
                  >
                    Full Scorecard →
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-5 border-b border-border px-6 py-7 text-center sm:grid-cols-[1fr_auto_1fr] sm:text-left">
              <div className="flex min-w-0 flex-col items-center gap-1 sm:items-start">
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {sideA?.memCode ? (
                    <Link
                      href={`/players/${encodeURIComponent(sideA.memCode)}`}
                      className="transition-colors hover:text-[var(--pba)] hover:underline"
                    >
                      {sideA.name}
                    </Link>
                  ) : (
                    sideA?.name ?? "Player 1"
                  )}
                </h2>
                <span className="mono text-xs text-muted-foreground">
                  Sets won: <strong className="text-foreground">{setsA}</strong>
                  {sideA?.innings != null ? ` · ${sideA.innings} inn` : ""}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div className="mono inline-flex items-center gap-3 text-4xl font-semibold sm:text-5xl" aria-live="polite">
                  <span
                    className={`min-w-[66px] rounded-xl border px-4 py-2 text-center ${
                      ptsA > ptsB
                        ? "border-blue-500/40 bg-blue-500/10 text-[var(--pba)]"
                        : "border-border bg-secondary text-foreground"
                    }`}
                  >
                    <RollingNumber value={ptsA} />
                  </span>
                  <span
                    className={`min-w-[66px] rounded-xl border px-4 py-2 text-center ${
                      ptsB > ptsA
                        ? "border-blue-500/40 bg-blue-500/10 text-[var(--pba)]"
                        : "border-border bg-secondary text-foreground"
                    }`}
                  >
                    <RollingNumber value={ptsB} />
                  </span>
                </div>
                <span className="mono text-xs font-medium text-muted-foreground">
                  Sets {setsA} – {setsB}
                  {active.latestSet.setNo > 0 ? ` · Set ${active.latestSet.setNo}` : ""}
                </span>
              </div>

              <div className="flex min-w-0 flex-col items-center gap-1 sm:items-end sm:text-right">
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {sideB?.memCode ? (
                    <Link
                      href={`/players/${encodeURIComponent(sideB.memCode)}`}
                      className="transition-colors hover:text-[var(--pba)] hover:underline"
                    >
                      {sideB.name}
                    </Link>
                  ) : (
                    sideB?.name ?? "Player 2"
                  )}
                </h2>
                <span className="mono text-xs text-muted-foreground">
                  Sets won: <strong className="text-foreground">{setsB}</strong>
                  {sideB?.innings != null ? ` · ${sideB.innings} inn` : ""}
                </span>
              </div>
            </div>

            {/* Set-by-set Box Score */}
            <div className="overflow-x-auto border-b border-border">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {active.completedSets.map((_, i) => (
                      <th key={i} className="text-right">S{i + 1}</th>
                    ))}
                    <th className="text-right">S{active.completedSets.length + 1}</th>
                    <th className="text-right">Sets</th>
                    <th className="text-right">Inn</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1].map((idx) => {
                    const side = active.sides[idx];
                    const sets = active.fixtureScore ? active.fixtureScore[idx] : side?.setsWon ?? 0;
                    const pts = side?.points ?? 0;
                    return (
                      <tr key={idx}>
                        <td className="font-medium text-foreground">
                          {side?.memCode ? (
                            <Link
                              href={`/players/${encodeURIComponent(side.memCode)}`}
                              className="transition-colors hover:text-[var(--pba)] hover:underline"
                            >
                              {side.name}
                            </Link>
                          ) : (
                            side?.name ?? `Player ${idx + 1}`
                          )}
                        </td>
                        {active.completedSets.map((pair, sIdx) => (
                          <td key={sIdx} className="mono text-right">{pair[idx] ?? "—"}</td>
                        ))}
                        <td className="mono text-right font-semibold text-red-600 dark:text-red-400">{pts}</td>
                        <td className="mono text-right font-semibold">{sets}</td>
                        <td className="mono text-right text-muted-foreground">{side?.innings ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <LiveArenaAnalytics
              pstCode={active.pstCode}
              playerNames={[sideA?.name ?? "Player 1", sideB?.name ?? "Player 2"]}
              refreshKey={feed.fetchedAt}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
