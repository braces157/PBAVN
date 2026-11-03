/**
 * Player photo proxy.
 *
 * Three upstream facts shape this route:
 *
 *  1. Photos live on the asset host, whose TLS chain is missing its intermediate
 *     certificate — so they go through the same `node:https` path as the JSON.
 *  2. Every surface is handed the `small` (~160px) path, but a `big` (~640px)
 *     copy usually exists at the sibling folder, sometimes with a different
 *     cache-busting suffix. We try the upgrade first and fall back to the exact
 *     path we were given.
 *  3. The originals are ~110 KB of JPEG. Sharp resizes to the width the layout
 *     asked for and re-encodes as WebP, which also gives us a resizable edge
 *     instead of a browser-side downscale.
 *
 * A miss returns 404 with a short cache so the client can settle on the initials
 * plate instead of a broken image icon.
 */

import { NextResponse } from "next/server";
import { fetchBinary } from "@/lib/pba/http";

export const runtime = "nodejs";

const SRC = /^\/players\/[\w-]+\/(?:small|big)\/[\w.\-]+\.(?:jpe?g|png|webp)$/i;
/** Tournament and sponsor artwork; a flat PNG plate, resized on the way out. */
const TOURNAMENT_SRC = /^\/(?:resources\/upload\/)?tournament\/[\w./-]+\.(?:png|jpe?g|webp)$/i;

/** Roughly 400 thumbs at ~20 KB — small enough to keep resident. */
const RESULT_CACHE_LIMIT = 400;
const RESULT_TTL_MS = 6 * 60 * 60 * 1000;

interface Rendered {
  expires: number;
  body: Buffer;
  contentType: string;
}

const rendered = new Map<string, Rendered>();

const HIT_HEADERS = {
  "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
};

function clampWidth(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 320;
  return Math.min(768, Math.max(48, Math.round(value)));
}

/**
 * Tournament artwork is one file with no sibling size, so the only candidate
 * is the path itself. It is also the only artwork served with transparency
 * kept: a sponsor crest sits on the dark header, not on a plate.
 */
function isTournamentArt(src: string): boolean {
  return TOURNAMENT_SRC.test(src);
}

/**
 * Upstream names the two sizes inconsistently. Most members have
 * `/players/PBA/small/M0017191.jpg` beside `/players/PBA/big/M0017191.jpg`, but a
 * few newer uploads carry a size marker and timestamp —
 * `_S_2025…` on the small copy, `_B_2025…` on the big one — so the folder swap
 * alone points at a file that was never written. Try the marker swap too.
 */
function ancestorsOf(path: string): string[] {
  const isSmall = path.includes("/small/");
  const otherFolder = isSmall ? path.replace("/small/", "/big/") : path.replace("/big/", "/small/");
  const markerSwapped = path.replace(/_[SB]_(?=\d)/, isSmall ? "_B_" : "_S_");
  const otherFolderMarkerSwapped = otherFolder.replace(/_[SB]_(?=\d)/, isSmall ? "_B_" : "_S_");

  return [
    ...new Set([
      otherFolder.replace(/_[SB]_\d+(?=\.\w+$)/, ""), // plain big/small, no suffix
      otherFolderMarkerSwapped, // same suffix, other size
      markerSwapped, // same folder, other size marker
      otherFolder, // folder swap, suffix untouched
      path, // exactly what the feed gave us
    ]),
  ];
}

async function toWebp(input: Buffer, width: number, keepAlpha = false): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(input)
      .rotate() // honour EXIF orientation before measuring
      .resize({ width, withoutEnlargement: true, fit: "inside", kernel: "lanczos3" })
      .webp({ quality: 82, effort: 4, ...(keepAlpha ? { alphaQuality: 100 } : {}) })
      .toBuffer();
  } catch {
    // Sharp is optional at runtime (it ships with Next as an optional
    // dependency). Serving the 640px original still beats a blurred 160px one.
    return null;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const src = params.get("src") ?? "";
  const tournament = isTournamentArt(src);
  if (!tournament && !SRC.test(src)) {
    return new NextResponse(null, { status: 400, headers: { "Cache-Control": "public, max-age=3600" } });
  }
  // The patterns allow `.` and `/`, so a `..` segment would walk out of the
  // artwork subtree once the URL resolver collapses it.
  if (src.split("/").includes("..")) {
    return new NextResponse(null, { status: 400, headers: { "Cache-Control": "public, max-age=3600" } });
  }

  const width = clampWidth(params.get("w"));
  const key = `${src}@${width}`;

  const cached = rendered.get(key);
  if (cached && cached.expires > Date.now()) {
    return new NextResponse(new Uint8Array(cached.body), {
      headers: { ...HIT_HEADERS, "Content-Type": cached.contentType },
    });
  }

  // Tournament art may arrive with the upload prefix already on it; fetchBinary
  // prepends it again, so strip it here first.
  const candidates = tournament ? [src.replace(/^\/resources\/upload(?=\/)/, "")] : ancestorsOf(src);
  for (const candidate of candidates) {
    const asset = await fetchBinary(`https://pbatour.org/resources/upload${candidate}`);
    if (!asset) continue;

    const webp = await toWebp(asset.body, width, tournament);
    const body = webp ?? asset.body;
    const contentType = webp ? "image/webp" : asset.contentType || "image/jpeg";

    if (rendered.size >= RESULT_CACHE_LIMIT) rendered.clear();
    rendered.set(key, { expires: Date.now() + RESULT_TTL_MS, body, contentType });

    return new NextResponse(new Uint8Array(body), {
      headers: { ...HIT_HEADERS, "Content-Type": contentType },
    });
  }

  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=600" },
  });
}
