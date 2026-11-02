import Link from "next/link";
import { getPlayers, getPressList, getTeamStandings } from "@/lib/pba/api";
import {
  englishSponsor,
  englishVenue,
  getActiveTeamSeason,
  getCurrentSeason,
  getLeaders,
  getRankingBoard,
  getSeasonEvents,
  getSeasonSnapshot,
  seasonLabel,
  teamLeagueTitle,
} from "@/lib/pba/service";
import { normalizeTeam, normalizeArticle, LEADER_CATEGORIES } from "@/lib/normalize";
import { excerpt, fmtDate, grouped, percent, pick, wonCompact } from "@/lib/format";
import { asset, isRealAsset } from "@/lib/pba/http";
import { FeaturedEvent, EventRow } from "@/components/domain/event-card";
import { RankingTable } from "@/components/domain/ranking-table";
import { StandingsTable } from "@/components/domain/standings-table";
import { PlayerAvatar } from "@/components/ui/media";
import { SafeImage } from "@/components/ui/safe-image";
import { Chip, EmptyState, LiveChip, SectionHeading, Stat, TextLink, cn } from "@/components/ui/primitives";

export const revalidate = 600;

export default async function HomePage() {
  const season = await getCurrentSeason();
  const seasonCode = season.SeasonCode;

  const [snapshot, events, pbaRank, lpbaRank, teamSeason, press, leaders, directory] = await Promise.all([
    getSeasonSnapshot(seasonCode),
    getSeasonEvents(seasonCode),
    getRankingBoard({ kind: "prize", leagueCode: "PBA1", season: seasonCode }),
    getRankingBoard({ kind: "prize", leagueCode: "LPBA1", season: seasonCode }),
    getActiveTeamSeason(),
    getPressList(1, 3),
    getLeaders(seasonCode, "PBA1"),
    getPlayers({ page: 1, pageSize: 1 }),
  ]);

  const standings = teamSeason
    ? (
        await getTeamStandings({
          seasonCode: teamSeason.season.시즌코드,
          leagueCode: String(teamSeason.season.리그코드),
        })
      ).map(normalizeTeam)
    : [];

  const articles = press.list.map(normalizeArticle);

  const currentEvent = snapshot.current;
  const upcoming = snapshot.upcoming.slice(0, 4);
  const completed = snapshot.completed.slice(0, 3);

  const leaderPicks = LEADER_CATEGORIES.filter((c) => ["에버리지", "하이런", "최다승", "공격성공률"].includes(c.key))
    .map((category) => ({
      category,
      rows: leaders.filter((row) => row.Category === category.key).sort((a, b) => a.Rank - b.Rank).slice(0, 3),
    }))
    .filter((group) => group.rows.length > 0);

  const prizeLeader = pbaRank[0] ?? null;

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-60" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.13] blur-[120px]"
          style={{ background: "var(--color-lime-400)" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-32 top-32 h-[420px] w-[420px] rounded-full opacity-[0.10] blur-[110px]"
          style={{ background: "var(--color-violet-450)" }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="rise">
              <div className="flex flex-wrap items-center gap-2">
                {snapshot.live.length > 0 ? <LiveChip label="On now" /> : null}
                <Chip tone="neutral">{seasonLabel(season)} season</Chip>
                <Chip tone="neutral">Live pbatour.org data</Chip>
              </div>

              <h1 className="display-xl mt-6 text-fog-100">
                Every frame
                <br />
                of the tour,
                <br />
                <span className="text-lime-400">scored.</span>
              </h1>

              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-fog-400">
                Three-cushion at professional speed. Live match state, player and team statistics,
                prize and ranking points, and the full PBA &amp; LPBA calendar — read from the
                association&apos;s own data service.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link
                  href="/live"
                  className="press inline-flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2.5 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
                >
                  <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-ink-950" />
                  Match centre
                </Link>
                <Link
                  href="/players"
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2.5 text-[13.5px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
                >
                  Player directory
                  <span className="tnum text-[11px] text-fog-600">{grouped(directory.total)}</span>
                </Link>
              </div>

              <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 border-t border-ink-800 pt-7 sm:grid-cols-4">
                <Stat label="Ranked players" value={grouped(directory.total)} />
                <Stat label="Tour events" value={grouped(events.length)} />
                <Stat label="Team clubs" value={grouped(standings.length || 0)} />
                <Stat
                  label="Season prize"
                  value={teamSeason ? wonCompact(teamSeason.season.상금) : "—"}
                  accent
                />
              </dl>
            </div>

            <div className="rise space-y-3" style={{ animationDelay: "90ms" }}>
              {currentEvent ? (
                <FeaturedEvent event={currentEvent} />
              ) : (
                <EmptyState
                  title="No events published yet"
                  description="The association has not published a calendar for this season."
                />
              )}

              {upcoming.length > 0 && (
                <div className="surface px-4 py-2">
                  <p className="eyebrow px-1 pb-1 pt-2">Next up</p>
                  {upcoming.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- leader strip */}
      {prizeLeader && (
        <section className="border-b border-ink-800 bg-ink-900/40">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-4 px-4 py-5 sm:px-6 lg:px-10">
            <p className="eyebrow shrink-0">Prize-money leader</p>
            <Link
              href={`/players/${prizeLeader.MemCode}`}
              className="group flex items-center gap-3"
            >
              <PlayerAvatar
                path={prizeLeader.ImgURL}
                src={isRealAsset(prizeLeader.ImgURL) ? asset(prizeLeader.ImgURL) : null}
                name={prizeLeader.PlayerNameEN || prizeLeader.PlayerNameKO}
                size="sm"
                ring
              />
              <span>
                <span className="block text-[14px] font-semibold text-fog-100 group-hover:text-lime-300">
                  {pick(prizeLeader.PlayerNameEN, prizeLeader.PlayerNameKO)}
                </span>
                <span className="tnum block text-[11.5px] text-fog-500">
                  {wonCompact(prizeLeader.Prize)} · {grouped(prizeLeader.RankingPoint)} pts
                </span>
              </span>
            </Link>
            <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-fog-500">
              <span className="tnum">
                <span className="text-fog-300">{grouped(pbaRank.length)}</span> PBA ranked
              </span>
              <span className="tnum">
                <span className="text-fog-300">{grouped(lpbaRank.length)}</span> LPBA ranked
              </span>
              {completed[0] && (
                <span>
                  Last final:{" "}
                  <span className="text-fog-300">{completed[0].title}</span>
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- rankings */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
        <SectionHeading
          eyebrow="Standings"
          title="Who is banking the most"
          description="Prize money and ranking points for the current season, straight from the association's ranking tables."
          action={<TextLink href="/rankings">All rankings</TextLink>}
        />

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <RankingPanel
            title="PBA Tour"
            subtitle="Men's top tier"
            tone="lime"
            href="/rankings?league=PBA1"
            rows={pbaRank}
            metric="prize"
          />
          <RankingPanel
            title="LPBA Tour"
            subtitle="Women's top tier"
            tone="rose"
            href="/rankings?league=LPBA1"
            rows={lpbaRank}
            metric="prize"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ team */}
      {standings.length > 0 && (
        <section className="border-y border-ink-800 bg-ink-900/30">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
              <div>
                <SectionHeading
                  eyebrow="Team league"
                  title="Franchise standings"
                  description={
                    teamSeason
                      ? `${teamLeagueTitle(teamSeason.season.시즌명)}${teamSeason.liveRound ? ` · Round ${teamSeason.liveRound.라운드}` : ""}`
                      : undefined
                  }
                  action={<TextLink href="/teams">All teams</TextLink>}
                />
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <Stat
                    label="Leader"
                    value={standings[0]?.shortName ?? "—"}
                    hint={`${standings[0]?.points ?? 0} points`}
                  />
                  <Stat
                    label="Round"
                    value={teamSeason?.liveRound ? `R${teamSeason.liveRound.라운드}` : "—"}
                    hint={teamSeason?.liveRound ? englishVenue(teamSeason.liveRound.경기장소) : ""}
                  />
                </div>
                <dl className="mt-6 space-y-0">
                  {[
                    { label: "Season", value: teamSeason?.season.시즌명 ?? "—" },
                    { label: "Sponsor", value: teamSeason ? englishSponsor(teamSeason.season.스폰서) : "—" },
                    {
                      label: "Window",
                      value: teamSeason
                        ? `${teamSeason.season.리그시작일자} → ${teamSeason.season.리그종료일자}`
                        : "—",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 border-b border-ink-800 py-2.5 last:border-0"
                    >
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fog-600">
                        {row.label}
                      </dt>
                      <dd className="text-right text-[13px] text-fog-200">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="surface overflow-hidden">
                <StandingsTable rows={standings} limit={8} compact />
                <div className="border-t border-ink-800 px-4 py-3">
                  <TextLink href="/teams">Full team league tables</TextLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- leaders */}
      {leaderPicks.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
          <SectionHeading
            eyebrow="Season leaders"
            title="The numbers that decide titles"
            description="Top three in each headline statistical category across the PBA Tour this season."
            action={<TextLink href="/records">Full record book</TextLink>}
          />
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {leaderPicks.map(({ category, rows }) => (
              <div key={category.key} className="surface p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fog-500">
                    {category.label}
                  </p>
                  <Chip tone="neutral" className="!text-[9.5px]">
                    PBA
                  </Chip>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {rows.map((row) => (
                    <li key={`${category.key}-${row.MemCode}-${row.Rank}`}>
                      <Link
                        href={`/players/${row.MemCode}`}
                        className="group flex items-center justify-between gap-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="tnum w-4 shrink-0 text-[11px] text-fog-600">{row.Rank}</span>
                          <span className="truncate text-[12.5px] text-fog-200 group-hover:text-lime-300">
                            {row.MemNameEn || row.MemName}
                          </span>
                        </span>
                        <span className="tnum shrink-0 font-display text-[12.5px] font-bold text-fog-100">
                          {formatLeaderValue(category.unit, row.Value)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- news */}
      {articles.length > 0 && (
        <section className="border-t border-ink-800 bg-ink-900/30">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
            <SectionHeading
              eyebrow="Newsroom"
              title="From the association"
              action={<TextLink href="/news">All news</TextLink>}
            />
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.seq}
                  href={`/news/${article.seq}`}
                  className="surface card-hover group overflow-hidden"
                >
                  <div className="h-40 w-full overflow-hidden bg-ink-800">
                    <SafeImage
                      src={article.image}
                      alt={article.title}
                      className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      fallback={
                        <div className="grid h-40 w-full place-items-center">
                          <span className="eyebrow">PBA Newsroom</span>
                        </div>
                      }
                    />
                  </div>
                  <div className="p-4">
                    <p className="tnum text-[10.5px] uppercase tracking-[0.1em] text-fog-600">
                      {fmtDate(article.date)}
                    </p>
                    <h3 className="mt-2 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-fog-100 group-hover:text-lime-300">
                      {article.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-fog-500">
                      {excerpt(article.body, 120)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function formatLeaderValue(unit: "avg" | "int" | "pct", value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return percent(n);
  return grouped(n);
}

function RankingPanel({
  title,
  subtitle,
  tone,
  href,
  rows,
  metric,
}: {
  title: string;
  subtitle: string;
  tone: "lime" | "rose";
  href: string;
  rows: Awaited<ReturnType<typeof getRankingBoard>>;
  metric: "prize" | "point";
}) {
  const accent = tone === "lime" ? "text-lime-400" : "text-rose-450";
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3.5">
        <div>
          <h3 className={cn("font-display text-[15px] font-bold", accent)}>{title}</h3>
          <p className="mt-0.5 text-[11px] text-fog-600">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-400 transition-colors hover:border-ink-500 hover:text-fog-100"
        >
          View all
        </Link>
      </div>
      {rows.length > 0 ? (
        <RankingTable rows={rows} metric={metric} limit={6} hideSortBar />
      ) : (
        <div className="px-4 py-10 text-center text-[13px] text-fog-500">
          No ranking published for this season yet.
        </div>
      )}
    </div>
  );
}
