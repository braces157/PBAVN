import { NextResponse } from "next/server";
import { getPlayers, getRanking } from "@/lib/pba/api";
import { getCurrentSeason } from "@/lib/pba/service";

/**
 * A frozen, minimal index of every professional for instant header search.
 *
 * The full directory is ~1700 rows; projecting it to four short fields keeps the
 * payload around 40 KB and lets the client rank keystrokes with no network hop.
 * This route is the only way the index leaves the server, so the client cannot
 * import the upstream API by accident.
 */
export const dynamic = "force-dynamic";

interface IndexRow {
  /** member code */
  c: string;
  /** English name */
  e: string;
  /** Korean name, omitted when it repeats the English one */
  k: string;
  /** circuit code */
  l: string;
  /** prize or points rank, 0 when unranked */
  r?: number;
  /** nation code */
  n?: string;
}

export async function GET() {
  const season = await getCurrentSeason();
  const [{ list }, pbaRanks, lpbaRanks, dreamRanks] = await Promise.all([
    getPlayers({ page: 1, pageSize: 2000 }),
    getRanking({ kind: "prize", leagueCode: "PBA1", season: season.SeasonCode }).catch(() => []),
    getRanking({ kind: "prize", leagueCode: "LPBA1", season: season.SeasonCode }).catch(() => []),
    getRanking({ kind: "prize", leagueCode: "PBA2", season: season.SeasonCode }).catch(() => []),
  ]);

  const rankByCode = new Map<string, number>();
  for (const board of [pbaRanks, lpbaRanks, dreamRanks]) {
    board.forEach((row, idx) => {
      if (row.MemCode && !rankByCode.has(row.MemCode)) {
        rankByCode.set(row.MemCode, row.Rank || idx + 1);
      }
    });
  }

  const rows: IndexRow[] = list
    .filter((player) => player.MemCode && (player.PlayerNameEN || player.PlayerNameKO))
    .map((player) => {
      const english = (player.PlayerNameEN || player.PlayerNameKO || "").trim();
      const korean = (player.PlayerNameKO || "").trim();
      const rank =
        rankByCode.get(player.MemCode) ??
        (Number(player.PrizeRank) > 0
          ? Number(player.PrizeRank)
          : Number(player.RankingPointRank) > 0
            ? Number(player.RankingPointRank)
            : 0);
      return {
        c: player.MemCode,
        e: english,
        k: korean === english ? "" : korean,
        l: player.LeagueCode || "",
        ...(rank > 0 ? { r: rank } : {}),
        ...(player.NationCode ? { n: player.NationCode } : {}),
      };
    });

  if (rows.length === 0) {
    return NextResponse.json(
      { rows: [] },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    { rows },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
