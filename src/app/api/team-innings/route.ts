import { NextResponse } from "next/server";
import { getBoutInnings } from "@/lib/pba/team-matches";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tgCode = searchParams.get("tgCode") ?? "";

  if (!/^\d{1,12}$/.test(tgCode)) {
    return NextResponse.json({ error: "Invalid tgCode" }, { status: 400 });
  }

  const innings = await getBoutInnings(tgCode);
  const hasRows = Boolean(innings && innings.rows.length > 0);

  return NextResponse.json(
    { innings: hasRows ? innings : null },
    {
      headers: {
        "Cache-Control": hasRows
          ? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
          : "no-store",
      },
    },
  );
}
