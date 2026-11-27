/**
 * Image proxy for pbatour.org uploads (player portraits, tournament/sponsor
 * artwork, team logos, and press/gallery photos).
 *
 * Reasons this route exists:
 *  1. `pbatour.org`'s TLS chain omits its intermediate certificate, causing
 *     intermittent client load failures on direct `<img>` requests.
 *  2. Player portraits are handed out as `small` (~160px) paths when a `big`
 *     (~640px) sibling usually exists; this route upgrades and resizes via Sharp.
 *  3. Magic-byte verified raster responses only; HTML/SVG/undecodable payloads
 *     are rejected so upstream errors can never be reflected or cached.
 */

import { NextResponse } from "next/server";
import { fetchBinary } from "@/lib/pba/http";

export const runtime = "nodejs";

const PLAYER_SRC = /^\/players\/[\w-]+\/(?:small|big)\/[\w.\-]+\.(?:jpe?g|png|webp|gif)$/i;
const UPLOAD_SRC =
  /^\/(?:resources\/upload\/)?(?:tournament|board|sponsor|team|banner|media)\/[\w./-]+\.(?:png|jpe?g|webp|gif)$/i;

/** Snap requested widths to a small allowlist to prevent cache-key explosion. */
const ALLOWED_WIDTHS = [64, 128, 256, 384, 512, 768, 1200] as const;

const RESULT_CACHE_LIMIT = 400;
const RESULT_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const MAX_INPUT_PIXELS = 25_000_000;

interface Rendered {
  expires: number;
  body: Buffer;
  contentType: string;
}

const rendered = new Map<string, Rendered>();
const negativeCache = new Map<string, number>();
const inFlight = new Map<string, Promise<Rendered | null>>();

function storeRendered(key: string, entry: Rendered): void {
  const now = Date.now();
  for (const [k, v] of rendered) {
    if (v.expires <= now) rendered.delete(k);
  }
  while (rendered.size >= RESULT_CACHE_LIMIT) {
    const oldest = rendered.keys().next().value;
    if (oldest === undefined) break;
    rendered.delete(oldest);
  }
  rendered.set(key, entry);
}

function storeNegative(key: string): void {
  const now = Date.now();
  for (const [k, exp] of negativeCache) {
    if (exp <= now) negativeCache.delete(k);
  }
  while (negativeCache.size >= 400) {
    const oldest = negativeCache.keys().next().value;
    if (oldest === undefined) break;
    negativeCache.delete(oldest);
  }
  negativeCache.set(key, now + NEGATIVE_TTL_MS);
}

const SAFE_IMAGE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

const HIT_HEADERS = {
  ...SAFE_IMAGE_HEADERS,
  "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
};

function snapWidth(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 384;
  for (const candidate of ALLOWED_WIDTHS) {
    if (value <= candidate) return candidate;
  }
  return ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
}

function hasUnsafeSegments(src: string): boolean {
  if (src.includes("\\") || src.includes("//")) return true;
  const segments = src.split("/");
  return segments.includes("..") || segments.includes(".");
}

function ancestorsOf(path: string): string[] {
  const isSmall = path.includes("/small/");
  const otherFolder = isSmall ? path.replace("/small/", "/big/") : path.replace("/big/", "/small/");
  const markerSwapped = path.replace(/_[SB]_(?=\d)/, isSmall ? "_B_" : "_S_");
  const otherFolderMarkerSwapped = otherFolder.replace(/_[SB]_(?=\d)/, isSmall ? "_B_" : "_S_");

  return [
    ...new Set([
      otherFolder.replace(/_[SB]_\d+(?=\.\w+$)/, ""),
      otherFolderMarkerSwapped,
      markerSwapped,
      otherFolder,
      path,
    ]),
  ];
}

async function toWebp(input: Buffer, width: number, keepAlpha = false): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside", kernel: "lanczos3" })
      .webp({ quality: 82, effort: 4, ...(keepAlpha ? { alphaQuality: 100 } : {}) })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const src = params.get("src") ?? "";
  const isPlayer = PLAYER_SRC.test(src);
  const isUpload = !isPlayer && UPLOAD_SRC.test(src);

  if ((!isPlayer && !isUpload) || hasUnsafeSegments(src)) {
    return new NextResponse(null, {
      status: 400,
      headers: { ...SAFE_IMAGE_HEADERS, "Cache-Control": "public, max-age=3600" },
    });
  }

  const width = snapWidth(params.get("w"));
  const key = `${src}@${width}`;
  const now = Date.now();

  const cached = rendered.get(key);
  if (cached && cached.expires > now) {
    rendered.delete(key);
    rendered.set(key, cached);
    return new NextResponse(new Uint8Array(cached.body), {
      headers: { ...HIT_HEADERS, "Content-Type": cached.contentType },
    });
  }

  const negExp = negativeCache.get(key);
  if (negExp && negExp > now) {
    return new NextResponse(null, {
      status: 404,
      headers: { ...SAFE_IMAGE_HEADERS, "Cache-Control": "public, max-age=60" },
    });
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = (async (): Promise<Rendered | null> => {
      const keepAlpha = isUpload && /\/(?:tournament|sponsor|team)\//i.test(src);
      const candidates = isPlayer
        ? width <= 128
          ? [src, ...ancestorsOf(src).filter((c) => c !== src)]
          : ancestorsOf(src)
        : [src.replace(/^\/resources\/upload(?=\/)/, "")];

      for (const candidate of candidates) {
        const asset = await fetchBinary(`https://pbatour.org/resources/upload${candidate}`);
        if (!asset) continue;

        const webp = await toWebp(asset.body, width, keepAlpha);
        if (!webp) continue;

        const entry: Rendered = {
          expires: Date.now() + RESULT_TTL_MS,
          body: webp,
          contentType: "image/webp",
        };
        storeRendered(key, entry);
        return entry;
      }
      storeNegative(key);
      return null;
    })().finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, pending);
  }

  const result = await pending;
  if (!result) {
    return new NextResponse(null, {
      status: 503,
      headers: { ...SAFE_IMAGE_HEADERS, "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(new Uint8Array(result.body), {
    headers: { ...HIT_HEADERS, "Content-Type": result.contentType },
  });
}
