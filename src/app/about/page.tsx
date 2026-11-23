import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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

      <div className="wrap py-6">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <div className="bg-card p-5">
            <Stat label="Circuits covered" value="5" />
          </div>
          <div className="bg-card p-5">
            <Stat label="Seasons of history" value="8" />
          </div>
          <div className="bg-card p-5">
            <Stat label="Players indexed" value="1,700+" />
          </div>
          <div className="bg-card p-5">
            <Stat label="Upstream endpoints" value={String(ENDPOINTS.length)} accent />
          </div>
        </div>

        <section className="mt-10">
          <SectionHeading
            eyebrow="Circuits"
            title="Tour Structure"
            description="Five distinct 3-cushion competitions governed under the PBA ranking structure."
          />
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {CIRCUITS.map((circuit) => (
              <div key={circuit.code} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">{circuit.name}</h3>
                  <Chip tone="carom">{circuit.code}</Chip>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{circuit.blurb}</p>
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
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Architecture
              </p>
              <dl className="mt-2.5">
                <KeyValue label="Source">pbatour.org (official)</KeyValue>
                <KeyValue label="Transport">Server-side JSON &amp; HTML</KeyValue>
                <KeyValue label="Cache">30s – 24h per endpoint</KeyValue>
                <KeyValue label="Normalisation">Season, circuit &amp; naming unified</KeyValue>
                <KeyValue label="Language">English labels, original Korean retained</KeyValue>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Upstream services do not emit CORS headers, so all requests run server-side and degrade gracefully if a terminal times out.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-secondary/40 px-4 py-3">
                <p className="text-xs font-semibold text-foreground">Endpoints consumed</p>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="stat-table">
                  <tbody>
                    {ENDPOINTS.map((endpoint) => (
                      <tr key={endpoint.path}>
                        <td className="!text-left">
                          <code className="block max-w-[340px] truncate font-mono text-xs font-medium text-foreground">
                            {endpoint.path}
                          </code>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{endpoint.what}</span>
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
          <div className="mt-3 max-w-3xl space-y-2.5 text-sm leading-relaxed text-muted-foreground">
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
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Official association portal</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Visit pbatour.org for official entry forms, rule books and broadcast announcements.
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="https://www.pbatour.org/en/index"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:no-underline"
              >
                pbatour.org
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <Link
                href="/schedule"
                className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
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
