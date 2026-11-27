"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GitBranch, List, Radio, Search, Trophy, X } from "lucide-react";
import type { BracketMatch } from "@/lib/pba/bracket-parse";
import {
  buildBracketTree,
  indexBracketPlayers,
  roundFormatHint,
  shortRoundLabel,
  type BracketNode,
  type BracketPlayerHit,
  type BracketSection,
} from "@/lib/bracket-tree";
import { cn } from "@/components/ui/primitives";

const SLOT_HEIGHT = 114;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMatchDate(stamp: string | null | undefined): { short: string; full: string; iso?: string } | null {
  if (!stamp) return null;
  const trimmed = stamp.trim();
  const fullMatch = /^(?:(\d{2})|(\d{4}))-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(trimmed);
  if (fullMatch) {
    const [, yy, yyyy, mm, dd, hh, min] = fullMatch;
    const year = yyyy ? Number(yyyy) : 2000 + Number(yy);
    const monthIdx = Number(mm) - 1;
    const day = Number(dd);
    const monthName = MONTHS[monthIdx];
    if (!monthName || day < 1 || day > 31) return null;
    const dateShort = `${monthName} ${day}`;
    const dateFull = `${monthName} ${day}, ${year}`;
    const isoDate = `${year}-${mm}-${dd}`;
    if (hh !== undefined && min !== undefined) {
      const clock = `${hh.padStart(2, "0")}:${min}`;
      return {
        short: `${dateShort} · ${clock}`,
        full: `${dateFull} · ${clock} KST`,
        iso: `${isoDate}T${clock}:00+09:00`,
      };
    }
    return { short: dateShort, full: dateFull, iso: isoDate };
  }
  const clockOnly = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (clockOnly) {
    const clock = `${clockOnly[1].padStart(2, "0")}:${clockOnly[2]}`;
    return { short: `${clock} KST`, full: `${clock} KST` };
  }
  return null;
}

function normQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .trim();
}

export function BracketTree({
  matches,
  tourCode,
  eventSeq,
  league,
  entrants,
  livePstCodes = [],
  initialShowAll = false,
}: {
  matches: BracketMatch[];
  tourCode: string;
  eventSeq: string;
  league?: string;
  entrants?: number | null;
  livePstCodes?: string[];
  initialShowAll?: boolean;
}) {
  const tree = useMemo(
    () => buildBracketTree(matches, { league, entrants }),
    [matches, league, entrants],
  );
  const allPlayers = useMemo(() => indexBracketPlayers(tree), [tree]);
  const liveSet = useMemo(() => new Set(livePstCodes), [livePstCodes]);

  const [sectionId, setSectionId] = useState<string>(tree.defaultSectionId);
  const [viewMode, setViewMode] = useState<"tree" | "list">(initialShowAll ? "list" : "tree");
  const [listRound, setListRound] = useState<number | "all">(() =>
    initialShowAll
      ? "all"
      : (tree.progress.find((r) => r.playedCount > 0)?.bracketSize ?? tree.rounds[0] ?? 128),
  );
  const [search, setSearch] = useState("");
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);

  const activeSection: BracketSection =
    tree.sections.find((s) => s.id === sectionId) ?? tree.sections[0];

  const searchHits = useMemo(() => {
    const q = normQuery(search);
    if (q.length < 2) return [];
    return allPlayers
      .filter((p) => normQuery(p.name).includes(q))
      .slice(0, 8);
  }, [allPlayers, search]);

  const tracedPlayer: BracketPlayerHit | null = useMemo(() => {
    if (selectedPlayerKey) {
      return allPlayers.find((p) => p.key === selectedPlayerKey) ?? null;
    }
    if (searchHits.length === 1) return searchHits[0];
    return null;
  }, [allPlayers, selectedPlayerKey, searchHits]);

  const tracedNodes = useMemo(
    () => new Set(tracedPlayer?.nodeIds ?? []),
    [tracedPlayer],
  );

  const focusPlayer = (hit: BracketPlayerHit) => {
    setSelectedPlayerKey(hit.key);
    setSearch(hit.name);
    setViewMode("tree");
    if (tree.sections.some((s) => s.id === hit.sectionId)) {
      setSectionId(hit.sectionId);
    }
  };

  const clearTrace = () => {
    setSelectedPlayerKey(null);
    setSearch("");
  };

  const finalNode = tree.byRound[2]?.[0] ?? null;
  const champion = finalNode?.decided ? finalNode.sides.find((s) => s.won) ?? null : null;

  return (
    <div className="space-y-4">
      {/* 1. Tournament Round Progress Ribbon (R128 -> Final) */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tournament Progression
            </span>
            <span className="text-xs text-muted-foreground">
              · {tree.drawSize}-player knockout draw
            </span>
          </div>
          {champion ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/12 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Trophy className="size-3.5" aria-hidden="true" />
              Champion: {champion.name}
            </span>
          ) : (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {matches.length} of {tree.drawSize - 1} matches played
            </span>
          )}
        </div>

        <div className="no-scrollbar flex items-stretch gap-1.5 overflow-x-auto pb-0.5">
          {tree.progress.map((step) => {
            const pct = step.totalSlots > 0 ? Math.round((step.playedCount / step.totalSlots) * 100) : 0;
            const complete = step.playedCount >= step.totalSlots && step.totalSlots > 0;
            const inProgress = step.playedCount > 0 && !complete;
            const isRoundActive = viewMode === "list" && listRound === step.bracketSize;
            return (
              <button
                key={step.bracketSize}
                type="button"
                onClick={() => {
                  if (step.bracketSize <= 16 && tree.sections.some((s) => s.id === "finals") && viewMode === "tree") {
                    setSectionId("finals");
                  } else {
                    setListRound(step.bracketSize);
                    setViewMode("list");
                  }
                }}
                title={`${step.round}${step.formatLabel ? ` · ${step.formatLabel}` : ""} (${step.playedCount}/${step.totalSlots})`}
                className={cn(
                  "flex min-w-[92px] flex-1 cursor-pointer flex-col justify-between rounded-lg border px-2.5 py-2 text-left transition-colors",
                  isRoundActive
                    ? "border-foreground bg-secondary text-foreground"
                    : complete
                      ? "border-emerald-500/30 bg-emerald-500/8 text-foreground hover:bg-emerald-500/15"
                      : inProgress
                        ? "border-blue-500/35 bg-blue-500/8 text-foreground hover:bg-blue-500/15"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-1.5">
                  <span className="font-mono text-xs font-semibold">{step.shortLabel}</span>
                  <span className="mono text-[10.5px] tabular-nums opacity-80">
                    {step.playedCount}/{step.totalSlots}
                  </span>
                </div>
                {step.formatLabel && (
                  <span className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {step.formatLabel}
                  </span>
                )}
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/80">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      complete ? "bg-emerald-500" : inProgress ? "bg-blue-500" : "bg-transparent",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Section Tabs + Player Path Search + View Toggle */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Bracket sections">
          {viewMode === "tree" ? (
            tree.sections.map((section) => {
              const active = section.id === activeSection?.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSectionId(section.id)}
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span>{section.id === "finals" ? "Finals (R16–F)" : section.label}</span>
                  <span
                    className={cn(
                      "mono rounded px-1 py-0.5 text-[10px] tabular-nums",
                      active ? "bg-background/20 text-background" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {section.playedCount}
                  </span>
                </button>
              );
            })
          ) : (
            <>
              <button
                type="button"
                onClick={() => setListRound("all")}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  listRound === "all"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span>All</span>
                <span
                  className={cn(
                    "mono rounded px-1 py-0.5 text-[10px] tabular-nums",
                    listRound === "all" ? "bg-background/20 text-background" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {matches.length}
                </span>
              </button>
              {tree.progress.map((step) => {
                const active = listRound === step.bracketSize;
                return (
                  <button
                    key={step.bracketSize}
                    type="button"
                    onClick={() => setListRound(step.bracketSize)}
                    className={cn(
                      "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span>{step.shortLabel}</span>
                    <span
                      className={cn(
                        "mono rounded px-1 py-0.5 text-[10px] tabular-nums",
                        active ? "bg-background/20 text-background" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {step.playedCount}/{step.totalSlots}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:w-[240px] sm:flex-none">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (selectedPlayerKey) setSelectedPlayerKey(null);
              }}
              placeholder="Trace player path in draw…"
              aria-label="Trace player in bracket"
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {(search || selectedPlayerKey) && (
              <button
                type="button"
                onClick={clearTrace}
                aria-label="Clear player highlight"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex shrink-0 rounded-lg border border-border bg-secondary p-0.5" role="group" aria-label="Bracket view mode">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "tree"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GitBranch className="size-3.5" aria-hidden="true" />
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" aria-hidden="true" />
              By round
            </button>
          </div>
        </div>
      </div>

      {/* Matching player chips when searching */}
      {(searchHits.length > 0 || tracedPlayer) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-3.5 py-2.5 text-xs">
          {tracedPlayer ? (
            <>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Tracing {tracedPlayer.name}
              </span>
              <span className="text-muted-foreground">
                · {tracedPlayer.sectionLabel} · Reached {tracedPlayer.latestRound}
                {tracedPlayer.stillAlive ? " (active)" : " (eliminated)"}
              </span>
              {tracedPlayer.sectionId !== activeSection?.id && viewMode === "tree" && (
                <button
                  type="button"
                  onClick={() => setSectionId(tracedPlayer.sectionId)}
                  className="ml-1 cursor-pointer font-semibold text-emerald-700 underline dark:text-emerald-300"
                >
                  Jump to {tracedPlayer.sectionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={clearTrace}
                className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Jump to player:</span>
              {searchHits.map((hit) => (
                <button
                  key={hit.key}
                  type="button"
                  onClick={() => focusPlayer(hit)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-emerald-500/50 hover:bg-accent"
                >
                  <span>{hit.name}</span>
                  <span className="mono text-[10px] text-muted-foreground">
                    {hit.sectionLabel} · {hit.latestRound}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* 3. Main Stage: Visual Connected Binary Tree OR Round-Filtered List */}
      {viewMode === "tree" && activeSection ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{activeSection.label}</span>
              <span className="text-muted-foreground">
                · {activeSection.rounds.map(shortRoundLabel).join(" → ")}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Click any finished match for full inning sheet · Winners auto-advance into next round
            </span>
          </div>

          <div className="overflow-x-auto p-4 sm:p-5">
            <div className="inline-flex min-w-full items-stretch">
              {activeSection.rounds.map((size, colIdx) => {
                const factor = 2 ** colIdx;
                const start = Math.floor(activeSection.startSlot / factor);
                const count = Math.max(1, Math.floor(activeSection.slotCount / factor));
                const nodes = (tree.byRound[size] ?? []).slice(start, start + count);
                const slotPx = SLOT_HEIGHT * factor;
                const isFirstCol = colIdx === 0;
                const isLastCol = colIdx === activeSection.rounds.length - 1;
                const format = roundFormatHint(league, size);

                return (
                  <div key={size} className="flex shrink-0 flex-col">
                    <div className="mb-3 pr-5">
                      <div className="flex items-baseline justify-between gap-2 rounded-lg border border-border/80 bg-secondary/50 px-3 py-1.5">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                          {shortRoundLabel(size)}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {format ?? `${nodes.filter((n) => n.match).length}/${nodes.length}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      {nodes.map((node, localIdx) => {
                        const isTopFeeder = localIdx % 2 === 0;
                        const isHighlighted = tracedNodes.has(node.id);
                        const isDimmed = tracedNodes.size > 0 && !isHighlighted;
                        const isLive = Boolean(node.match?.pstCode && liveSet.has(node.match.pstCode));
                        const hasNextBridge = !isLastCol;
                        const hasPrevTick = !isFirstCol;

                        return (
                          <div
                            key={node.id}
                            style={{ height: `${slotPx}px` }}
                            className="relative flex items-center"
                          >
                            {hasPrevTick && (
                              <div
                                aria-hidden="true"
                                className={cn(
                                  "h-0 w-3.5 shrink-0 border-t",
                                  isHighlighted ? "border-emerald-500" : "border-border",
                                )}
                              />
                            )}

                            <BracketCard
                              node={node}
                              tourCode={tourCode}
                              eventSeq={eventSeq}
                              highlighted={isHighlighted}
                              dimmed={isDimmed}
                              isLive={isLive}
                            />

                            {hasNextBridge && (
                              <div className="relative h-full w-5 shrink-0" aria-hidden="true">
                                {isTopFeeder ? (
                                  <div
                                    className={cn(
                                      "absolute bottom-0 left-0 right-0 top-1/2 rounded-tr-[4px] border-r border-t",
                                      isHighlighted ? "border-emerald-500" : "border-border",
                                    )}
                                  />
                                ) : (
                                  <div
                                    className={cn(
                                      "absolute bottom-1/2 left-0 right-0 top-0 rounded-br-[4px] border-b border-r",
                                      isHighlighted ? "border-emerald-500" : "border-border",
                                    )}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {activeSection.id !== "finals" && tree.sections.some((s) => s.id === "finals") && (
                <div className="flex shrink-0 flex-col justify-center pl-4">
                  <button
                    type="button"
                    onClick={() => setSectionId("finals")}
                    className="cursor-pointer rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-left transition-colors hover:border-foreground/40 hover:bg-secondary"
                  >
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Next stage
                    </p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      Open Finals (R16 → Final) →
                    </p>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <RoundListPanel
          tree={tree}
          roundSize={listRound}
          league={league}
          tourCode={tourCode}
          eventSeq={eventSeq}
          tracedNodes={tracedNodes}
          liveSet={liveSet}
        />
      )}
    </div>
  );
}

function BracketCard({
  node,
  tourCode,
  eventSeq,
  highlighted,
  dimmed,
  isLive,
  fullWidth = false,
}: {
  node: BracketNode;
  tourCode: string;
  eventSeq: string;
  highlighted: boolean;
  dimmed: boolean;
  isLive: boolean;
  fullWidth?: boolean;
}) {
  const href = node.match
    ? `/matches/${node.match.pstCode}?tour=${encodeURIComponent(tourCode)}&seq=${encodeURIComponent(eventSeq)}&round=${encodeURIComponent(node.round)}${isLive ? "&live=1" : ""}`
    : null;

  const hasProjected = node.sides.some((s) => s.projected);
  const allPlaceholder = node.sides.every((s) => s.placeholder);
  const winnerAvg = node.decided ? node.sides.find((s) => s.won)?.average ?? null : null;
  const matchDate = formatMatchDate(node.match?.scheduledAt);

  const inner = (
    <div
      className={cn(
        "overflow-hidden rounded-lg border transition-all",
        fullWidth ? "w-full" : "w-[238px] shrink-0",
        highlighted
          ? "border-emerald-500 bg-card ring-2 ring-emerald-500/25"
          : isLive
            ? "border-red-500/60 bg-card ring-1 ring-red-500/20"
            : node.match
              ? "border-border bg-card hover:border-foreground/40"
              : hasProjected
                ? "border-border/80 bg-secondary/35"
                : "border-dashed border-border/70 bg-secondary/15",
        dimmed && "opacity-35",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-secondary/40 px-2.5 py-1 text-[10px]">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono font-semibold tabular-nums text-muted-foreground">
            #{node.displayMatchNo}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 font-mono font-semibold text-red-600 dark:text-red-400">
              <Radio className="size-2.5" aria-hidden="true" />
              LIVE
            </span>
          )}
          {node.isShootout && (
            <span
              title="Decided by sudden-death shootout (2–2 tie)"
              className="rounded bg-amber-500/20 px-1 py-0 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-300"
            >
              SO
            </span>
          )}
        </div>
        {matchDate ? (
          <time
            dateTime={matchDate.iso}
            title={matchDate.full}
            className="truncate font-mono tabular-nums text-muted-foreground"
          >
            {matchDate.short}
          </time>
        ) : (
          <span className="truncate font-mono tabular-nums text-muted-foreground">
            {node.match?.table ?? (hasProjected ? "Next round" : allPlaceholder ? "Pending" : "")}
          </span>
        )}
      </div>

      <div className="divide-y divide-border/40">
        {node.sides.map((side, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs",
              side.won && node.decided && "bg-emerald-500/6",
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  side.placeholder
                    ? "bg-border"
                    : idx === 0
                      ? "border border-zinc-400 bg-white dark:border-zinc-500"
                      : "bg-amber-400",
                )}
              />
              <span
                title={side.name}
                className={cn(
                  "truncate leading-tight",
                  side.placeholder
                    ? "italic text-muted-foreground/70"
                    : side.projected
                      ? "font-medium text-foreground/85"
                      : node.decided && !side.won
                        ? "text-muted-foreground"
                        : side.won
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground",
                )}
              >
                {side.name}
              </span>
            </div>

            <span
              className={cn(
                "shrink-0 font-mono text-xs tabular-nums",
                side.won && node.decided
                  ? "font-bold text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {side.sets !== null ? (
                <>
                  {side.sets}
                  {node.isPointsRound && <span className="ml-0.5 text-[9px] font-normal">p</span>}
                </>
              ) : (
                "–"
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-secondary/20 px-2.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
        <span className="truncate">
          {node.match
            ? node.match.table || "Match card"
            : hasProjected
              ? "Awaiting schedule"
              : "TBD"}
        </span>
        {winnerAvg !== null ? (
          <span className="shrink-0">AVG {winnerAvg.toFixed(3)}</span>
        ) : isLive ? (
          <span className="shrink-0 text-red-600 dark:text-red-400">In progress</span>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block rounded-lg hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          fullWidth && "w-full",
        )}
        aria-label={`Match #${node.displayMatchNo}: ${node.sides[0].name} vs ${node.sides[1].name}${matchDate ? ` (${matchDate.full})` : ""}`}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function RoundListPanel({
  tree,
  roundSize,
  league,
  tourCode,
  eventSeq,
  tracedNodes,
  liveSet,
}: {
  tree: ReturnType<typeof buildBracketTree>;
  roundSize: number | "all";
  league?: string;
  tourCode: string;
  eventSeq: string;
  tracedNodes: Set<string>;
  liveSet: Set<string>;
}) {
  const sizes =
    roundSize === "all"
      ? [...tree.rounds]
          .reverse()
          .filter((sz) => (tree.byRound[sz] ?? []).some((n) => n.match !== null || n.sides.some((s) => s.projected)))
      : [roundSize];

  if (sizes.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No matches published for this bracket yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sizes.map((size) => {
        const nodes = tree.byRound[size] ?? [];
        const played = nodes.filter((n) => n.match !== null);
        const projected = nodes.filter((n) => n.match === null && n.sides.some((s) => s.projected));
        const visible = played.length > 0 || projected.length > 0 ? [...played, ...projected] : nodes;
        const format = roundFormatHint(league, size);

        return (
          <div key={size} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                  {nodes[0]?.round ?? shortRoundLabel(size)}
                </h3>
                {format && <span className="text-xs text-muted-foreground">· {format}</span>}
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {played.length}/{nodes.length} played
              </span>
            </div>

            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No matches published for this round yet.
              </p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((node) => (
                  <BracketCard
                    key={node.id}
                    node={node}
                    tourCode={tourCode}
                    eventSeq={eventSeq}
                    highlighted={tracedNodes.has(node.id)}
                    dimmed={tracedNodes.size > 0 && !tracedNodes.has(node.id)}
                    isLive={Boolean(node.match?.pstCode && liveSet.has(node.match.pstCode))}
                    fullWidth
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
