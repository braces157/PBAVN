import { NextResponse } from "next/server";
import { IN_PLAY, getScorecard, getSetInnings } from "@/lib/pba/scoreboard";
import { analyseSet } from "@/lib/match";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pstCode = (searchParams.get("pstCode") ?? "").trim();
  const requestedSetParam = searchParams.get("set");
  const requestedSet =
    requestedSetParam && /^\d{1,2}$/.test(requestedSetParam) ? Number(requestedSetParam) : null;

  if (!/^\d{1,12}$/.test(pstCode)) {
    return NextResponse.json({ error: "Invalid match code" }, { status: 400 });
  }

  const scorecard = await getScorecard(pstCode, IN_PLAY);
  const sets = scorecard.sets;
  const latestSet = sets.at(-1) ?? null;

  let chosenSet =
    requestedSet !== null ? sets.find((s) => s.setNo === requestedSet) ?? latestSet : latestSet;
  let innings = chosenSet?.pcgmCode
    ? await getSetInnings(chosenSet.pcgmCode, IN_PLAY)
    : { players: [], breaker: null, rows: [] };

  // When the live set just opened (no completed inning sheet yet), fall back to the
  // most recent prior set that has published turn-by-turn innings so charts stay populated.
  if (requestedSet === null && innings.rows.length === 0 && sets.length > 1) {
    for (let i = sets.length - 2; i >= 0; i -= 1) {
      const candidate = sets[i];
      if (!candidate?.pcgmCode) continue;
      const candidateInnings = await getSetInnings(candidate.pcgmCode, IN_PLAY);
      if (candidateInnings.rows.length > 0) {
        chosenSet = candidate;
        innings = candidateInnings;
        break;
      }
    }
  }

  const analysed = chosenSet ? analyseSet(chosenSet, innings.rows.length > 0 ? innings : null) : null;

  return NextResponse.json(
    {
      pstCode,
      sets,
      totals: scorecard.totals,
      latestSetNo: latestSet?.setNo ?? 0,
      displaySetNo: chosenSet?.setNo ?? 0,
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
