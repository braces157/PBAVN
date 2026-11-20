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
              className="field"
            />
            <input
              type="search"
              name="q2"
              defaultValue={q2 || (playerB ? playerB.name : "")}
              placeholder="Player two — name"
              aria-label="Second player"
              className="field"
            />
            <button
              type="submit"
              className="press rounded-[3px] bg-[var(--nav)] px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--link)]"
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

      <div className="mx-auto max-w-[1300px] px-3 py-5">
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
                  className="mt-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-[12px] font-semibold text-fog-200 hover:border-carom-400/50 hover:text-carom-300"
                >
                  Browse players
                </Link>
              }
            />
            {suggestions.length >= 2 && (
              <section className="mt-6">
                <p className="eyebrow mb-2.5">Top Ranked Matchups</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 2].map((start) => {
                    const a = suggestions[start];
                    const b = suggestions[start + 1];
                    if (!a || !b) return null;
                    return (
                      <Link
                        key={`${a.MemCode}-${b.MemCode}`}
                        href={`/compare?a=${a.MemCode}&b=${b.MemCode}&season=${seasonCode}`}
                        className="surface card-hover grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 p-3.5"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PlayerAvatar
                            path={a.ImgURL}
                            src={isRealAsset(a.ImgURL) ? asset(a.ImgURL) : null}
                            name={cleanPlayerName(pick(a.PlayerNameEN, a.PlayerNameKO))}
                            size="sm"
                          />
                          <span className="truncate text-[12.5px] font-semibold text-fog-100 sm:text-[13px]">
                            {cleanPlayerName(pick(a.PlayerNameEN, a.PlayerNameKO))}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.08em] text-carom-300">
                          vs
                        </span>
                        <span className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-[12.5px] font-semibold text-fog-100 sm:text-[13px]">
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
            <div className="grid gap-3 sm:grid-cols-2">
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

                <div className="surface mt-4 overflow-hidden">
                  <div className="grid grid-cols-3 items-center gap-2 border-b border-ink-800 bg-ink-850 px-5 py-4">
                    <div className="text-left">
                      <p className="truncate text-[12.5px] font-bold text-fog-100">
                        {playerA.name.split(" ").slice(-1)[0]}
                      </p>
                      <p className="tnum mt-1 font-display text-3xl font-extrabold text-carom-300">
                        {h2h.player1_wins ?? 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-fog-500">
                        Matches won
                      </p>
                      <p className="tnum mt-1 text-[11.5px] text-fog-450">{h2h.total_matches} played</p>
                    </div>
                    <div className="text-right">
                      <p className="truncate text-[12.5px] font-bold text-fog-100">
                        {playerB.name.split(" ").slice(-1)[0]}
                      </p>
                      <p className="tnum mt-1 font-display text-3xl font-extrabold text-gold-300">
                        {h2h.player2_wins ?? 0}
                      </p>
                    </div>
                  </div>

                  <ul className="divide-y divide-ink-800">
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
                        <li key={label} className="px-5 py-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <span
                              className={cn(
                                "tnum w-16 text-left text-[12.5px] font-bold",
                                l > r ? "text-carom-300" : "text-fog-300",
                              )}
                            >
                              {formatH2H(unit, left)}
                            </span>
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-fog-500">
                              {label}
                            </span>
                            <span
                              className={cn(
                                "tnum w-16 text-right text-[12.5px] font-bold",
                                r > l ? "text-gold-300" : "text-fog-300",
                              )}
                            >
                              {formatH2H(unit, right)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
                            {sum > 0 && (
                              <>
                                <span className="bg-carom-400/80" style={{ width: `${leftPct}%` }} />
                                <span className="bg-gold-400/80" style={{ width: `${rightPct}%` }} />
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
                <div className="mt-4 overflow-x-auto rounded-[8px] border border-ink-750 bg-ink-900">
                  <table className="stat-table">
                    <thead>
                      <tr>
                        <th scope="col" className="!text-left">Metric</th>
                        <th scope="col" className="!text-carom-300">{playerA?.shortName ?? "—"}</th>
                        <th scope="col" className="!text-gold-300">{playerB?.shortName ?? "—"}</th>
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
                            <td className="!text-left text-fog-400">{label}</td>
                            <td className={cn("font-bold", leftWins ? "text-carom-300" : "text-fog-200")}>
                              {hasStatData(lineA) ? formatH2H(unit, left) : "—"}
                            </td>
                            <td className={cn("font-bold", rightWins ? "text-gold-300" : "text-fog-200")}>
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
      <div className="surface flex min-h-[108px] items-center justify-center p-4">
        <p className="text-[12.5px] text-fog-450">
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
        "surface card-hover group flex items-center gap-3.5 p-4",
        tone === "carom" ? "border-l-2 border-l-carom-400" : "border-l-2 border-l-gold-400",
      )}
    >
      <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={league.tone} className="!text-[9px]">
            {league.name}
          </Chip>
          <NationPlate code={player.nation} />
        </div>
        <p className="mt-1.5 truncate font-display text-[15px] font-bold text-fog-100 group-hover:text-carom-300">
          {cleanPlayerName(pick(player.name, player.nameKo))}
        </p>
        <p className="tnum mt-0.5 text-[11.5px] text-fog-450">
          AVG {average(player.average)} · HR {player.highRun} · {percent(winRate(player), 0)} win
        </p>
      </div>
    </Link>
  );
}
