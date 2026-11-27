"use client";

import { useEffect, useState } from "react";
import type { MatchSet, MatchTotalRow, SetInnings } from "@/lib/pba/scoreboard-parse";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LiveDetailPayload {
  pstCode: string;
  sets: MatchSet[];
  totals: MatchTotalRow[];
  latestSetNo: number;
  displaySetNo?: number;
  latestTarget: number | null;
  innings: SetInnings;
}

type AnalyticsTab = "race" | "stats" | "innings";

export function LiveArenaAnalytics({
  pstCode,
  playerNames,
  refreshKey,
}: {
  pstCode: string;
  playerNames: [string, string];
  refreshKey: string;
}) {
  const [tab, setTab] = useState<AnalyticsTab>("race");
  const [selectedSet, setSelectedSet] = useState<number | null>(null);
  const [detail, setDetail] = useState<LiveDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedSet(null);
  }, [pstCode]);

  useEffect(() => {
    if (!pstCode) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const setQuery = selectedSet !== null ? `&set=${selectedSet}` : "";
    fetch(`/api/live/detail?pstCode=${encodeURIComponent(pstCode)}${setQuery}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LiveDetailPayload | null) => {
        if (!controller.signal.aborted && data) setDetail(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [pstCode, refreshKey, selectedSet]);

  const rows = detail?.innings?.rows ?? [];
  const target = detail?.latestTarget ?? 15;
  const p1 = detail?.innings?.players?.[0] || playerNames[0];
  const p2 = detail?.innings?.players?.[1] || playerNames[1];
  const shownSetNo = detail?.displaySetNo || detail?.latestSetNo || 0;
  const isPriorFallback =
    selectedSet === null &&
    Boolean(detail?.latestSetNo && detail?.displaySetNo && detail.displaySetNo < detail.latestSetNo);
  const setList = detail?.sets ?? [];
  const totals = detail?.totals ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as AnalyticsTab)}>
          <TabsList>
            <TabsTrigger value="race">Point Race</TabsTrigger>
            <TabsTrigger value="stats">H2H Stats</TabsTrigger>
            <TabsTrigger value="innings">Inning Log</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          {setList.length > 1 && (
            <div className="flex items-center gap-1" role="group" aria-label="Select set">
              {setList.map((s) => {
                const active = shownSetNo === s.setNo;
                return (
                  <button
                    key={s.setNo}
                    type="button"
                    onClick={() => setSelectedSet(s.setNo)}
                    className={`mono cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    S{s.setNo}
                  </button>
                );
              })}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {shownSetNo
              ? isPriorFallback
                ? `Showing Set ${shownSetNo} (Set ${detail?.latestSetNo} inning sheet pending)`
                : `Set ${shownSetNo} turn-by-turn`
              : "Live match telemetry"}
          </span>
        </div>
      </div>

      <div className="p-4">
        {!pstCode ? (
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Turn-by-turn charts are available for individual tour scorecards.
          </p>
        ) : loading && !detail ? (
          <div className="h-[168px] animate-pulse rounded-md bg-[var(--surface-2)]" aria-hidden="true" />
        ) : rows.length === 0 && tab === "stats" && totals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="!text-left">{p1}</th>
                  <th className="text-center">Match stat</th>
                  <th className="text-right">{p2}</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((row) => (
                  <tr key={row.label}>
                    <td className="mono !text-left font-medium text-foreground">{row.left}</td>
                    <td className="text-center text-xs text-muted-foreground">{row.label}</td>
                    <td className="mono text-right font-medium text-foreground">{row.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Live turn-by-turn inning data has not been published by the scoring terminal for this set yet.
          </p>
        ) : tab === "race" ? (
          <PointRaceSvg rows={rows} p1={p1} p2={p2} target={target} />
        ) : tab === "stats" ? (
          <StatCompareBars rows={rows} />
        ) : (
          <div className="overflow-x-auto">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Inn</th>
                  <th className="text-right">{p1}</th>
                  <th className="text-right">{p2}</th>
                  <th className="text-left">Highlight</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const s1 = row.sides[0];
                  const s2 = row.sides[1];
                  const pts1 = (s1?.onePoint ?? 0) + (s1?.twoPoint ?? 0) * 2;
                  const pts2 = (s2?.onePoint ?? 0) + (s2?.twoPoint ?? 0) * 2;
                  const notes: string[] = [];
                  if (pts1 >= 5) notes.push(`${p1} HR ${pts1}`);
                  if (pts2 >= 5) notes.push(`${p2} HR ${pts2}`);
                  if ((s1?.twoPoint ?? 0) > 0) notes.push(`${p1} 2pt bank`);
                  if ((s2?.twoPoint ?? 0) > 0) notes.push(`${p2} 2pt bank`);
                  return (
                    <tr key={row.inning}>
                      <td className="num font-semibold">{row.inning}</td>
                      <td className="num text-right">
                        +{pts1}{" "}
                        <span className="text-[var(--ink-3)]">({s1?.total ?? 0})</span>
                      </td>
                      <td className="num text-right">
                        +{pts2}{" "}
                        <span className="text-[var(--ink-3)]">({s2?.total ?? 0})</span>
                      </td>
                      <td className="text-left text-[var(--ink-2)]">
                        {notes.length > 0 ? notes.join(" · ") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PointRaceSvg({
  rows,
  p1,
  p2,
  target,
}: {
  rows: SetInnings["rows"];
  p1: string;
  p2: string;
  target: number;
}) {
  const pts1 = [{ inn: 0, val: 0, bank: false, hr: false }];
  const pts2 = [{ inn: 0, val: 0, bank: false, hr: false }];
  for (const r of rows) {
    const s1 = r.sides[0];
    const s2 = r.sides[1];
    const g1 = (s1?.onePoint ?? 0) + (s1?.twoPoint ?? 0) * 2;
    const g2 = (s2?.onePoint ?? 0) + (s2?.twoPoint ?? 0) * 2;
    pts1.push({ inn: r.inning, val: s1?.total ?? 0, bank: (s1?.twoPoint ?? 0) > 0, hr: g1 >= 5 });
    pts2.push({ inn: r.inning, val: s2?.total ?? 0, bank: (s2?.twoPoint ?? 0) > 0, hr: g2 >= 5 });
  }

  const W = 620;
  const H = 170;
  const padL = 34;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxX = Math.max(rows.length, 5);
  const maxY = Math.max(target, pts1.at(-1)?.val ?? 0, pts2.at(-1)?.val ?? 0, 1);
  const xOf = (i: number) => padL + (i / maxX) * plotW;
  const yOf = (v: number) => padT + plotH - (Math.min(v, maxY) / maxY) * plotH;

  const path1 = pts1.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.inn).toFixed(1)},${yOf(p.val).toFixed(1)}`).join(" ");
  const path2 = pts2.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.inn).toFixed(1)},${yOf(p.val).toFixed(1)}`).join(" ");
  const gridY = [0, Math.round(maxY / 3), Math.round((2 * maxY) / 3), maxY];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        <div className="flex items-center gap-4">
          <strong style={{ color: "var(--pba)" }}>
            {p1} ({pts1.at(-1)?.val ?? 0})
          </strong>
          <strong className="text-[var(--ink)]">
            {p2} ({pts2.at(-1)?.val ?? 0})
          </strong>
        </div>
        <span className="text-[var(--ink-3)]">Gold = 2pt bank · Red = 5+ high run</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Point race chart: ${p1} ${pts1.at(-1)?.val ?? 0} vs ${p2} ${pts2.at(-1)?.val ?? 0}`}
      >
        {gridY.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              y1={yOf(g)}
              x2={W - padR}
              y2={yOf(g)}
              stroke="var(--line)"
              strokeDasharray={g === maxY ? "4 3" : undefined}
            />
            <text x={padL - 8} y={yOf(g) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)">
              {g}
            </text>
          </g>
        ))}
        <path d={path2} fill="none" stroke="var(--ink-2)" strokeWidth="2.3" />
        <path d={path1} fill="none" stroke="var(--pba)" strokeWidth="2.7" />
        {pts2.slice(1).map((p) => (
          <circle
            key={`2-${p.inn}`}
            cx={xOf(p.inn)}
            cy={yOf(p.val)}
            r={p.hr ? 5 : p.bank ? 4.5 : 3}
            fill={p.hr ? "var(--live)" : p.bank ? "var(--gold-bright)" : "var(--ink-2)"}
            stroke="var(--surface)"
            strokeWidth="1.5"
          />
        ))}
        {pts1.slice(1).map((p) => (
          <circle
            key={`1-${p.inn}`}
            cx={xOf(p.inn)}
            cy={yOf(p.val)}
            r={p.hr ? 5 : p.bank ? 4.5 : 3}
            fill={p.hr ? "var(--live)" : p.bank ? "var(--gold-bright)" : "var(--pba)"}
            stroke="var(--surface)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  );
}

function StatCompareBars({ rows }: { rows: SetInnings["rows"] }) {
  const inn = Math.max(rows.length, 1);
  let p1Pts = 0;
  let p2Pts = 0;
  let p1Hr = 0;
  let p2Hr = 0;
  let p1Banks = 0;
  let p2Banks = 0;
  let p1Scoring = 0;
  let p2Scoring = 0;

  for (const r of rows) {
    const s1 = r.sides[0];
    const s2 = r.sides[1];
    const g1 = (s1?.onePoint ?? 0) + (s1?.twoPoint ?? 0) * 2;
    const g2 = (s2?.onePoint ?? 0) + (s2?.twoPoint ?? 0) * 2;
    p1Pts += g1;
    p2Pts += g2;
    if (g1 > p1Hr) p1Hr = g1;
    if (g2 > p2Hr) p2Hr = g2;
    p1Banks += s1?.twoPoint ?? 0;
    p2Banks += s2?.twoPoint ?? 0;
    if (g1 > 0) p1Scoring += 1;
    if (g2 > 0) p2Scoring += 1;
  }

  const metrics = [
    { label: "Set Average", v1: p1Pts / inn, v2: p2Pts / inn, fmt: (v: number) => v.toFixed(3) },
    { label: "High Run", v1: p1Hr, v2: p2Hr, fmt: (v: number) => String(v) },
    {
      label: "Scoring Innings %",
      v1: Math.round((p1Scoring / inn) * 100),
      v2: Math.round((p2Scoring / inn) * 100),
      fmt: (v: number) => `${v}%`,
    },
    { label: "2-Point Bank Shots", v1: p1Banks, v2: p2Banks, fmt: (v: number) => String(v) },
  ];

  return (
    <div className="stat-compare-list">
      {metrics.map((m) => {
        const total = Math.max(m.v1 + m.v2, 0.001);
        return (
          <div key={m.label}>
            <div className="sc-nums">
              <strong className="text-[var(--ink)]">{m.fmt(m.v1)}</strong>
              <span className="text-[11.5px] font-semibold text-[var(--ink-3)]">{m.label}</span>
              <strong className="text-[var(--ink)]">{m.fmt(m.v2)}</strong>
            </div>
            <div className="sc-bars">
              <div className="sc-track-l">
                <div className="sc-fill-l" style={{ width: `${Math.round((m.v1 / total) * 100)}%` }} />
              </div>
              <div className="sc-track-r">
                <div className="sc-fill-r" style={{ width: `${Math.round((m.v2 / total) * 100)}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
