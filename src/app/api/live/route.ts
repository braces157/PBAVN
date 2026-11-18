import { NextResponse } from "next/server";
import { getLiveFeed } from "@/lib/pba/live";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tourCode = searchParams.get("tour")?.trim() ?? "";

  if (tourCode && !/^\d{1,6}$/.test(tourCode)) {
    return NextResponse.json({ error: "Invalid tour parameter" }, { status: 400 });
  }

  const feed = await getLiveFeed(tourCode);

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": feed.reachable
        ? "public, max-age=5, s-maxage=10, stale-while-revalidate=10"
        : "no-store",
    },
  });
}
