"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveFeed, LiveMatch } from "@/lib/pba/live";
import { HomeFeaturedLive } from "./home-featured-live";
import { HomeFixturesCard } from "./home-fixtures-card";
import type { HomeDaySlice, HomeFixtureRow, HomeLeadStory, HomeLiveCard } from "./home-types";

function pairKey(a: string, b: string): string {
  return [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("::");
}

function liveMatchToCard(m: LiveMatch, idx: number, prev?: HomeLiveCard): HomeLiveCard {
  const isTeam = Boolean(m.competition);
  return {
    key: m.key,
    pstCode: m.pstCode,
    watchUrl: m.watchUrl,
    circuit: isTeam ? "TEAM" : prev?.circuit ?? (m.latestSet.target === 11 ? "LPBA" : "PBA"),
    tableLabel: isTeam ? m.venue || "Team Arena" : prev?.tableLabel || `Table ${idx + 1}`,
    roundLabel: isTeam
      ? "Team League"
      : prev?.roundLabel || (m.latestSet.setNo > 0 ? `Set ${m.latestSet.setNo}` : "In Play"),
    latestSetNo: m.latestSet.setNo,
    raceTarget: m.latestSet.target,
    completedSets: m.completedSets,
    isTeam,
    sides: m.sides.map((s, si) => ({
      name: s.name,
      memCode: prev?.sides[si]?.memCode ?? null,
      nation: prev?.sides[si]?.nation ?? null,
      photo: prev?.sides[si]?.photo ?? null,
      setsWon: m.fixtureScore ? m.fixtureScore[si] ?? s.setsWon : s.setsWon,
      points: s.points,
      innings: s.innings,
      average: s.average ?? prev?.sides[si]?.average ?? null,
      highRun: s.highRun ?? prev?.sides[si]?.highRun ?? null,
    })),
  };
}

function liveCardToFixtureRow(card: HomeLiveCard): HomeFixtureRow {
  const s0 = card.sides[0];
  const s1 = card.sides[1];
  return {
    key: `live-polled-${card.key}`,
    state: "live",
    circuit: card.circuit,
    circuitLabel: card.circuit,
    eventTitle: card.tableLabel,
    round: card.roundLabel,
    clock: "LIVE",
    matchNo: "",
    href: card.pstCode ? `/matches/${encodeURIComponent(card.pstCode)}?live=1` : "/live",
    pstCode: card.pstCode,
    home: s0?.name ?? "Player 1",
    away: s1?.name ?? "Player 2",
    homeMemCode: s0?.memCode ?? null,
    awayMemCode: s1?.memCode ?? null,
    homeNation: s0?.nation ?? null,
    awayNation: s1?.nation ?? null,
    homeScore: s0?.setsWon ?? s0?.points ?? null,
    awayScore: s1?.setsWon ?? s1?.points ?? null,
    homeWon: false,
    awayWon: false,
    homeAvg: s0?.average ?? null,
    homeHr: s0?.highRun ?? null,
  };
}

export function HomeArenaHub({
  initialLive,
  initialFeedReachable = true,
  days,
  teamFallback,
  leadStory,
  leftRailSlot,
  rightRailSlot,
}: {
  initialLive: HomeLiveCard[];
  initialFeedReachable?: boolean;
  days: HomeDaySlice[];
  teamFallback: HomeFixtureRow[];
  leadStory: HomeLeadStory | null;
  leftRailSlot: React.ReactNode;
  rightRailSlot: React.ReactNode;
}) {
  const [liveCards, setLiveCards] = useState<HomeLiveCard[]>(initialLive);
  const [feedReachable, setFeedReachable] = useState<boolean>(initialFeedReachable);
  const [focusedKey, setFocusedKey] = useState<string>(initialLive[0]?.key ?? "");
  const pollSeqRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const seq = ++pollSeqRef.current;

      try {
        const res = await fetch("/api/live", { cache: "no-store", signal: controller.signal });
        if (!active || seq !== pollSeqRef.current) return;
        if (!res.ok) {
          setFeedReachable(false);
          return;
        }
        const data = (await res.json()) as LiveFeed;
        if (!active || seq !== pollSeqRef.current) return;
        if (data.reachable === false || !Array.isArray(data.matches)) {
          setFeedReachable(false);
          return;
        }
        setFeedReachable(true);
        setLiveCards((prev) => {
          const prevByKey = new Map(prev.map((c) => [c.key, c]));
          return data.matches.map((m, i) => liveMatchToCard(m, i, prevByKey.get(m.key)));
        });
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (active && seq === pollSeqRef.current) {
          setFeedReachable(false);
        }
      }
    };
    const timer = setInterval(() => void poll(), 20_000);
    return () => {
      active = false;
      clearInterval(timer);
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const featured = useMemo(
    () => liveCards.find((c) => c.key === focusedKey) ?? liveCards[0] ?? null,
    [liveCards, focusedKey],
  );

  const reconciledDays = useMemo(() => {
    const byPst = new Map<string, HomeLiveCard>();
    const byPair = new Map<string, HomeLiveCard>();
    for (const card of liveCards) {
      if (card.pstCode) byPst.set(card.pstCode, card);
      if (card.sides[0]?.name && card.sides[1]?.name) {
        byPair.set(pairKey(card.sides[0].name, card.sides[1].name), card);
      }
    }

    return days.map((slice) => {
      if (slice.key !== "today") return slice;
      const matchedKeys = new Set<string>();
      const updated = slice.rows.map((row) => {
        const card =
          (row.pstCode ? byPst.get(row.pstCode) : undefined) ?? byPair.get(pairKey(row.home, row.away));
        if (card) {
          matchedKeys.add(card.key);
          const swapped =
            card.sides[0]?.name.trim().toLowerCase() === row.away.trim().toLowerCase() &&
            card.sides[1]?.name.trim().toLowerCase() === row.home.trim().toLowerCase();
          const hSide = swapped ? card.sides[1] : card.sides[0];
          const aSide = swapped ? card.sides[0] : card.sides[1];
          return {
            ...row,
            state: "live" as const,
            homeScore: hSide?.setsWon ?? row.homeScore,
            awayScore: aSide?.setsWon ?? row.awayScore,
            href: card.pstCode ? `/matches/${encodeURIComponent(card.pstCode)}?live=1` : row.href,
          };
        }
        if (row.state === "live" && feedReachable) {
          const hasScores = row.homeScore !== null || row.awayScore !== null;
          return {
            ...row,
            state: hasScores ? ("final" as const) : ("next" as const),
            href: row.href.replace(/\?live=1$/, ""),
          };
        }
        return row;
      });

      const extraLive = liveCards
        .filter((card) => !matchedKeys.has(card.key))
        .map(liveCardToFixtureRow);

      return extraLive.length > 0 ? { ...slice, rows: [...extraLive, ...updated] } : { ...slice, rows: updated };
    });
  }, [days, liveCards, feedReachable]);

  const todaySlice = useMemo(
    () => reconciledDays.find((d) => d.key === "today") ?? reconciledDays[0],
    [reconciledDays],
  );
  const upcomingToday = useMemo(
    () => (todaySlice?.rows ?? []).filter((r) => r.state === "next"),
    [todaySlice],
  );

  return (
    <div className="wrap py-5 pb-12">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_316px]">
        <aside
          className="order-3 flex min-w-0 flex-col gap-5 lg:order-1"
          aria-label="Tournaments and league overview"
        >
          {leftRailSlot}
        </aside>

        <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
          <HomeFeaturedLive
            liveCards={liveCards}
            featured={featured}
            feedReachable={feedReachable}
            onSelectKey={setFocusedKey}
            upcomingToday={upcomingToday}
            leadStory={leadStory}
          />
          <HomeFixturesCard days={reconciledDays} teamFallback={teamFallback} />
        </div>

        <aside
          className="order-2 flex min-w-0 flex-col gap-5 lg:order-3"
          aria-label="Rankings and news"
        >
          {rightRailSlot}
        </aside>
      </div>
    </div>
  );
}
