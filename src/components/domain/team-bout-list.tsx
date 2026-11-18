"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { average } from "@/lib/format";
import { Chip, cn } from "@/components/ui/primitives";
import type { Bout, BoutInnings } from "@/lib/pba/team-matches-parse";

interface TeamBoutListProps {
  bouts: Bout[];
  gameNo: string;
  seasonCode: string;
  roundCode: string;
  initialSet: number | null;
  initialInnings: BoutInnings | null;
}

export function TeamBoutList({
  bouts,
  gameNo,
  seasonCode,
  roundCode,
  initialSet,
  initialInnings,
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

  const handleToggle = useCallback(
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

        return (
          <li key={bout.setNo} id={`set-${bout.setNo}`} className="scroll-mt-20">
            <div className="surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 bg-ink-850 px-4 py-2">
                <span className="font-display text-[12.5px] font-bold uppercase tracking-wide text-fog-100">
                  Set {bout.setNo}
                </span>
                {bout.format && <Chip tone="neutral">{bout.format}</Chip>}
                {bout.playedAt && (
                  <span className="tnum text-[11px] text-fog-500">{bout.playedAt}</span>
                )}
                <span className="flex-1" />
                {tgCode ? (
                  <button
                    type="button"
                    onClick={() => void handleToggle(bout)}
                    onMouseEnter={() => prefetch(tgCode)}
                    onFocus={() => prefetch(tgCode)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className={cn(
                      "cursor-pointer text-[11.5px] font-semibold underline-offset-2 hover:underline",
                      expanded ? "text-carom-300" : "text-carom-400",
                    )}
                  >
                    {expanded ? "Hide innings" : "Innings →"}
                  </button>
                ) : (
                  <span className="text-[11px] text-fog-550">In play</span>
                )}
              </div>

              <div className="space-y-2 p-4">
                {bout.sides.map((side, index) => (
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
                      {side.names.join(" / ")}
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
                ))}
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
                      <div className="overflow-x-auto">
                        <table className="stat-table">
                          <thead>
                            <tr>
                              <th scope="col">Inning</th>
                              <th scope="col" className="!text-left">Home 1P/2P</th>
                              <th scope="col">Score</th>
                              <th scope="col">Total</th>
                              <th scope="col" className="!text-left">Away 1P/2P</th>
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
                        Score is points in that inning; Total is the cumulative score.
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
