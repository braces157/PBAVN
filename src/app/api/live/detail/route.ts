import { NextResponse } from "next/server";
import { IN_PLAY, getScorecard, getSetInnings } from "@/lib/pba/scoreboard";
import { analyseSet } from "@/lib/match";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pstCode = (searchParams.get("pstCode") ?? "").trim();

  if (!/^\d{1,12}$/.test(pstCode)) {
    return NextResponse.json({ error: "Invalid match code" }, { status: 400 });
  }

  const scorecard = await getScorecard(pstCode, IN_PLAY);
  const latestSet = scorecard.sets.at(-1) ?? null;
  const innings = latestSet?.pcgmCode
    ? await getSetInnings(latestSet.pcgmCode, IN_PLAY)
    : { players: [], breaker: null, rows: [] };
  const analysed = latestSet ? analyseSet(latestSet, innings.rows.length > 0 ? innings : null) : null;

  return NextResponse.json(
    {
      pstCode,
      sets: scorecard.sets,
      totals: scorecard.totals,
      latestSetNo: latestSet?.setNo ?? 0,
      latestTarget: analysed?.target ?? null,
      innings,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    },
  );
}
