import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/domain/filter-bar";
import { Chip, KeyValue, SectionHeading, Stat } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "About",
  description:
    "What PBA Hub is, which 3-cushion circuits it covers, and where every score and statistic comes from.",
};

const CIRCUITS = [
  { name: "PBA Tour", code: "PBA1", blurb: "The top men's professional 3-cushion circuit and flagship tour championships." },
  { name: "LPBA Tour", code: "LPBA1", blurb: "The women's professional 3-cushion circuit, running an overlapping calendar of championships and world titles." },
  { name: "Dream Tour", code: "PBA2", blurb: "The development tier, where players earn ranking points towards promotion." },
  { name: "Challenge Tour", code: "PBA3", blurb: "The entry tier for newly qualified professionals." },
  { name: "Team League", code: "TLG", blurb: "Franchise competition contesting singles, doubles and mixed-doubles 3-cushion sets across regular rounds plus postseason." },
];

const ENDPOINTS = [
  { path: "/{lang}/ajax/info", what: "Homepage aggregate — news, rankings, galleries, videos" },
  { path: "/{lang}/ajax/leagueInfoList", what: "Circuit codes" },
  { path: "/{lang}/tournament/schedule/ajax/season", what: "Season list" },
  { path: "/{lang}/tournament/schedule/ajax/list", what: "Tournament calendar" },
  { path: "/{lang}/tournament/schedule/ajax/detail", what: "Single event detail" },
  { path: "/{lang}/player/search/ajax/indexList", what: "Player directory with season totals" },
  { path: "/{lang}/player/search/ajax/detail", what: "Player profile" },
  { path: "/{lang}/stats/ranking_prize/ajax/list", what: "Prize-money table" },
  { path: "/{lang}/stats/ranking_point/ajax/list", what: "Ranking-point table" },
  { path: "/{lang}/stats/service/season", what: "Per-player season statistics" },
  { path: "/{lang}/stats/service/tour", what: "Per-player, per-event statistics" },
  { path: "/{lang}/stats/service/champion", what: "Player titles" },
  { path: "/{lang}/stats/service/top5/season", what: "Season category leaders" },
  { path: "/{lang}/stats/service/headtohead", what: "Two-player head-to-head aggregate" },
  { path: "/{lang}/teamLeague/ajax/season", what: "Team league seasons" },
  { path: "/{lang}/teamLeague/ajax/gameList", what: "Team league rounds" },
  { path: "/{lang}/teamLeague/stats/ajax/seasonTeam", what: "Team standings" },
  { path: "/{lang}/teamLeague/stats/ajax/seasonPlayer", what: "Team league player statistics" },
  { path: "/{lang}/teamLeague/stats/ajax/getTeamWinLoseByTeam", what: "Team-vs-team record matrix" },
  { path: "/{lang}/media/press/ajax/list", what: "Press releases" },
  { path: "/{lang}/media/video/ajax/list", what: "Video feed" },
  { path: "app.pbatour.org/mob/contest_new/code_behind/live_info.asp", what: "Live scoreboard fragment" },
  { path: "app.pbatour.org/mob/contest_new/code_behind/contest_result_sur.asp", what: "Event brackets and per-player match search" },
  { path: "team.pbatour.org/mob/code_behind/getPlanDetailEnd_new2.asp", what: "Team-league round fixtures" },
  { path: "team.pbatour.org/mob/code_behind/getPlanResult_new.asp", what: "One fixture's score board and bouts" },
  { path: "team.pbatour.org/mob/ko/planResultDetail.asp", what: "One bout's record-sheet codes" },
  { path: "team.pbatour.org/mob/code_behind/getPlanResultDetail.asp", what: "One bout's per-inning chain as JSON" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="About PBA Hub"
        description="Independent scores, brackets, and statistics reader for the Professional Billiards Association."
      />

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-[8px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
          <div className="bg-ink-900 p-4">
            <Stat label="Circuits covered" value="5" />
          </div>
          <div className="bg-ink-900 p-4">
            <Stat label="Seasons of history" value="8" />
          </div>
          <div className="bg-ink-900 p-4">
            <Stat label="Players indexed" value="1,700+" />
          </div>
          <div className="bg-ink-900 p-4">
            <Stat label="Upstream endpoints" value={String(ENDPOINTS.length)} accent />
          </div>
        </div>

        <section className="mt-10">
          <SectionHeading
            eyebrow="Circuits"
            title="Tour Structure"
            description="Five distinct 3-cushion competitions governed under the PBA ranking structure."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CIRCUITS.map((circuit) => (
              <div key={circuit.code} className="surface p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[15px] font-bold text-fog-100">{circuit.name}</h3>
                  <Chip tone="carom">{circuit.code}</Chip>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-fog-450">{circuit.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="data" className="mt-10 scroll-mt-20">
          <SectionHeading
            eyebrow="Data provenance"
            title="Where the numbers come from"
            description="All figures are fetched server-side from pbatour.org's public data feeds and scoring terminals."
          />

          <div className="mt-4 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
            <div className="surface p-4">
              <p className="eyebrow">Architecture</p>
              <dl className="mt-2.5">
                <KeyValue label="Source">pbatour.org (official)</KeyValue>
                <KeyValue label="Transport">Server-side JSON &amp; HTML</KeyValue>
                <KeyValue label="Cache">30s – 24h per endpoint</KeyValue>
                <KeyValue label="Normalisation">Season, circuit &amp; naming unified</KeyValue>
                <KeyValue label="Language">English labels, original Korean retained</KeyValue>
              </dl>
              <p className="mt-3 text-[12px] leading-relaxed text-fog-450">
                Upstream services do not emit CORS headers, so all requests run server-side and degrade gracefully if a terminal times out.
              </p>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-ink-750 bg-ink-850 px-4 py-2.5">
                <p className="eyebrow">Endpoints consumed</p>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="stat-table">
                  <tbody>
                    {ENDPOINTS.map((endpoint) => (
                      <tr key={endpoint.path}>
                        <td className="!text-left">
                          <code className="block max-w-[340px] truncate text-[11.5px] font-semibold text-carom-300">
                            {endpoint.path}
                          </code>
                          <span className="mt-0.5 block text-[11px] text-fog-450">{endpoint.what}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <SectionHeading eyebrow="Legal" title="Attribution" />
          <div className="mt-3 max-w-3xl space-y-2.5 text-[12.5px] leading-relaxed text-fog-450">
            <p>
              PBA Hub is an unofficial, independent 3-cushion scores and statistics platform. The Professional
              Billiards Association, PBA, LPBA, Dream Tour, Challenge Tour and PBA Team League marks belong to
              their respective owners.
            </p>
            <p>
              Statistics are reproduced directly from the association&apos;s public data feeds for informational
              purposes.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <div className="surface-raised flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h2 className="font-display text-base font-bold text-fog-100">Official association portal</h2>
              <p className="mt-0.5 text-[12.5px] text-fog-450">
                Visit pbatour.org for official entry forms, rule books and broadcast announcements.
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="https://www.pbatour.org/en/index"
                target="_blank"
                rel="noreferrer noopener"
                className="press bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--paper)] transition-colors hover:bg-[var(--red)] hover:text-white"
              >
                pbatour.org ↗
              </a>
              <Link
                href="/schedule"
                className="rounded-md border border-ink-700 bg-ink-900 px-3.5 py-2 text-[12.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
              >
                Schedule
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
