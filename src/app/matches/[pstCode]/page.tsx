import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { IN_PLAY, getScorecard, getSetInnings } from "@/lib/pba/scoreboard";
import { getTourTitleIndex, resolveMatchPlayerCodes } from "@/lib/pba/service";
import {
  analyseSet,
  compareTotals,
  summariseMatch,
  type AnalysedSet,
} from "@/lib/match";
import { youtubeWatchUrl } from "@/lib/format";
import { MatchHeader, MatchTotals } from "@/components/domain/match/match-summary";
import { SetNav, SetPanel } from "@/components/domain/match/set-panel";
import { EmptyState, TextLink } from "@/components/ui/primitives";
import type { MatchTotalRow } from "@/lib/pba/scoreboard";

export const revalidate = 300;

const OFFICIAL = "https://app.pbatour.org/mob/contest_new/admin_en/live_info_setview.asp";

type Params = { pstCode: string };
type Search = { tour?: string; seq?: string; round?: string; watch?: string; live?: string };

interface LoadedMatch {
  analysed: AnalysedSet[];
  totals: MatchTotalRow[];
}

const ROUND = /^[A-Za-z0-9 -]{1,24}$/;
const PST_CODE = /^\d{1,12}$/;

function readContext(search: Search) {
  const tourCode = /^\d{1,6}$/.test(search.tour ?? "") ? search.tour! : null;
  const title = tourCode ? getTourTitleIndex().get(tourCode)?.titleEn ?? null : null;
  const eventSeq = /^[A-Za-z0-9_-]{1,32}$/.test(search.seq ?? "") ? search.seq! : null;
  const round = search.round && ROUND.test(search.round) ? search.round.trim() : null;
  const watch = youtubeWatchUrl(search.watch);
  const live = search.live === "1";
  return { tourCode, title, eventSeq, round, watch, live };
}

const loadMatch = cache(async (pstCode: string, live: boolean): Promise<LoadedMatch> => {
  const ttl = live ? IN_PLAY : undefined;
  const scorecard = await getScorecard(pstCode, ttl);
  if (scorecard.sets.length === 0) return { analysed: [], totals: scorecard.totals };

  const innings = await Promise.all(scorecard.sets.map((set) => getSetInnings(set.pcgmCode, ttl)));
  return {
    analysed: scorecard.sets.map((set, index) => analyseSet(set, innings[index])),
    totals: scorecard.totals,
  };
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const [{ pstCode }, search] = await Promise.all([params, searchParams]);
  if (!PST_CODE.test(pstCode)) {
    return { title: "Match not found" };
  }
  const context = readContext(search);
  const { analysed } = await loadMatch(pstCode, context.live);

  if (analysed.length === 0) {
    return {
      title: "Match card",
      description: "Per-set and turn-by-turn scoring from the PBA scoring terminal.",
      alternates: { canonical: `/matches/${pstCode}` },
    };
  }

  const names = analysed[0].sides.map((side) => side.name).filter(Boolean);
  const summary = summariseMatch(analysed);
  const title = `${names.join(" vs ")} (${summary.setsWon.join("–")}) — Match Scorecard`;
  const description = `Set-by-set scorecard and turn-by-turn scoring${context.title ? ` from ${context.title}` : ""}. ${analysed.length} sets.`;

  return {
    title,
    description,
    alternates: { canonical: `/matches/${pstCode}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ pstCode }, search] = await Promise.all([params, searchParams]);
  if (!PST_CODE.test(pstCode)) notFound();
  const context = readContext(search);
  const { analysed, totals } = await loadMatch(pstCode, context.live);

  if (analysed.length === 0) {
    return (
      <div className="wrap py-6">
        <h1 className="sr-only">Match #{pstCode} Scorecard</h1>
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/schedule" className="hover:text-foreground">
            Schedule
          </Link>
          <span aria-hidden="true" className="text-border">/</span>
          <span className="text-foreground">Match #{pstCode}</span>
        </nav>
        <EmptyState
          title="No scorecard for this match"
          description="The scoring terminal has no record under this match code yet, or did not respond."
          action={<TextLink href="/live">Live match centre</TextLink>}
        />
      </div>
    );
  }

  const summary = summariseMatch(analysed);
  const baseRows = compareTotals(totals);
  const liveRows =
    context.live && analysed.length > 0 && analysed[0].sides.length === 2
      ? [
          {
            label: "Sets won",
            left: String(summary.setsWon[0] ?? 0),
            right: String(summary.setsWon[1] ?? 0),
            better:
              (summary.setsWon[0] ?? 0) > (summary.setsWon[1] ?? 0)
                ? ("left" as const)
                : (summary.setsWon[1] ?? 0) > (summary.setsWon[0] ?? 0)
                  ? ("right" as const)
                  : ("none" as const),
          },
          {
            label: "Points",
            left: String(summary.totalPoints[0] ?? 0),
            right: String(summary.totalPoints[1] ?? 0),
            better:
              (summary.totalPoints[0] ?? 0) > (summary.totalPoints[1] ?? 0)
                ? ("left" as const)
                : (summary.totalPoints[1] ?? 0) > (summary.totalPoints[0] ?? 0)
                  ? ("right" as const)
                  : ("none" as const),
          },
          {
            label: "Innings",
            left: String(summary.totalInnings[0] ?? 0),
            right: String(summary.totalInnings[1] ?? 0),
            better: "none" as const,
          },
          {
            label: "Average",
            left: summary.average[0] != null ? summary.average[0].toFixed(3) : "—",
            right: summary.average[1] != null ? summary.average[1].toFixed(3) : "—",
            better:
              (summary.average[0] ?? 0) > (summary.average[1] ?? 0)
                ? ("left" as const)
                : (summary.average[1] ?? 0) > (summary.average[0] ?? 0)
                  ? ("right" as const)
                  : ("none" as const),
          },
          {
            label: "High run",
            left: (() => {
              const hr = Math.max(0, ...analysed.map((s) => s.sides[0]?.highRun ?? 0));
              return hr > 0 ? String(hr) : "—";
            })(),
            right: (() => {
              const hr = Math.max(0, ...analysed.map((s) => s.sides[1]?.highRun ?? 0));
              return hr > 0 ? String(hr) : "—";
            })(),
            better: (() => {
              const l = Math.max(0, ...analysed.map((s) => s.sides[0]?.highRun ?? 0));
              const r = Math.max(0, ...analysed.map((s) => s.sides[1]?.highRun ?? 0));
              return l > r ? ("left" as const) : r > l ? ("right" as const) : ("none" as const);
            })(),
          },
        ]
      : baseRows;
  const rows = liveRows.length > 0 ? liveRows : baseRows;
  const names = analysed[0].sides.map((side) => side.name);
  const playerCodes = await resolveMatchPlayerCodes(names);
  const covered = summary.coveredSets;

  return (
    <div className="wrap pb-10 pt-5">
      <nav className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <div className="flex flex-wrap items-center gap-1.5">
          {context.live ? (
            <Link href="/live" className="font-medium text-red-600 transition-colors hover:underline dark:text-red-400">
              ← Live Arena
            </Link>
          ) : (
            <Link href="/schedule" className="transition-colors hover:text-foreground">
              Schedule
            </Link>
          )}
          {context.title ? (
            <>
              <span aria-hidden="true" className="text-border">/</span>
              {context.eventSeq ? (
                <Link href={`/schedule/${context.eventSeq}`} className="transition-colors hover:text-foreground">
                  {context.title}
                </Link>
              ) : (
                <span className="text-foreground">{context.title}</span>
              )}
            </>
          ) : (
            <>
              <span aria-hidden="true" className="text-border">/</span>
              <span className="text-foreground">Match Scorecard</span>
            </>
          )}
          {context.round && (
            <>
              <span aria-hidden="true" className="text-border">/</span>
              <span className="text-foreground">{context.round}</span>
            </>
          )}
          <span aria-hidden="true" className="text-border">/</span>
          <span className="font-mono tabular-nums text-muted-foreground">#{pstCode}</span>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {analysed.length} sets{covered > 0 ? ` · ${covered} with inning sheet` : ""}
        </span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <MatchHeader
            analysed={analysed}
            summary={summary}
            round={context.round}
            eventTitle={context.title}
            eventHref={context.eventSeq ? `/schedule/${context.eventSeq}` : null}
            officialUrl={`${OFFICIAL}?PSTCode=${encodeURIComponent(pstCode)}`}
            watchUrl={context.watch}
            live={context.live}
            setNav={<SetNav sets={analysed} />}
            playerCodes={playerCodes}
          />

          {analysed.map((set) => (
            <SetPanel key={set.setNo} set={set} />
          ))}
        </div>

        <aside className="space-y-4">
          <MatchTotals rows={rows} names={names} />
        </aside>
      </div>
    </div>
  );
}
