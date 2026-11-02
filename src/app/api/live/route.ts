import { NextResponse } from "next/server";
import { getLiveFeed } from "@/lib/pba/live";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tourCode = searchParams.get("tour") ?? "";

  const feed = await getLiveFeed(tourCode);

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20",
    },
  });
}
