"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Radio, RefreshCw } from "lucide-react";
import { flagClass } from "@/lib/flag";
import { SafeImage } from "@/components/ui/safe-image";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Button } from "@/components/ui/button";
import { HomeEditorialHero } from "./home-editorial-hero";
import type { HomeFixtureRow, HomeLeadStory, HomeLiveCard } from "./home-types";

function kstMinutesNow(): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function formatCountdown(clock: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const nowMin = kstMinutesNow();
  if (nowMin === null) return null;
  const diff = Number(match[1]) * 60 + Number(match[2]) - nowMin;
  if (diff <= 0 && diff > -15) return "Starting now";
  if (diff <= 0) return `${clock} KST`;
  if (diff < 60) return `Starts in ${diff}m`;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `Starts in ${hrs}h ${mins}m` : `Starts in ${hrs}h`;
}

function splitNameParts(fullName: string): { given: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { given: "", surname: fullName.trim() || "Player" };
  return {
    given: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1],
  };
}

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function DuelPortrait({ name, photo }: { name: string; photo: string | null }) {
  return (
    <span className="relative inline-grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 sm:size-12">
      <span aria-hidden="true">{playerInitials(name)}</span>
      {photo && (
        <SafeImage
          src={photo}
          alt=""
          revealOnLoad
          className="absolute inset-0 h-full w-full object-cover object-top"
          fallback={null}
        />
      )}
    </span>
  );
}

export function HomeFeaturedLive({
  liveCards,
  featured,
  feedReachable = true,
  refreshing = false,
  onRefresh,
  onSelectKey,
  upcomingToday,
  leadStory,
}: {
  liveCards: HomeLiveCard[];
  featured: HomeLiveCard | null;
  feedReachable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onSelectKey: (key: string) => void;
  upcomingToday: HomeFixtureRow[];
  leadStory: HomeLeadStory | null;
}) {
  const [countdown, setCountdown] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const nextClock = upcomingToday[0]?.clock ?? "";

  const scrollTables = (dir: -1 | 1) => {
    railRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (featured || !nextClock) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(formatCountdown(nextClock));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [featured, nextClock]);

  if (!featured) {
    return (
      <HomeEditorialHero
        leadStory={leadStory}
        upcomingToday={upcomingToday}
        nextClock={nextClock}
        countdown={countdown}
        feedReachable={feedReachable}
      />
    );
  }

  const fA = featured.sides[0];
  const fB = featured.sides[1];
  const fScoreA = fA?.points !== null && fA?.points !== undefined ? fA.points : fA?.setsWon ?? 0;
  const fScoreB = fB?.points !== null && fB?.points !== undefined ? fB.points : fB?.setsWon ?? 0;
  const fSetsA = fA?.setsWon ?? 0;
  const fSetsB = fB?.setsWon ?? 0;
  const fAvgA =
    fA?.average != null
      ? fA.average.toFixed(3)
      : fA?.points != null && fA?.innings && fA.innings > 0
        ? (fA.points / fA.innings).toFixed(3)
        : "—";
  const fAvgB =
    fB?.average != null
      ? fB.average.toFixed(3)
      : fB?.points != null && fB?.innings && fB.innings > 0
        ? (fB.points / fB.innings).toFixed(3)
        : "—";
  const nameA = splitNameParts(fA?.name ?? "Player 1");
  const nameB = splitNameParts(fB?.name ?? "Player 2");
  const matchHref = featured.pstCode ? `/matches/${featured.pstCode}?live=1` : "/live";

  return (
    <section
      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-sm"
      aria-label="Live Arena stage"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-red-400">
            <Radio className="size-3.5" />
            Live
          </span>
          <span className="text-zinc-700">/</span>
          <span className="font-medium text-zinc-100">
            {featured.circuit === "LPBA"
              ? "LPBA Tour"
              : featured.circuit === "TEAM"
                ? "Team League"
                : "PBA Tour"}
          </span>
          <span className="text-zinc-400">
            {featured.roundLabel} · {featured.tableLabel}
            {featured.raceTarget ? ` · Race ${featured.raceTarget}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh live scores"
              className="h-7 px-2 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "Syncing…" : "Refresh"}</span>
            </Button>
          )}
          {featured.watchUrl && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 px-2.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              <a href={featured.watchUrl} target="_blank" rel="noreferrer noopener">
                Stream <ExternalLink className="size-3" />
              </a>
            </Button>
          )}
          <Button
            size="sm"
            asChild
            className="h-7 bg-zinc-50 px-2.5 text-xs text-zinc-950 hover:bg-zinc-200 hover:text-zinc-950"
          >
            <Link href={matchHref}>
              Match Centre <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </div>

      <h1 className="sr-only">
        Live: {fA?.name ?? "Player 1"} vs {fB?.name ?? "Player 2"}
      </h1>
      <div className="grid grid-cols-1 items-center gap-4 px-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5 sm:px-5">
        <div className="flex items-center justify-center gap-3 sm:justify-end">
          <div className="min-w-0 text-center sm:text-right">
            {nameA.given && (
              <span className="block truncate text-[11px] text-zinc-400">{nameA.given}</span>
            )}
            {fA?.memCode ? (
              <Link
                href={`/players/${encodeURIComponent(fA.memCode)}`}
                className="block truncate text-xl font-semibold tracking-tight text-white hover:text-amber-400 sm:text-2xl"
              >
                {nameA.surname}
              </Link>
            ) : (
              <span className="block truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {nameA.surname}
              </span>
            )}
            <div className="mono mt-1 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 sm:justify-end">
              <span>{fAvgA}</span>
              <span>·</span>
              <span className="font-medium text-zinc-200">S{fSetsA}</span>
              <i className={flagClass(fA?.nation)} aria-hidden="true" />
            </div>
          </div>
          <DuelPortrait name={fA?.name ?? "P1"} photo={fA?.photo ?? null} />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex items-center gap-2" aria-live="polite">
            <span
              className={`mono inline-flex min-w-[54px] items-center justify-center rounded-lg border px-3 py-2 text-3xl font-semibold tracking-tight sm:min-w-[60px] sm:text-4xl ${
                fScoreA > fScoreB
                  ? "border-amber-500/40 bg-zinc-900 text-amber-400"
                  : "border-zinc-800 bg-zinc-900/70 text-white"
              }`}
            >
              <RollingNumber value={fScoreA} />
            </span>
            <span className="text-xl font-medium text-zinc-600">–</span>
            <span
              className={`mono inline-flex min-w-[54px] items-center justify-center rounded-lg border px-3 py-2 text-3xl font-semibold tracking-tight sm:min-w-[60px] sm:text-4xl ${
                fScoreB > fScoreA
                  ? "border-amber-500/40 bg-zinc-900 text-amber-400"
                  : "border-zinc-800 bg-zinc-900/70 text-white"
              }`}
            >
              <RollingNumber value={fScoreB} />
            </span>
          </div>

          <div className="mono flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-200">
              {featured.latestSetNo > 0 ? `Set ${featured.latestSetNo}` : "In Play"}
            </span>
            {(fA?.innings ?? fB?.innings) != null && (
              <span>· {fA?.innings ?? fB?.innings} inn</span>
            )}
            {featured.completedSets.length > 0 && (
              <span>
                · {featured.completedSets.map((p, i) => `S${i + 1} ${p[0]}–${p[1]}`).join(" ")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-row-reverse items-center justify-center gap-3 sm:flex-row sm:justify-start">
          <DuelPortrait name={fB?.name ?? "P2"} photo={fB?.photo ?? null} />
          <div className="min-w-0 text-center sm:text-left">
            {nameB.given && (
              <span className="block truncate text-[11px] text-zinc-400">{nameB.given}</span>
            )}
            {fB?.memCode ? (
              <Link
                href={`/players/${encodeURIComponent(fB.memCode)}`}
                className="block truncate text-xl font-semibold tracking-tight text-white hover:text-amber-400 sm:text-2xl"
              >
                {nameB.surname}
              </Link>
            ) : (
              <span className="block truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {nameB.surname}
              </span>
            )}
            <div className="mono mt-1 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 sm:justify-start">
              <i className={flagClass(fB?.nation)} aria-hidden="true" />
              <span className="font-medium text-zinc-200">S{fSetsB}</span>
              <span>·</span>
              <span>{fAvgB}</span>
            </div>
          </div>
        </div>
      </div>

      {liveCards.length > 1 && (
        <div className="relative flex items-center border-t border-zinc-800/80 bg-zinc-900/40">
          {liveCards.length > 3 && (
            <button
              type="button"
              onClick={() => scrollTables(-1)}
              aria-label="Scroll live tables left"
              className="hidden h-full shrink-0 cursor-pointer items-center justify-center border-r border-zinc-800/80 px-2 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100 sm:inline-flex"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div
            ref={railRef}
            className="no-scrollbar mask-fade-r flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3 py-2.5 pr-8"
            role="tablist"
            aria-label="Live tables"
          >
            {liveCards.map((m, idx) => {
              const active = m.key === featured.key;
              const sA = m.sides[0];
              const sB = m.sides[1];
              const pA = sA?.points ?? sA?.setsWon ?? 0;
              const pB = sB?.points ?? sB?.setsWon ?? 0;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectKey(m.key)}
                  className={`relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active ? "text-white" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  {active &&
                    (mounted ? (
                      <motion.span
                        layoutId="live-table-active"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 -z-0 rounded-md border border-zinc-700 bg-zinc-800"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="absolute inset-0 -z-0 rounded-md border border-zinc-700 bg-zinc-800"
                        aria-hidden="true"
                      />
                    ))}
                  <span className="mono relative z-10 text-[10px] text-zinc-500">T{idx + 1}</span>
                  <span className="relative z-10">{splitNameParts(sA?.name ?? "P1").surname}</span>
                  <span className="mono relative z-10 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400">
                    {pA}–{pB}
                  </span>
                  <span className="relative z-10">{splitNameParts(sB?.name ?? "P2").surname}</span>
                </button>
              );
            })}
          </div>
          {liveCards.length > 3 && (
            <button
              type="button"
              onClick={() => scrollTables(1)}
              aria-label="Scroll live tables right"
              className="hidden h-full shrink-0 cursor-pointer items-center justify-center border-l border-zinc-800/80 px-2 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100 sm:inline-flex"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
