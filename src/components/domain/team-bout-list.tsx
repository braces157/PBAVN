"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { average, percent } from "@/lib/format";
import { Chip, cn } from "@/components/ui/primitives";
import type { Bout, BoutInnings } from "@/lib/pba/team-matches-parse";

export interface ResolvedBoutPlayer {
  code: string;
  name: string;
  average?: number;
  winRate?: number;
}

interface TeamBoutListProps {
  bouts: Bout[];
  gameNo: string;
  seasonCode: string;
  roundCode: string;
  initialSet: number | null;
  initialInnings: BoutInnings | null;
  homeTeamName?: string;
  awayTeamName?: string;
  /** Keyed by `${sideIndex}:${shortName}` so home and away lookups never collide. */
  playerMap?: Record<string, ResolvedBoutPlayer>;
}

export function TeamBoutList({
  bouts,
  gameNo,
  seasonCode,
  roundCode,
  initialSet,
  initialInnings,
  homeTeamName,
  awayTeamName,
  playerMap = {},
}: TeamBoutListProps) {
  const initialBout = initialSet !== null ? bouts.find((b) => b.setNo === initialSet) : undefined;
  const [expandedSet, setExpandedSet] = useState<number | null>(initialSet);
  const [cache, setCache] = useState<Record<string, BoutInnings | null>>(() =>
    initialBout?.tgCode && initialInnings !== null ? { [initialBout.tgCode]: initialInnings } : {},
  );
  const [failedCodes, setFailedCodes] = useState<Record<string, boolean>>({});
  const [loadingCodes, setLoadingCodes] = useState<Record<string, boolean>>({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const inFlight = useRef<Map<string, Promise<BoutInnings | null>>>(new Map());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadInnings = useCallback(async (tgCode: string): Promise<BoutInnings | null> => {
    if (Object.prototype.hasOwnProperty.call(cacheRef.current, tgCode)) {
      return cacheRef.current[tgCode] ?? null;
    }
    const existing = inFlight.current.get(tgCode);
    if (existing) return existing;

    const promise = fetch(`/api/team-innings?tgCode=${encodeURIComponent(tgCode)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const data = (await res.json()) as { innings?: BoutInnings | null };
        const innings = data.innings ?? null;
        if (mounted.current) {
          setCache((prev) => ({ ...prev, [tgCode]: innings }));
          setFailedCodes((prev) => {
            if (!prev[tgCode]) return prev;
            const next = { ...prev };
            delete next[tgCode];
            return next;
          });
        }
        return innings;
      })
      .catch(() => {
        if (mounted.current) {
          setFailedCodes((prev) => ({ ...prev, [tgCode]: true }));
        }
        return null;
      })
      .finally(() => {
        inFlight.current.delete(tgCode);
      });

    inFlight.current.set(tgCode, promise);
    return promise;
  }, []);

  const prefetch = useCallback(
    (tgCode: string | null) => {
      if (!tgCode) return;
      if (Object.prototype.hasOwnProperty.call(cacheRef.current, tgCode)) return;
      void loadInnings(tgCode);
    },
    [loadInnings],
  );

  const syncUrl = useCallback(
    (setNo: number | null) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      if (seasonCode) params.set("season", seasonCode);
      if (roundCode) params.set("round", roundCode);
      if (setNo !== null) params.set("set", String(setNo));
      const qs = params.toString();
      const nextUrl = `/teams/matches/${gameNo}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", nextUrl);
    },
    [gameNo, seasonCode, roundCode],
  );

  const toggleBout = useCallback(
    async (bout: Bout) => {
      if (!bout.tgCode) return;

      if (expandedSet === bout.setNo) {
        setExpandedSet(null);
        syncUrl(null);
        return;
      }

      setExpandedSet(bout.setNo);
      syncUrl(bout.setNo);

      if (!Object.prototype.hasOwnProperty.call(cacheRef.current, bout.tgCode)) {
        const code = bout.tgCode;
        setLoadingCodes((prev) => ({ ...prev, [code]: true }));
        await loadInnings(code);
        if (mounted.current) {
          setLoadingCodes((prev) => {
            if (!prev[code]) return prev;
            const next = { ...prev };
            delete next[code];
            return next;
          });
        }
      }
    },
    [expandedSet, loadInnings, syncUrl],
  );

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, bout: Bout) => {
      if (!bout.tgCode) return;
      // Don't hijack clicks on nested player or H2H links.
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button")) return;
      void toggleBout(bout);
    },
    [toggleBout],
  );

  return (
    <ul className="mt-5 space-y-3">
      {bouts.map((bout) => {
        const expanded = expandedSet === bout.setNo;
        const tgCode = bout.tgCode;
        const hasLoaded = tgCode ? Object.prototype.hasOwnProperty.call(cache, tgCode) : false;
        const innings = tgCode ? (cache[tgCode] ?? null) : null;
        const failed = tgCode ? Boolean(failedCodes[tgCode]) : false;
        const loading = expanded && Boolean(tgCode && loadingCodes[tgCode]);
        const panelId = `set-${bout.setNo}-innings`;

        const isSingles =
          bout.sides.length === 2 &&
          bout.sides[0].names.length === 1 &&
          bout.sides[1].names.length === 1;
        const homeSingle = isSingles ? playerMap[`0:${bout.sides[0].names[0]}`] : undefined;
        const awaySingle = isSingles ? playerMap[`1:${bout.sides[1].names[0]}`] : undefined;
        const h2hHref =
          homeSingle && awaySingle
            ? `/compare?a=${encodeURIComponent(homeSingle.code)}&b=${encodeURIComponent(awaySingle.code)}`
            : null;

        const homeLabel = bout.sides[0]?.names.join(" / ") || homeTeamName || "Home";
        const awayLabel = bout.sides[1]?.names.join(" / ") || awayTeamName || "Away";

        const homeTwoPoints = innings
          ? innings.rows.reduce((sum, row) => sum + (row.sides[0]?.twoPoint ?? 0), 0)
          : 0;
        const awayTwoPoints = innings
          ? innings.rows.reduce((sum, row) => sum + (row.sides[1]?.twoPoint ?? 0), 0)
          : 0;

        return (
          <li key={bout.setNo} id={`set-${bout.setNo}`} className="scroll-mt-20">
            <div
              className={cn(
                "surface overflow-hidden transition-colors",
                tgCode && "hover:border-[var(--link)]/40",
              )}
              onMouseEnter={() => prefetch(tgCode)}
            >
              <div
                onClick={(e) => handleCardClick(e, bout)}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 bg-ink-850 px-4 py-2",
                  tgCode && "cursor-pointer",
                )}
              >
                <span className="font-display text-[12.5px] font-bold uppercase tracking-wide text-fog-100">
                  Set {bout.setNo}
                </span>
                {bout.format && <Chip tone="neutral">{bout.format}</Chip>}
                <span className="text-[10.5px] font-medium text-fog-500">
                  {isSingles ? "Singles" : "Doubles"}
                </span>
                {bout.playedAt && (
                  <span className="tnum text-[11px] text-fog-500">{bout.playedAt}</span>
                )}
                <span className="flex-1" />
                {h2hHref && (
                  <Link
                    href={h2hHref}
                    className="text-[11px] font-semibold text-fog-400 underline-offset-2 transition-colors hover:text-carom-300 hover:underline"
                  >
                    Compare H2H
                  </Link>
                )}
                {tgCode ? (
                  <button
                    type="button"
                    onClick={() => void toggleBout(bout)}
                    onMouseEnter={() => prefetch(tgCode)}
                    onFocus={() => prefetch(tgCode)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className={cn(
                      "cursor-pointer text-[11.5px] font-semibold underline-offset-2 hover:underline",
                      expanded ? "text-carom-300" : "text-carom-400",
                    )}
                  >
                    {expanded ? "Hide innings ↑" : "Innings breakdown →"}
                  </button>
                ) : (
                  <span className="text-[11px] text-fog-550">In play</span>
                )}
              </div>

              <div
                onClick={(e) => handleCardClick(e, bout)}
                className={cn("space-y-2 p-4", tgCode && "cursor-pointer")}
              >
                {bout.sides.map((side, index) => {
                  const clubLabel = index === 0 ? homeTeamName : awayTeamName;
                  return (
                    <div
                      key={`${bout.setNo}-${index}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                    >
                      <span
                        className={cn(
                          "w-5 shrink-0 text-center text-[11px] font-bold",
                          side.won ? "text-carom-300" : "text-fog-600",
                        )}
                      >
                        {side.won ? "W" : ""}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-[13px]",
                          side.won ? "font-bold text-fog-100" : "text-fog-300",
                        )}
                      >
                        {side.names.map((rawName, nameIndex) => {
                          const resolved = playerMap[`${index}:${rawName}`];
                          const tooltip = resolved
                            ? `${resolved.name}${resolved.average ? ` · AVG ${average(resolved.average)}` : ""}${resolved.winRate ? ` · ${percent(resolved.winRate, 0)} win` : ""}`
                            : undefined;
                          return (
                            <span key={`${rawName}-${nameIndex}`}>
                              {nameIndex > 0 && <span className="mx-1 text-fog-550">/</span>}
                              {resolved ? (
                                <Link
                                  href={`/players/${encodeURIComponent(resolved.code)}`}
                                  title={tooltip}
                                  className="underline-offset-2 transition-colors hover:text-carom-300 hover:underline"
                                >
                                  {rawName}
                                </Link>
                              ) : (
                                rawName
                              )}
                            </span>
                          );
                        })}
                        {clubLabel && (
                          <span className="ml-2 hidden text-[11px] font-normal text-fog-550 sm:inline">
                            {clubLabel}
                          </span>
                        )}
                      </span>
                      <span className="tnum font-display text-[13.5px] font-bold text-fog-100">
                        {side.points ?? "—"}P / {side.innings ?? "—"}
                      </span>
                      <span className="tnum w-14 text-right text-[12px] text-fog-400">
                        {average(side.average)}
                      </span>
                      <span className="tnum w-12 text-right text-[12px] text-fog-500">
                        HR {side.highRun ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {expanded && (
                <div id={panelId}>
                  {loading ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="border-t border-ink-800 px-4 py-3 text-[12px] text-fog-450"
                    >
                      Loading innings…
                    </div>
                  ) : failed && !hasLoaded ? (
                    <div className="flex items-center justify-between gap-3 border-t border-ink-800 px-4 py-3 text-[12px] text-fog-450">
                      <span>Could not load per-inning detail.</span>
                      {tgCode && (
                        <button
                          type="button"
                          onClick={async () => {
                            setLoadingCodes((prev) => ({ ...prev, [tgCode]: true }));
                            await loadInnings(tgCode);
                            if (mounted.current) {
                              setLoadingCodes((prev) => {
                                const next = { ...prev };
                                delete next[tgCode];
                                return next;
                              });
                            }
                          }}
                          className="rounded border border-ink-700 bg-ink-850 px-2 py-0.5 text-[11px] font-semibold text-fog-200 hover:text-carom-300"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ) : innings && innings.rows.length > 0 ? (
                    <div className="border-t border-ink-800">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 bg-ink-850/60 px-4 py-2 text-[11px] text-fog-450">
                        <span className="tnum">
                          <strong className="text-fog-200">{innings.rows.length}</strong> innings recorded
                        </span>
                        <span className="tnum">
                          Bank shots (2P):{" "}
                          <strong className="text-carom-300">{homeTwoPoints}</strong> –{" "}
                          <strong className="text-gold-300">{awayTwoPoints}</strong>
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="stat-table">
                          <thead>
                            <tr>
                              <th scope="col">Inn</th>
                              <th scope="col" className="!text-left">{homeLabel} (1P/2P)</th>
                              <th scope="col">Score</th>
                              <th scope="col">Total</th>
                              <th scope="col" className="!text-left">{awayLabel} (1P/2P)</th>
                              <th scope="col">Score</th>
                              <th scope="col">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {innings.rows.map((row) => {
                              const [home, away] = row.sides;
                              return (
                                <tr key={row.inning}>
                                  <td className="tnum font-semibold text-fog-100">{row.inning}</td>
                                  <td className="!text-left tnum text-fog-300">
                                    {home ? `${home.onePoint}/${home.twoPoint}` : "—"}
                                  </td>
                                  <td className="tnum text-fog-300">{home?.score ?? "—"}</td>
                                  <td className="tnum font-bold text-carom-300">
                                    {home?.total ?? "—"}
                                  </td>
                                  <td className="!text-left tnum text-fog-300">
                                    {away ? `${away.onePoint}/${away.twoPoint}` : "—"}
                                  </td>
                                  <td className="tnum text-fog-300">{away?.score ?? "—"}</td>
                                  <td className="tnum font-bold text-gold-300">
                                    {away?.total ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="border-t border-ink-800 px-4 py-2 text-[11px] text-fog-550">
                        1P/2P = single-point / bank-shot conversions; Score = points in inning; Total = cumulative score.
                      </p>
                    </div>
                  ) : (
                    <p className="border-t border-ink-800 px-4 py-3 text-[12px] text-fog-450">
                      Per-inning detail publishes once the bout completes.
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
