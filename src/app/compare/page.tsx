import type { Metadata } from "next";
import Link from "next/link";
import { getHeadToHead, getPlayer, getPlayerSeasonStats, getPlayers } from "@/lib/pba/api";
import { getCurrentSeason, getSeasonList, getRankingBoard } from "@/lib/pba/service";
import {
  hasStatData,
  leagueByCode,
  normalizePlayer,
  normalizePlayerStat,
  winRate,
  type Player,
} from "@/lib/normalize";
import { average, grouped, percent, pick } from "@/lib/format";
import { asset, isRealAsset } from "@/lib/pba/http";
import { PlayerAvatar, NationPlate } from "@/components/ui/media";
import { Chip, EmptyState, SectionHeading, cn } from "@/components/ui/primitives";
import { PageHeader } from "@/components/domain/filter-bar";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Head-to-head",
  description:
    "Compare any two PBA or LPBA professionals — career profile, season averages and their direct head-to-head record.",
};

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string; q1?: string; q2?: string; season?: string }>;
}

/** Resolve a typed name to a member code so the page stays linkable. */
async function resolveCode(code?: string, query?: string): Promise<string | null> {
  if (code) return code;
  const term = (query ?? "").trim();
  if (!term) return null;
  const { list } = await getPlayers({ page: 1, pageSize: 1, name: term });
  return list[0]?.MemCode ?? null;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const seasons = await getSeasonList();
  const current = await getCurrentSeason();
  const seasonCode =
    params.season && seasons.some((s) => s.SeasonCode === params.season) ? params.season : current.SeasonCode;

  const [codeA, codeB] = await Promise.all([
    resolveCode(params.a, params.q1),
    resolveCode(params.b, params.q2),
  ]);

  const [rawA, rawB] = await Promise.all([
    codeA ? getPlayer(codeA) : null,
    codeB ? getPlayer(codeB) : null,
  ]);

  const playerA = rawA ? normalizePlayer(rawA) : null;
  const playerB = rawB ? normalizePlayer(rawB) : null;

  // The stats service keys on the circuit, so each player is read with their
  // own. A head-to-head record only exists when both play the same circuit.
  const pbaTypeA = playerA?.league || "PBA1";
  const pbaTypeB = playerB?.league || "PBA1";
  const sharedType = pbaTypeA === pbaTypeB ? pbaTypeA : null;

  const [statA, statB, h2h] = await Promise.all([
    codeA ? getPlayerSeasonStats({ memCode: codeA, seasonCode, pbaType: pbaTypeA }) : null,
    codeB ? getPlayerSeasonStats({ memCode: codeB, seasonCode, pbaType: pbaTypeB }) : null,
    codeA && codeB && sharedType
      ? getHeadToHead({ memberCode1: codeA, memberCode2: codeB, seasonCode, pbaType: sharedType })
      : null,
  ]);

  const lineA = normalizePlayerStat(statA);
  const lineB = normalizePlayerStat(statB);

  // On the empty view, offer the money-list leaders as one-click pairings so
  // the page demonstrates what a comparison looks like before any input.
  const suggestions =
    !playerA && !playerB
      ? (await getRankingBoard({ kind: "prize", leagueCode: "PBA1", season: seasonCode })).slice(0, 4)
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Comparison"
        title="Head-to-head"
        description="Put two professionals side by side: career profile, current-season statistics and every recorded meeting between them."
      >
        <form action="/compare" className="grid max-w-2xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="search"
            name="q1"
            defaultValue={params.q1 ?? (playerA ? playerA.name : "")}
            placeholder="Player one — name"
            aria-label="First player"
            className="field"
          />
          <input
            type="search"
            name="q2"
            defaultValue={params.q2 ?? (playerB ? playerB.name : "")}
            placeholder="Player two — name"
            aria-label="Second player"
            className="field"
          />
          <button
            type="submit"
            className="press rounded-md bg-lime-400 px-4 py-2 text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
          >
            Compare
          </button>
        </form>
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {!playerA && !playerB ? (
          <div>
            <EmptyState
              title="Pick two players"
              description="Search by name above — English or Korean both work. You can also open any player profile and use the compare link."
              action={
                <Link
                  href="/players"
                  className="mt-1 rounded-md border border-ink-700 px-3 py-1.5 text-[12.5px] text-fog-300 hover:border-ink-500 hover:text-fog-100"
                >
                  Browse the directory
                </Link>
              }
            />
            {suggestions.length >= 2 && (
              <section className="mt-6">
                <p className="eyebrow mb-3">Or start from the money list</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 2].map((start) => {
                    const a = suggestions[start];
                    const b = suggestions[start + 1];
                    if (!a || !b) return null;
                    return (
                      <Link
                        key={`${a.MemCode}-${b.MemCode}`}
                        href={`/compare?a=${a.MemCode}&b=${b.MemCode}&season=${seasonCode}`}
                        className="surface card-hover flex items-center justify-between gap-3 p-4"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <PlayerAvatar
                            path={a.ImgURL}
                            src={isRealAsset(a.ImgURL) ? asset(a.ImgURL) : null}
                            name={pick(a.PlayerNameEN, a.PlayerNameKO)}
                            size="sm"
                          />
                          <span className="truncate text-[13px] font-semibold text-fog-100">
                            {pick(a.PlayerNameEN, a.PlayerNameKO)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-fog-600">
                          vs
                        </span>
                        <span className="flex min-w-0 items-center justify-end gap-2.5">
                          <span className="truncate text-[13px] font-semibold text-fog-100">
                            {pick(b.PlayerNameEN, b.PlayerNameKO)}
                          </span>
                          <PlayerAvatar
                            path={b.ImgURL}
                            src={isRealAsset(b.ImgURL) ? asset(b.ImgURL) : null}
                            name={pick(b.PlayerNameEN, b.PlayerNameKO)}
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
              <CompareCard player={playerA} code={codeA} label="Player one" />
              <CompareCard player={playerB} code={codeB} label="Player two" />
            </div>

            {h2h && playerA && playerB ? (
              <section className="mt-10">
                <SectionHeading
                  eyebrow="Direct record"
                  title="When they meet"
                  description={`${h2h.total_matches} recorded meetings in the ${seasons.find((s) => s.SeasonCode === seasonCode)?.SeasonTitle ?? seasonCode} season.`}
                />

                <div className="mt-6 surface overflow-hidden">
                  <div className="grid grid-cols-3 items-center gap-2 border-b border-ink-800 px-5 py-5">
                    <div className="text-left">
                      <p className="truncate text-[13px] font-semibold text-fog-100">
                        {playerA.name.split(" ").slice(-1)[0]}
                      </p>
                      <p className="tnum mt-1 font-display text-3xl font-bold text-lime-400">
                        {h2h.player1_wins ?? 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fog-600">
                        Matches won
                      </p>
                      <p className="tnum mt-1 text-[11px] text-fog-500">{h2h.total_matches} played</p>
                    </div>
                    <div className="text-right">
                      <p className="truncate text-[13px] font-semibold text-fog-100">
                        {playerB.name.split(" ").slice(-1)[0]}
                      </p>
                      <p className="tnum mt-1 font-display text-3xl font-bold text-rose-450">
                        {h2h.player2_wins ?? 0}
                      </p>
                    </div>
                  </div>

                  <dl className="divide-y divide-ink-800">
                    {(
                      [
                        ["Average", h2h.player1_average, h2h.player2_average, "avg"],
                        ["High run", h2h.player1_hr, h2h.player2_hr, "int"],
                        ["Innings", h2h.player1_inn, h2h.player2_inn, "int"],
                        ["Points", h2h.player1_total_score, h2h.player2_total_score, "int"],
                        // Closing probability is the clutch stat the tour
                        // publishes and almost nobody shows.
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
                      const total = l + r || 1;
                      const leftPct = (l / total) * 100;
                      return (
                        <div key={label} className="px-5 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <span
                              className={cn(
                                "tnum w-16 text-left text-[13px] font-semibold",
                                l > r ? "text-lime-400" : "text-fog-200",
                              )}
                            >
                              {formatH2H(unit, left)}
                            </span>
                            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog-600">
                              {label}
                            </span>
                            <span
                              className={cn(
                                "tnum w-16 text-right text-[13px] font-semibold",
                                r > l ? "text-rose-450" : "text-fog-200",
                              )}
                            >
                              {formatH2H(unit, right)}
                            </span>
                          </div>
                          <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-ink-800">
                            <span className="bg-lime-400/70" style={{ width: `${leftPct}%` }} />
                            <span className="bg-rose-450/70" style={{ width: `${100 - leftPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </section>
            ) : (
              playerA &&
              playerB && (
                <EmptyState
                  className="mt-10"
                  title="No recorded meetings"
                  description={`${playerA.name} and ${playerB.name} have not met in the ${seasonCode} season according to the association's records. Try another season.`}
                />
              )
            )}

            {hasStatData(lineA) || hasStatData(lineB) ? (
              <section className="mt-12">
                <SectionHeading eyebrow="Season form" title="Current season statistics" />
                <div className="mt-6 overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900">
                  <table className="stat-table">
                    <thead>
                      <tr>
                        <th className="!text-left">Metric</th>
                        <th>{playerA?.shortName ?? "—"}</th>
                        <th>{playerB?.shortName ?? "—"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Matches", lineA.matches, lineB.matches, "int"],
                          ["Wins", lineA.wins, lineB.wins, "int"],
                          ["Losses", lineA.losses, lineB.losses, "int"],
                          ["Average", lineA.average, lineB.average, "avg"],
                          ["High run", lineA.highRun, lineB.highRun, "int"],
                          ["Innings", lineA.innings, lineB.innings, "int"],
                          ["Points", lineA.points, lineB.points, "int"],
                          ["Bank shot", lineA.bankShotRate, lineB.bankShotRate, "pct"],
                          ["First shot", lineA.firstShotRate, lineB.firstShotRate, "pct"],
                          ["Attack success", lineA.attackRate, lineB.attackRate, "pct"],
                          ["Long run", lineA.longRunRate, lineB.longRunRate, "pct"],
                        ] as [string, number, number, "avg" | "int" | "pct"][]
                      ).map(([label, left, right, unit]) => (
                        <tr key={label}>
                          <td className="!text-left text-fog-400">{label}</td>
                          <td
                            className={cn(
                              "font-semibold",
                              Number(left) > Number(right) ? "text-lime-400" : "text-fog-200",
                            )}
                          >
                            {formatH2H(unit, left)}
                          </td>
                          <td
                            className={cn(
                              "font-semibold",
                              Number(right) > Number(left) ? "text-rose-450" : "text-fog-200",
                            )}
                          >
                            {formatH2H(unit, right)}
                          </td>
                        </tr>
                      ))}
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
  const n = Number(value) || 0;
  if (!n) return "—";
  if (unit === "avg") return n.toFixed(3);
  if (unit === "pct") return `${n.toFixed(1)}%`;
  return grouped(n);
}

function CompareCard({
  player,
  code,
  label,
}: {
  player: Player | null;
  code: string | null;
  label: string;
}) {
  if (!player) {
    return (
      <div className="surface flex min-h-[132px] items-center justify-center p-5">
        <p className="text-[13px] text-fog-500">
          {code ? `No player found for ${code}` : `${label} — search a name above`}
        </p>
      </div>
    );
  }

  const league = leagueByCode(player.league);

  return (
    <Link href={`/players/${player.code}`} className="surface card-hover group flex items-center gap-4 p-4">
      <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={league.tone} className="!text-[9px]">
            {league.name}
          </Chip>
          <NationPlate code={player.nation} />
        </div>
        <p className="mt-1.5 truncate font-display text-[15px] font-bold text-fog-100 group-hover:text-lime-300">
          {pick(player.name, player.nameKo)}
        </p>
        <p className="tnum mt-1 text-[11.5px] text-fog-500">
          AVG {average(player.average)} · HR {player.highRun} · {percent(winRate(player), 0)} win
        </p>
      </div>
    </Link>
  );
}
