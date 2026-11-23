"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveFeed, LiveMatch } from "@/lib/pba/live";
import { HomeFeaturedLive } from "./home-featured-live";
import { HomeFixturesCard } from "./home-fixtures-card";
import type { HomeDaySlice, HomeFixtureRow, HomeLeadStory, HomeLiveCard } from "./home-types";

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

export function HomeArenaHub({
  initialLive,
  days,
  teamFallback,
  leadStory,
  leftRailSlot,
  rightRailSlot,
}: {
  initialLive: HomeLiveCard[];
  days: HomeDaySlice[];
  teamFallback: HomeFixtureRow[];
  leadStory: HomeLeadStory | null;
  leftRailSlot: React.ReactNode;
  rightRailSlot: React.ReactNode;
}) {
  const [liveCards, setLiveCards] = useState<HomeLiveCard[]>(initialLive);
  const [focusedKey, setFocusedKey] = useState<string>(initialLive[0]?.key ?? "");

  useEffect(() => {
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LiveFeed;
        if (!Array.isArray(data.matches)) return;
        setLiveCards((prev) => {
          const prevByKey = new Map(prev.map((c) => [c.key, c]));
          return data.matches.map((m, i) => liveMatchToCard(m, i, prevByKey.get(m.key)));
        });
      } catch {
        // Retry on next interval
      }
    };
    const timer = setInterval(poll, 20_000);
    return () => clearInterval(timer);
  }, []);

  const featured = useMemo(
    () => liveCards.find((c) => c.key === focusedKey) ?? liveCards[0] ?? null,
    [liveCards, focusedKey],
  );

  const todaySlice = useMemo(() => days.find((d) => d.key === "today") ?? days[0], [days]);
  const upcomingToday = useMemo(
    () => (todaySlice?.rows ?? []).filter((r) => r.state === "next"),
    [todaySlice],
  );

  return (
    <div className="wrap py-5 pb-12">
      {/* Classic 3-Column Sports Portal Grid (Center renders first on mobile) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_316px]">
        {/* LEFT RAIL: Tournaments, Circuits, Team League, Season Leaders */}
        <aside
          className="order-3 flex min-w-0 flex-col gap-5 lg:order-1"
          aria-label="Tournaments and league overview"
        >
          {leftRailSlot}
        </aside>

        {/* CENTER MAIN FEED: Live Arena Stage + Symmetric 1v1 Matches & Results */}
        <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
          <HomeFeaturedLive
            liveCards={liveCards}
            featured={featured}
            onSelectKey={setFocusedKey}
            upcomingToday={upcomingToday}
            leadStory={leadStory}
          />
          <HomeFixturesCard days={days} teamFallback={teamFallback} />
        </div>

        {/* RIGHT RAIL: World Rankings + Photo-Led Newsroom */}
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
