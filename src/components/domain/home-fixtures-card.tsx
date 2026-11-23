"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Radio } from "lucide-react";
import { flagClass } from "@/lib/flag";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HomeCircuit, HomeDaySlice, HomeFixtureRow } from "./home-types";

type CircuitFilter = "ALL" | "PBA" | "LPBA" | "TEAM";

function circuitColor(circuit: HomeCircuit): string {
  if (circuit === "LPBA") return "text-pink-600 dark:text-pink-400";
  if (circuit === "TEAM") return "text-muted-foreground";
  if (circuit === "DREAM") return "text-amber-600 dark:text-amber-400";
  return "text-blue-600 dark:text-blue-400";
}

function shortRound(round: string): string {
  return round
    .replace(/^Round of /i, "R")
    .replace(/^Quarter-final$/i, "QF")
    .replace(/^Semi-final$/i, "SF");
}

export function HomeFixturesCard({
  days,
  teamFallback,
}: {
  days: HomeDaySlice[];
  teamFallback: HomeFixtureRow[];
}) {
  const [dayKey, setDayKey] = useState<HomeDaySlice["key"]>("today");
  const [circuit, setCircuit] = useState<CircuitFilter>("ALL");
  const [liveOnly, setLiveOnly] = useState(false);

  const activeDay = useMemo(
    () => days.find((d) => d.key === dayKey) ?? days[1] ?? days[0],
    [days, dayKey],
  );

  const filteredFixtures = useMemo(() => {
    const source = activeDay?.rows ?? [];
    const base =
      circuit === "TEAM" && source.every((r) => r.circuit !== "TEAM") && !liveOnly
        ? teamFallback
        : source;
    return base.filter((row) => {
      if (liveOnly && row.state !== "live") return false;
      if (circuit !== "ALL" && row.circuit !== circuit) return false;
      return true;
    });
  }, [activeDay, circuit, liveOnly, teamFallback]);

  const liveTotal = useMemo(
    () => (activeDay?.rows ?? []).filter((r) => r.state === "live").length,
    [activeDay],
  );

  return (
    <section aria-label="Daily matches and fixtures">
      {/* Header row with Radix Day Tabs */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Matches &amp; Results
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeDay?.label} · {filteredFixtures.length}{" "}
            {filteredFixtures.length === 1 ? "match" : "matches"}
          </p>
        </div>

        <Tabs value={dayKey} onValueChange={(v) => setDayKey(v as HomeDaySlice["key"])}>
          <TabsList>
            {days.map((d) => (
              <TabsTrigger key={d.key} value={d.key} className="gap-1.5">
                <span>{d.shortLabel}</span>
                {d.rows.length > 0 && (
                  <span className="mono text-[11px] opacity-65">{d.rows.length}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Circuit Tabs + Live Filter */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={circuit} onValueChange={(v) => setCircuit(v as CircuitFilter)}>
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="PBA">PBA</TabsTrigger>
            <TabsTrigger value="LPBA">LPBA</TabsTrigger>
            <TabsTrigger value="TEAM">Team</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant={liveOnly ? "destructive" : "outline"}
          size="sm"
          onClick={() => setLiveOnly((v) => !v)}
          aria-pressed={liveOnly}
          className="h-9 gap-1.5 text-xs"
        >
          <Radio className={`size-3.5 ${liveOnly ? "text-white" : "text-red-500"}`} />
          <span>Live{liveTotal > 0 ? ` (${liveTotal})` : ""}</span>
        </Button>
      </div>

      {/* Clean shadcn Card containing symmetric duel rows */}
      <Card className="overflow-hidden">
        {filteredFixtures.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredFixtures.slice(0, 14).map((row) => {
              const isLive = row.state === "live";
              const isFinal = row.state === "final";
              const isNext = row.state === "next";
              return (
                <Link
                  key={row.key}
                  href={row.href}
                  className="group flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-accent/50 sm:grid sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center sm:gap-3 md:grid-cols-[96px_minmax(0,1fr)_116px] md:px-5"
                >
                  {/* Status / Time + Circuit (top meta row on mobile, left col on sm+) */}
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                    <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                          <Radio className="size-3" />
                          Live
                        </span>
                      ) : isFinal ? (
                        <span className="mono text-xs font-medium text-muted-foreground">FT</span>
                      ) : (
                        <span className="mono text-xs font-semibold text-foreground">
                          {row.clock || "KST"}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium ${circuitColor(row.circuit)}`}>
                        {row.circuitLabel}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground sm:hidden">
                      {shortRound(row.round)}
                    </span>
                  </div>

                  {/* Center: Symmetric 1v1 Duel Spine */}
                  <div className="duel-spine min-w-0">
                    <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                      <span
                        className={`truncate text-sm ${
                          isFinal && row.homeWon
                            ? "font-semibold text-foreground"
                            : isFinal && row.awayWon
                              ? "font-normal text-muted-foreground"
                              : "font-medium text-foreground"
                        }`}
                      >
                        {row.home}
                      </span>
                      <i className={flagClass(row.homeNation)} aria-hidden="true" />
                    </div>

                    <div className="mono flex items-center justify-center">
                      {isNext ? (
                        <span className="text-xs text-muted-foreground">vs</span>
                      ) : (
                        <span
                          className={`inline-flex min-w-[60px] items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold ${
                            isLive
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          <span className={isFinal && !row.homeWon && row.awayWon ? "opacity-45" : ""}>
                            {row.homeScore ?? 0}
                          </span>
                          <span className="opacity-40">–</span>
                          <span className={isFinal && !row.awayWon && row.homeWon ? "opacity-45" : ""}>
                            {row.awayScore ?? 0}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 items-center justify-start gap-2 text-left">
                      <i className={flagClass(row.awayNation)} aria-hidden="true" />
                      <span
                        className={`truncate text-sm ${
                          isFinal && row.awayWon
                            ? "font-semibold text-foreground"
                            : isFinal && row.homeWon
                              ? "font-normal text-muted-foreground"
                              : "font-medium text-foreground"
                        }`}
                      >
                        {row.away}
                      </span>
                    </div>
                  </div>

                  {/* Right: Round + Chevron */}
                  <div className="hidden items-center justify-end gap-1.5 text-right text-xs text-muted-foreground md:flex">
                    <span className="truncate">{row.round}</span>
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {activeDay?.partial
                ? "Match feed did not answer completely for this date."
                : "No matches match this day and circuit filter."}
            </p>
            {(circuit !== "ALL" || liveOnly) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setCircuit("ALL");
                  setLiveOnly(false);
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            Showing {Math.min(14, filteredFixtures.length)} of {filteredFixtures.length}
          </span>
          <Link
            href={`/schedule?day=${activeDay?.iso ?? ""}`}
            className="font-medium text-[var(--pba)] hover:underline"
          >
            Full day schedule →
          </Link>
        </div>
      </Card>
    </section>
  );
}
