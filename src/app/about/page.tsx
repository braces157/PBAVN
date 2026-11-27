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

        <section id="rules" className="mt-10 scroll-mt-20">
          <SectionHeading
            eyebrow="Fan guide"
            title="How PBA 3-Cushion Works"
            description="Key differences between PBA/LPBA/Team League and traditional UMB 3-cushion billiards."
          />

          <div className="mt-4 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Core scoring
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">2-Point Bank Shots &amp; No Equalizer</h3>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">1 pt:</strong> Standard 3-cushion carom (object ball first).</li>
                <li><strong className="text-foreground">2 pts (Bank Shot):</strong> Cue ball hits a cushion before the first object ball — no penalty on a miss.</li>
                <li><strong className="text-foreground">No equalizing inning:</strong> The set ends the instant a player reaches the target score, making the opening break (<strong className="text-foreground">Lag / Break</strong>) a real edge.</li>
                <li><strong className="text-foreground">Shot clock:</strong> 35 seconds per shot with limited timeouts per set.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--pba)]">
                PBA &amp; LPBA Tours
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Round Formats &amp; Shootouts</h3>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">PBA R128 &amp; R64:</strong> Best of 4 sets (15 pts). Tied <strong className="text-foreground">2–2</strong> goes to a sudden-death <strong className="text-foreground">Shootout (SO)</strong> from the break formation.</li>
                <li><strong className="text-foreground">PBA R32–QF / SF–Final:</strong> Best of 5 (15/11 pts) and Best of 7 (15/11 pts).</li>
                <li><strong className="text-foreground">LPBA PPQ / PQ / R64:</strong> Single-game <strong className="text-foreground">25-point / 50-minute</strong> format (ties broken by HR1 → HR2 → Banking lag).</li>
                <li><strong className="text-foreground">LPBA R32+:</strong> Set format to 11 pts (deciding set 9 pts); Final is Best of 7.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                PBA Team League
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">7-Set Order &amp; 3–2–1 Points</h3>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">Fixed 7-set order (first to 4):</strong> S1 Men&apos;s Doubles (11) · S2 Women&apos;s Doubles (9) · S3 Men&apos;s Singles (15) · S4 Mixed Doubles (9) · S5 Men&apos;s Singles (11) · S6 Women&apos;s Singles (9) · S7 Men&apos;s Singles (11).</li>
                <li><strong className="text-foreground">Match points:</strong> 4–0 / 4–1 / 4–2 = <strong className="text-foreground">3 pts</strong> (loser 0). 4–3 = <strong className="text-foreground">2 pts</strong> (loser <strong className="text-foreground">1 pt</strong>).</li>
                <li><strong className="text-foreground">Postseason:</strong> Each round winner clinches a playoff berth; duplicate winners open Wild Card spots by Overall standings.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Season stakes
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">World Championship &amp; Q-School</h3>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">World Championship (Top 32 Prize Money):</strong> Season finale major with 8 groups of 4 → R16 knockout (₩200M PBA champion prize).</li>
                <li><strong className="text-foreground">Division 1 Survival (Top ~60 Points):</strong> Top ~60 retain their PBA1 tour card; lower finishers are relegated to <strong className="text-foreground">Q-School</strong>.</li>
                <li><strong className="text-foreground">Dream Tour Promotion:</strong> Top 20 in Dream Tour earn direct promotion to PBA1.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Special awards
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Perfect Q &amp; Welcome Top Ranking</h3>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">Perfect Q (퍼펙트큐):</strong> Clearing an entire set in 1 single inning (15 pts in 1 inn for PBA / 11 pts for LPBA — pays ₩10M in regular tours, ₩20M at World Championship).</li>
                <li><strong className="text-foreground">Welcome Top Ranking:</strong> Awarded to the highest single-match average in each tournament (₩4M).</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Glossary
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Reading the Abbreviations</h3>
              <dl className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                <div><dt className="inline font-mono font-semibold text-foreground">AVG</dt> — <dd className="inline">Points scored per inning.</dd></div>
                <div><dt className="inline font-mono font-semibold text-foreground">HR</dt> — <dd className="inline">High run (longest consecutive point streak).</dd></div>
                <div><dt className="inline font-mono font-semibold text-foreground">1P / 2P / BS%</dt> — <dd className="inline">1-pt shots, 2-pt bank shots, and share of points from bank shots.</dd></div>
                <div><dt className="inline font-mono font-semibold text-foreground">GP9 / GP11 / GP15</dt> — <dd className="inline">Set race target (9, 11, or 15 points).</dd></div>
                <div><dt className="inline font-mono font-semibold text-foreground">SO / KST</dt> — <dd className="inline">Sudden-death Shootout / Korea Standard Time (UTC+9).</dd></div>
              </dl>
            </div>
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

            <details className="overflow-hidden rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer items-center justify-between border-b border-border bg-secondary/40 px-4 py-3 text-xs font-semibold text-foreground">
                <span>Upstream endpoints consumed ({ENDPOINTS.length})</span>
                <span className="font-normal text-muted-foreground">Click to expand</span>
              </summary>
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
            </details>
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
