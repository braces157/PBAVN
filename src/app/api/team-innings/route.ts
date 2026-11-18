import { NextResponse } from "next/server";
import { getBoutInnings } from "@/lib/pba/team-matches";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tgCode = searchParams.get("tgCode") ?? "";

  if (!/^\d+$/.test(tgCode)) {
    return NextResponse.json({ error: "Invalid tgCode" }, { status: 400 });
  }

  const innings = await getBoutInnings(tgCode);

  return NextResponse.json(
    { innings },
    {
      headers: {
        "Cache-Control": innings
          ? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
          : "public, max-age=30, s-maxage=30",
      },
    },
  );
}
