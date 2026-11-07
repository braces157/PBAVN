import type { Metadata } from "next";
import { cache } from "react";
import { IN_PLAY, getScorecard, getSetInnings } from "@/lib/pba/scoreboard";
import { getTourTitleIndex } from "@/lib/pba/service";
import {
  analyseSet,
  compareTotals,
  summariseMatch,
  type AnalysedSet,
} from "@/lib/match";
import { youtubeId } from "@/lib/format";
import { MatchHeader, MatchTotals } from "@/components/domain/match/match-summary";
import { SetNav, SetPanel } from "@/components/domain/match/set-panel";
import { EmptyState, Panel, TextLink } from "@/components/ui/primitives";
import { PageHeader } from "@/components/domain/filter-bar";
import type { MatchTotalRow } from "@/lib/pba/scoreboard";

/** A finished match never changes; a live one is re-read within the minute. */
export const revalidate = 300;

const OFFICIAL = "https://app.pbatour.org/mob/contest_new/admin_en/live_info_setview.asp";

type Params = { pstCode: string };
type Search = { tour?: string; seq?: string; round?: string; watch?: string; live?: string };

interface LoadedMatch {
  analysed: AnalysedSet[];
  totals: MatchTotalRow[];
}

/** Round labels come from upstream and are short and alphanumeric. */
const ROUND = /^[A-Za-z0-9 -]{1,24}$/;

function readContext(search: Search) {
  const tourCode = /^\d{1,6}$/.test(search.tour ?? "") ? search.tour! : null;
  const title = tourCode ? getTourTitleIndex().get(tourCode)?.titleEn ?? null : null;
  // The schedule route is keyed by the event's sequence number, which is not
  // the tour code, so it is carried separately.
  const eventSeq = /^\d{1,6}$/.test(search.seq ?? "") ? search.seq! : null;
  const round = search.round && ROUND.test(search.round) ? search.round.trim() : null;
  // Only a YouTube link is ever offered as a broadcast, so a crafted query
  // string cannot turn this page into a redirect.
  const watch = search.watch && youtubeId(search.watch) ? search.watch : null;
  const live = search.live === "1";
  return { tourCode, title, eventSeq, round, watch, live };
}

/**
 * One upstream read per scorecard, plus one per set, in parallel. Wrapped in
 * `cache` so the metadata pass and the render share a single set of reads.
 */
const loadMatch = cache(async (pstCode: string, live: boolean): Promise<LoadedMatch> => {
  // A match opened from the live board is still being scored, so its card must
  // not sit behind the archive cache.
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
    title: `${names.join(" vs ")} ${summary.setsWon.join("–")}`,
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
      <>
        <PageHeader
          eyebrow="Match card"
          title="No scorecard for this match"
          description="The association's scoring terminal has no record under this match code, or did not answer."
        >
          <TextLink href="/schedule">Back to the calendar</TextLink>
        </PageHeader>
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <EmptyState
            title="Nothing published"
            description="Match codes are assigned by the scoring system when a match is drawn. A code that was never used, or one from a match whose sheet was withdrawn, has no card."
            action={<TextLink href="/live">Live match centre</TextLink>}
          />
        </div>
      </>
    );
  }

  const summary = summariseMatch(analysed);
  const rows = compareTotals(totals);
  const names = analysed[0].sides.map((side) => side.name);
  const covered = summary.coveredSets;

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        <h1 className="mb-4 font-display text-xl font-bold text-fog-100">{names.filter(Boolean).join(" vs ") || "Match"}</h1>
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:gap-8">
          <div className="space-y-5">
            <MatchHeader
              analysed={analysed}
              summary={summary}
              round={context.round}
              eventTitle={context.title}
              eventHref={context.eventSeq ? `/schedule/${context.eventSeq}` : null}
              officialUrl={`${OFFICIAL}?PSTCode=${encodeURIComponent(pstCode)}`}
              watchUrl={context.watch}
              live={context.live}
            />

            {analysed.length > 1 && <div className="surface flex flex-wrap items-center gap-2 p-3">
              <span className="mr-2 text-xs font-semibold text-fog-400">Jump to set</span>
              <SetNav sets={analysed} />
            </div>}

            {analysed.map((set) => (
              <SetPanel key={set.setNo} set={set} />
            ))}
          </div>

          <aside className="space-y-4">
            <MatchTotals rows={rows} names={names} />

            <Panel title="This card">
              <p className="px-3 py-2.5 text-[11.5px] leading-relaxed text-fog-500">
                Sets, points, innings, averages and high runs are published by the scoring terminal.
                Per-inning runs are read from the same record, so a turn is one visit to the table.
              </p>
              {covered < analysed.length && (
                <p className="border-t border-ink-800 px-3 py-2.5 text-[11.5px] leading-relaxed text-fog-500">
                  {analysed.length - covered} of {analysed.length} sets had no turn record, so only
                  their published score is shown.
                </p>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}
