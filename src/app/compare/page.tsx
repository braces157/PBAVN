import type { Metadata } from "next";
import Link from "next/link";
import { getHeadToHead, getPlayerSeasonStats, getPlayers } from "@/lib/pba/api";
import { getRequestFailures, trackFailures } from "@/lib/pba/failures";
import { getCurrentSeason, getPlayerCached, getSeasonList, getRankingBoard } from "@/lib/pba/service";
import {
  hasStatData,
  leagueByCode,
  normalizePlayer,
  normalizePlayerStat,
  statLeagueCode,
  winRate,
  type Player,
} from "@/lib/normalize";
import { average, cleanPlayerName, grouped, percent, pick } from "@/lib/format";
import { asset, isRealAsset } from "@/lib/pba/http";
import { PlayerAvatar, NationPlate } from "@/components/ui/media";
import { Chip, EmptyState, SectionHeading, cn } from "@/components/ui/primitives";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Head-to-head",
  description:
    "Compare any two PBA or LPBA 3-cushion professionals — career profile, season averages and direct head-to-head record.",
};

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string; q1?: string; q2?: string; season?: string }>;
}

async function resolveCode(code?: string, query?: string): Promise<string | null> {
  if (code) return code;
  const term = (query ?? "").trim();
  if (!term) return null;
  const { list } = await getPlayers({ page: 1, pageSize: 1, name: term });
  return list[0]?.MemCode ?? null;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q1 = (params.q1 ?? "").trim();
  const q2 = (params.q2 ?? "").trim();

  const data = await trackFailures(async () => {
    const [seasons, current, codeA, codeB] = await Promise.all([
      getSeasonList(),
      getCurrentSeason(),
      resolveCode(params.a, q1),
      resolveCode(params.b, q2),
    ]);
    const seasonCode =
      params.season && seasons.some((s) => s.SeasonCode === params.season) ? params.season : current.SeasonCode;

    const [rawA, rawB] = await Promise.all([
      codeA ? getPlayerCached(codeA) : null,
      codeB ? getPlayerCached(codeB) : null,
    ]);

    const playerA = rawA ? normalizePlayer(rawA) : null;
    const playerB = rawB ? normalizePlayer(rawB) : null;

    const pbaTypeA = statLeagueCode(playerA?.league ?? "PBA1");
    const pbaTypeB = statLeagueCode(playerB?.league ?? "PBA1");
    const sharedType = pbaTypeA === pbaTypeB ? pbaTypeA : null;

    const [statA, statB, h2h, suggestions] = await Promise.all([
      codeA ? getPlayerSeasonStats({ memCode: codeA, seasonCode, pbaType: pbaTypeA }) : null,
      codeB ? getPlayerSeasonStats({ memCode: codeB, seasonCode, pbaType: pbaTypeB }) : null,
      codeA && codeB && sharedType
        ? getHeadToHead({ memberCode1: codeA, memberCode2: codeB, seasonCode, pbaType: sharedType })
        : null,
      !playerA && !playerB
        ? getRankingBoard({ kind: "prize", leagueCode: "PBA1", season: seasonCode }).then((r) => r.slice(0, 4))
        : Promise.resolve([]),
    ]);

    return {
      seasons,
      seasonCode,
      codeA,
      codeB,
      playerA,
      playerB,
      sharedType,
      lineA: normalizePlayerStat(statA),
      lineB: normalizePlayerStat(statB),
      h2h,
      suggestions,
      failures: getRequestFailures(),
    };
  });

  const {
    seasons,
    seasonCode,
    codeA,
    codeB,
    playerA,
    playerB,
    sharedType,
    lineA,
    lineB,
    h2h,
    suggestions,
    failures,
  } = data;
  const seasonTitle = seasons.find((s) => s.SeasonCode === seasonCode)?.SeasonTitle ?? seasonCode;
  const missedSearch = Boolean((q1 && !playerA) || (q2 && !playerB));

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Comparison"
        title="Head-to-Head"
        description="Compare career averages, season statistics, and direct head-to-head records."
      >
        <div className="flex flex-col gap-2.5">
          <form action="/compare" className="grid max-w-2xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
            {params.season && <input type="hidden" name="season" value={seasonCode} />}
            <input
              type="search"
              name="q1"
              defaultValue={q1 || (playerA ? playerA.name : "")}
              placeholder="Player one — name"
              aria-label="First player"
              className="h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="search"
              name="q2"
              defaultValue={q2 || (playerB ? playerB.name : "")}
              placeholder="Player two — name"
              aria-label="Second player"
              className="h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Compare
            </button>
          </form>

          {(playerA || playerB) && seasons.length > 0 && (
            <FilterRow
              label="Season"
              basePath="/compare"
              paramKey="season"
              active={seasonCode}
              params={{
                a: playerA?.code ?? params.a,
                b: playerB?.code ?? params.b,
                q1: !playerA && q1 ? q1 : undefined,
                q2: !playerB && q2 ? q2 : undefined,
              }}
              options={seasons.map((s) => ({ value: s.SeasonCode, label: s.SeasonTitle || s.SeasonCode }))}
            />
          )}
        </div>
      </PageHeader>

      <div className="wrap py-6">
        {!playerA && !playerB ? (
          <div>
            <EmptyState
              title={missedSearch ? "No matching players found" : "Pick two players"}
              description={
                missedSearch
                  ? `Could not find player matches for ${[q1 && `“${q1}”`, q2 && `“${q2}”`].filter(Boolean).join(" and ")}. Try another spelling or browse the directory.`
                  : "Search by name above — English or Korean — or launch a comparison from any player profile."
              }
              action={
                <Link
                  href="/players"
                  className="mt-1 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
                >
                  Browse players
                </Link>
              }
            />
            {suggestions.length >= 2 && (
              <section className="mt-8">
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Top Ranked Matchups
                </p>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {[0, 2].map((start) => {
                    const a = suggestions[start];
                    const b = suggestions[start + 1];
                    if (!a || !b) return null;
                    return (
                      <Link
                        key={`${a.MemCode}-${b.MemCode}`}
                        href={`/compare?a=${a.MemCode}&b=${b.MemCode}&season=${seasonCode}`}
                        className="group grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40 hover:no-underline"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <PlayerAvatar
                            path={a.ImgURL}
                            src={isRealAsset(a.ImgURL) ? asset(a.ImgURL) : null}
                            name={cleanPlayerName(pick(a.PlayerNameEN, a.PlayerNameKO))}
                            size="sm"
                          />
                          <span className="truncate text-sm font-medium text-foreground">
                            {cleanPlayerName(pick(a.PlayerNameEN, a.PlayerNameKO))}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] font-medium uppercase text-muted-foreground">
                          vs
                        </span>
                        <span className="flex min-w-0 items-center justify-end gap-2.5">
                          <span className="truncate text-right text-sm font-medium text-foreground">
                            {cleanPlayerName(pick(b.PlayerNameEN, b.PlayerNameKO))}
                          </span>
                          <PlayerAvatar
                            path={b.ImgURL}
                            src={isRealAsset(b.ImgURL) ? asset(b.ImgURL) : null}
                            name={cleanPlayerName(pick(b.PlayerNameEN, b.PlayerNameKO))}
                            size="sm"
                          />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <CompareCard player={playerA} code={codeA} query={q1} label="Player one" tone="carom" />
              <CompareCard player={playerB} code={codeB} query={q2} label="Player two" tone="gold" />
            </div>

            {h2h && playerA && playerB ? (
              <section className="mt-8">
                <SectionHeading
                  eyebrow="Head-to-Head Record"
                  title="Direct Meetings"
                  description={`${h2h.total_matches} recorded meetings in the ${seasonTitle} season.`}
                />

                <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                  <div className="grid grid-cols-3 items-center gap-2 border-b border-border bg-secondary/40 px-5 py-4">
                    <div className="text-left">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {playerA.name.split(" ").slice(-1)[0]}
                      </p>
                      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {h2h.player1_wins ?? 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Matches won
                      </p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {h2h.total_matches} played
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {playerB.name.split(" ").slice(-1)[0]}
                      </p>
                      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {h2h.player2_wins ?? 0}
                      </p>
                    </div>
                  </div>

                  <ul className="divide-y divide-border/60">
                    {(
                      [
                        ["Average", h2h.player1_average, h2h.player2_average, "avg"],
                        ["High run", h2h.player1_hr, h2h.player2_hr, "int"],
                        ["Innings", h2h.player1_inn, h2h.player2_inn, "int"],
                        ["Points", h2h.player1_total_score, h2h.player2_total_score, "int"],
                        ["Closing rate", h2h.player1_closing_rate, h2h.player2_closing_rate, "pct"],
                        ["Attack success", h2h.player1_success_rate, h2h.player2_success_rate, "pct"],
                        ["1-pointers", h2h.player1_1point, h2h.player2_1point, "int"],
                        ["2-pointers", h2h.player1_2point, h2h.player2_2point, "int"],
                        ["2-point rate", h2h.player1_2point_rate, h2h.player2_2point_rate, "pct"],
                        ["Long runs", h2h.player1_long_cnt, h2h.player2_long_cnt, "int"],
                        ["Long run rate", h2h.player1_long_rate, h2h.player2_long_rate, "pct"],
                        ["First shot", h2h.player1_first_shot_rate, h2h.player2_first_shot_rate, "pct"],
                        ["Sets won", h2h.player1_set_wins, h2h.player2_set_wins, "int"],
                      ] as [string, number, number, "avg" | "int" | "pct"][]
                    ).map(([label, left, right, unit]) => {
                      const l = Number(left) || 0;
                      const r = Number(right) || 0;
                      const sum = l + r;
                      const leftPct = sum > 0 ? (l / sum) * 100 : 0;
                      const rightPct = sum > 0 ? 100 - leftPct : 0;
                      return (
                        <li key={label} className="px-5 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <span
                              className={cn(
                                "w-16 text-left font-mono text-xs font-semibold tabular-nums",
                                l > r ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                              )}
                            >
                              {formatH2H(unit, left)}
                            </span>
                            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              {label}
                            </span>
                            <span
                              className={cn(
                                "w-16 text-right font-mono text-xs font-semibold tabular-nums",
                                r > l ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                              )}
                            >
                              {formatH2H(unit, right)}
                            </span>
                          </div>
                          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                            {sum > 0 && (
                              <>
                                <span className="bg-emerald-500" style={{ width: `${leftPct}%` }} />
                                <span className="bg-amber-500" style={{ width: `${rightPct}%` }} />
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ) : (
              playerA &&
              playerB && (
                <EmptyState
                  className="mt-8"
                  title={sharedType ? "No recorded meetings" : "Different circuits"}
                  description={
                    sharedType
                      ? `${playerA.name} and ${playerB.name} have not met in the ${seasonTitle} season.`
                      : `${playerA.name} (${leagueByCode(playerA.league).name}) and ${playerB.name} (${leagueByCode(playerB.league).name}) compete on different tours, so direct head-to-head records do not apply.`
                  }
                />
              )
            )}

            {hasStatData(lineA) || hasStatData(lineB) ? (
              <section className="mt-8">
                <SectionHeading eyebrow="Season Comparison" title={`Season Statistics · ${seasonTitle}`} />
                <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="stat-table">
                    <thead>
                      <tr>
                        <th scope="col" className="!text-left">Metric</th>
                        <th scope="col" className="!text-emerald-600 dark:!text-emerald-400">{playerA?.shortName ?? "—"}</th>
                        <th scope="col" className="!text-amber-600 dark:!text-amber-400">{playerB?.shortName ?? "—"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Matches", lineA.matches, lineB.matches, "int", false],
                          ["Wins", lineA.wins, lineB.wins, "int", false],
                          ["Losses", lineA.losses, lineB.losses, "int", true],
                          ["Average", lineA.average, lineB.average, "avg", false],
                          ["High run", lineA.highRun, lineB.highRun, "int", false],
                          ["Innings", lineA.innings, lineB.innings, "int", false],
                          ["Points", lineA.points, lineB.points, "int", false],
                          ["Bank shot", lineA.bankShotRate, lineB.bankShotRate, "pct", false],
                          ["First shot", lineA.firstShotRate, lineB.firstShotRate, "pct", false],
                          ["Attack success", lineA.attackRate, lineB.attackRate, "pct", false],
                          ["Long run", lineA.longRunRate, lineB.longRunRate, "pct", false],
                        ] as [string, number, number, "avg" | "int" | "pct", boolean][]
                      ).map(([label, left, right, unit, lowerIsBetter]) => {
                        const l = Number(left) || 0;
                        const r = Number(right) || 0;
                        const bothPlayed = hasStatData(lineA) && hasStatData(lineB);
                        const leftWins = bothPlayed && (lowerIsBetter ? l < r : l > r);
                        const rightWins = bothPlayed && (lowerIsBetter ? r < l : r > l);
                        return (
                          <tr key={label}>
                            <td className="!text-left text-muted-foreground">{label}</td>
                            <td
                              className={cn(
                                "font-mono tabular-nums",
                                leftWins ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-foreground",
                              )}
                            >
                              {hasStatData(lineA) ? formatH2H(unit, left) : "—"}
                            </td>
                            <td
                              className={cn(
                                "font-mono tabular-nums",
                                rightWins ? "font-semibold text-amber-600 dark:text-amber-400" : "text-foreground",
                              )}
                            >
                              {hasStatData(lineB) ? formatH2H(unit, right) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function formatH2H(unit: "avg" | "int" | "pct", value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return `${n.toFixed(1)}%`;
  return grouped(n);
}

function CompareCard({
  player,
  code,
  query,
  label,
  tone,
}: {
  player: Player | null;
  code: string | null;
  query?: string;
  label: string;
  tone: "carom" | "gold";
}) {
  if (!player) {
    return (
      <div className="flex min-h-[108px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          {code
            ? `No player found for ${code}`
            : query
              ? `No player matched “${query}”`
              : `${label} — search a name above`}
        </p>
      </div>
    );
  }

  const league = leagueByCode(player.league);

  return (
    <Link
      href={`/players/${player.code}`}
      className={cn(
        "group flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40 hover:no-underline",
        tone === "carom" ? "border-l-2 border-l-emerald-500" : "border-l-2 border-l-amber-500",
      )}
    >
      <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={league.tone} className="!text-[9.5px]">
            {league.name}
          </Chip>
          <NationPlate code={player.nation} />
        </div>
        <p className="mt-1.5 truncate text-base font-semibold text-foreground group-hover:underline">
          {cleanPlayerName(pick(player.name, player.nameKo))}
        </p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          AVG {average(player.average)} · HR {player.highRun} · {percent(winRate(player), 0)} win
        </p>
      </div>
    </Link>
  );
}
