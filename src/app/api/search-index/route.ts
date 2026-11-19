import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/pba/api";

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
}

export async function GET() {
  const { list } = await getPlayers({ page: 1, pageSize: 2000 });

  const rows: IndexRow[] = list
    .filter((player) => player.MemCode && (player.PlayerNameEN || player.PlayerNameKO))
    .map((player) => {
      const english = (player.PlayerNameEN || player.PlayerNameKO || "").trim();
      const korean = (player.PlayerNameKO || "").trim();
      return {
        c: player.MemCode,
        e: english,
        k: korean === english ? "" : korean,
        l: player.LeagueCode || "",
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
