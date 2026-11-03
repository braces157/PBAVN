import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/domain/filter-bar";
import { Chip, KeyValue, SectionHeading, Stat } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "About",
  description:
    "What PBA Hub is, which circuits it covers, and exactly where every number on the site comes from.",
};

const CIRCUITS = [
  { name: "PBA Tour", code: "PBA1", blurb: "The top men's professional circuit and the tour that carries the association's flagship championships." },
  { name: "LPBA Tour", code: "LPBA1", blurb: "The women's professional circuit, running an overlapping calendar of championships and world titles." },
  { name: "Dream Tour", code: "PBA2", blurb: "The development tier, where players build ranking points towards promotion." },
  { name: "Challenge Tour", code: "PBA3", blurb: "The entry tier for newly qualified professionals." },
  { name: "Team League", code: "TLG", blurb: "Franchise competition: ten clubs, singles and doubles sets, regular rounds plus a postseason." },
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
  { path: "app.pbatour.org/mob/contest_new/code_behind/contest_result_sur.asp", what: "Every match of an event; with a name search, one player's matches" },
  { path: "team.pbatour.org/mob/code_behind/getPlanDetailEnd_new2.asp", what: "Team-league round fixtures (plain-HTTP POST)" },
  { path: "team.pbatour.org/mob/code_behind/getPlanResult_new.asp", what: "One fixture's score board and bouts" },
  { path: "team.pbatour.org/mob/ko/planResultDetail.asp", what: "One bout's record-sheet codes" },
  { path: "team.pbatour.org/mob/code_behind/getPlanResultDetail.asp", what: "One bout's per-inning chain as JSON" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A better window on the tour"
        description="PBA Hub is an independent reader for the Professional Billiards Association. It does not host data of its own — it normalises the association's public feeds into something you can actually read on a phone."
      />

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid gap-px overflow-hidden rounded-[14px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
          <div className="bg-ink-900 p-5">
            <Stat label="Circuits covered" value="5" />
          </div>
          <div className="bg-ink-900 p-5">
            <Stat label="Seasons of history" value="8" />
          </div>
          <div className="bg-ink-900 p-5">
            <Stat label="Players indexed" value="1,700+" />
          </div>
          <div className="bg-ink-900 p-5">
            <Stat label="Upstream endpoints" value={String(ENDPOINTS.length)} accent />
          </div>
        </div>

        <section className="mt-14">
          <SectionHeading
            eyebrow="The circuits"
            title="What the tour actually is"
            description="The association runs five separate competitions under one ranking structure."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CIRCUITS.map((circuit) => (
              <div key={circuit.code} className="surface p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[15px] font-bold text-fog-100">{circuit.name}</h3>
                  <Chip tone="neutral">{circuit.code}</Chip>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-fog-500">{circuit.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="data" className="mt-14 scroll-mt-24">
          <SectionHeading
            eyebrow="Data provenance"
            title="Where every number comes from"
            description="All figures are read from pbatour.org's public JSON service at request time, with caching. Nothing is estimated, scraped into a warehouse, or hand-entered."
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div className="surface p-5">
              <p className="eyebrow">How it works</p>
              <dl className="mt-3">
                <KeyValue label="Source">pbatour.org (official)</KeyValue>
                <KeyValue label="Transport">Server-side JSON over HTTPS</KeyValue>
                <KeyValue label="Cache">60s – 24h per endpoint</KeyValue>
                <KeyValue label="Normalisation">Season, circuit and naming unified</KeyValue>
                <KeyValue label="Language">English labels, original Korean retained</KeyValue>
              </dl>
              <p className="mt-4 text-[12px] leading-relaxed text-fog-500">
                The upstream service sends no CORS headers, so every call is made from the server.
                Requests are cached per endpoint and a failed feed degrades a single module rather
                than the whole page.
              </p>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-ink-800 px-4 py-3">
                <p className="eyebrow">Endpoints consumed</p>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="stat-table">
                  <tbody>
                    {ENDPOINTS.map((endpoint) => (
                      <tr key={endpoint.path}>
                        <td className="!text-left">
                          <code className="block max-w-[320px] truncate text-[11.5px] text-lime-300/90">
                            {endpoint.path}
                          </code>
                          <span className="mt-0.5 block text-[11px] text-fog-500">{endpoint.what}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading eyebrow="Legal" title="Attribution" />
          <div className="mt-5 max-w-3xl space-y-3 text-[13px] leading-relaxed text-fog-500">
            <p>
              PBA Hub is an unofficial, independent project. The Professional Billiards Association,
              PBA, LPBA, the Dream Tour, the Challenge Tour and the PBA Team League, together with all
              tournament names, logos and player likenesses, are the property of their respective
              owners.
            </p>
            <p>
              Statistics are reproduced from the association&apos;s own public data service for
              informational purposes. If a figure here disagrees with the official site, the official
              site is correct.
            </p>
            <p>
              Live scores are read from the association&apos;s scoring terminal. When no table is
              active the feed is empty, and this site reports idle rather than inferring a result.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-display text-lg font-bold text-fog-100">Go straight to the source</h2>
              <p className="mt-1 text-[13px] text-fog-500">
                The official site carries entry forms, rule books and ticket information.
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="https://www.pbatour.org/en/index"
                target="_blank"
                rel="noreferrer noopener"
                className="press rounded-lg bg-lime-400 px-4 py-2 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
              >
                pbatour.org ↗
              </a>
              <Link
                href="/schedule"
                className="rounded-lg border border-ink-700 px-4 py-2 text-[13px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
              >
                Browse schedule
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
