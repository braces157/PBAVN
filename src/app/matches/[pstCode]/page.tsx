import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { IN_PLAY, getScorecard, getSetInnings } from "@/lib/pba/scoreboard";
import { getTourTitleIndex, resolvePlayerCode } from "@/lib/pba/service";
import {
  analyseSet,
  compareTotals,
  summariseMatch,
  type AnalysedSet,
} from "@/lib/match";
import { youtubeId } from "@/lib/format";
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

function readContext(search: Search) {
  const tourCode = /^\d{1,6}$/.test(search.tour ?? "") ? search.tour! : null;
  const title = tourCode ? getTourTitleIndex().get(tourCode)?.titleEn ?? null : null;
  const eventSeq = /^\d{1,6}$/.test(search.seq ?? "") ? search.seq! : null;
  const round = search.round && ROUND.test(search.round) ? search.round.trim() : null;
  const watch = search.watch && youtubeId(search.watch) ? search.watch : null;
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
  const context = readContext(search);
  const { analysed } = await loadMatch(pstCode, readContext(search).live);

  if (analysed.length === 0) {
    return {
      title: "Match card",
      description: "Per-set and turn-by-turn scoring from the PBA scoring terminal.",
    };
  }

  const names = analysed[0].sides.map((side) => side.name).filter(Boolean);
  const summary = summariseMatch(analysed);

  return {
    title: `${names.join(" vs ")} (${summary.setsWon.join("–")}) — Match Scorecard`,
    description: `Set-by-set scorecard and turn-by-turn scoring${context.title ? ` from ${context.title}` : ""}. ${analysed.length} sets.`,
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
  const context = readContext(search);
  const { analysed, totals } = await loadMatch(pstCode, context.live);

  if (analysed.length === 0) {
    return (
      <div className="mx-auto max-w-[1300px] px-3 py-6">
        <nav className="mb-4 flex items-center gap-1.5 text-[11.5px] text-fog-500" aria-label="Breadcrumb">
          <Link href="/schedule" className="hover:text-carom-300">
            Schedule
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-fog-300">Match #{pstCode}</span>
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
  const rows = compareTotals(totals);
  const names = analysed[0].sides.map((side) => side.name);
  const playerCodes = names.map((name) => resolvePlayerCode(name));
  const covered = summary.coveredSets;

  return (
    <div className="mx-auto max-w-[1300px] px-3 pb-10 pt-4">
      <nav className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-fog-500" aria-label="Breadcrumb">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href="/schedule" className="transition-colors hover:text-carom-300">
            Schedule
          </Link>
          {context.title ? (
            <>
              <span aria-hidden="true" className="text-ink-600">/</span>
              {context.eventSeq ? (
                <Link href={`/schedule/${context.eventSeq}`} className="transition-colors hover:text-carom-300">
                  {context.title}
                </Link>
              ) : (
                <span className="text-fog-300">{context.title}</span>
              )}
            </>
          ) : (
            <>
              <span aria-hidden="true" className="text-ink-600">/</span>
              <span className="text-fog-300">Match Scorecard</span>
            </>
          )}
          {context.round && (
            <>
              <span aria-hidden="true" className="text-ink-600">/</span>
              <span className="text-fog-300">{context.round}</span>
            </>
          )}
          <span aria-hidden="true" className="text-ink-600">/</span>
          <span className="tnum text-fog-400">#{pstCode}</span>
        </div>
        <span className="tnum text-[11px] text-fog-500">
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
