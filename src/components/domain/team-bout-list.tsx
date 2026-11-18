"use client";

import { useCallback, useRef, useState } from "react";
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
    initialBout?.tgCode ? { [initialBout.tgCode]: initialInnings } : {},
  );
  const [loadingTgCode, setLoadingTgCode] = useState<string | null>(null);
  const inFlight = useRef<Map<string, Promise<BoutInnings | null>>>(new Map());

  const loadInnings = useCallback(
    async (tgCode: string): Promise<BoutInnings | null> => {
      if (Object.prototype.hasOwnProperty.call(cache, tgCode)) {
        return cache[tgCode] ?? null;
      }
      const existing = inFlight.current.get(tgCode);
      if (existing) return existing;

      const promise = fetch(`/api/team-innings?tgCode=${encodeURIComponent(tgCode)}`)
        .then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as { innings?: BoutInnings | null };
          return data.innings ?? null;
        })
        .catch(() => null)
        .then((innings) => {
          setCache((prev) => ({ ...prev, [tgCode]: innings }));
          inFlight.current.delete(tgCode);
          return innings;
        });

      inFlight.current.set(tgCode, promise);
      return promise;
    },
    [cache],
  );

  const prefetch = useCallback(
    (tgCode: string | null) => {
      if (!tgCode) return;
      if (Object.prototype.hasOwnProperty.call(cache, tgCode)) return;
      void loadInnings(tgCode);
    },
    [cache, loadInnings],
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
    async (e: React.MouseEvent<HTMLAnchorElement>, bout: Bout) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (!bout.tgCode) return;
      e.preventDefault();

      if (expandedSet === bout.setNo) {
        setExpandedSet(null);
        syncUrl(null);
        return;
      }

      setExpandedSet(bout.setNo);
      syncUrl(bout.setNo);

      if (!Object.prototype.hasOwnProperty.call(cache, bout.tgCode)) {
        setLoadingTgCode(bout.tgCode);
        await loadInnings(bout.tgCode);
        setLoadingTgCode((current) => (current === bout.tgCode ? null : current));
      }
    },
    [cache, expandedSet, loadInnings, syncUrl],
  );

  return (
    <ul className="mt-5 space-y-3">
      {bouts.map((bout) => {
        const expanded = expandedSet === bout.setNo;
        const tgCode = bout.tgCode;
        const hasLoaded = tgCode ? Object.prototype.hasOwnProperty.call(cache, tgCode) : false;
        const innings = tgCode ? (cache[tgCode] ?? null) : null;
        const loading = expanded && Boolean(tgCode) && !hasLoaded && loadingTgCode === tgCode;
        const href = `/teams/matches/${gameNo}?season=${encodeURIComponent(seasonCode)}&round=${encodeURIComponent(roundCode)}&set=${bout.setNo}`;

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
                  <a
                    href={href}
                    onClick={(e) => void handleToggle(e, bout)}
                    onMouseEnter={() => prefetch(tgCode)}
                    onFocus={() => prefetch(tgCode)}
                    aria-expanded={expanded}
                    className={cn(
                      "text-[11.5px] font-semibold underline-offset-2 hover:underline",
                      expanded ? "text-carom-300" : "text-carom-400",
                    )}
                  >
                    {expanded ? "Hide innings" : "Innings →"}
                  </a>
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

              {expanded &&
                (loading || !hasLoaded ? (
                  <div className="border-t border-ink-800 px-4 py-3 text-[12px] text-fog-450">
                    Loading innings…
                  </div>
                ) : innings && innings.rows.length > 0 ? (
                  <div className="border-t border-ink-800">
                    <div className="overflow-x-auto">
                      <table className="stat-table">
                        <thead>
                          <tr>
                            <th>Inning</th>
                            <th className="!text-left">Home 1P/2P</th>
                            <th>Score</th>
                            <th>Total</th>
                            <th className="!text-left">Away 1P/2P</th>
                            <th>Score</th>
                            <th>Total</th>
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
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
