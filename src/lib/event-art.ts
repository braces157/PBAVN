/**
 * Sponsor, tournament, team, and press/gallery artwork hosted on pbatour.org.
 *
 * Routing these through `/api/photo` avoids intermittent client TLS-chain
 * failures on `pbatour.org` and resizes large originals to WebP.
 *
 * Imported by client components, so it must stay dependency-free.
 */

const PROXYABLE_UPLOAD =
  /^https:\/\/(?:www\.)?pbatour\.org\/resources\/upload\/(?:tournament|board|sponsor|team|banner|media)\/[\w./-]+\.(?:png|jpe?g|webp|gif)$/i;

export function isEventArt(url: string | null | undefined): url is string {
  return typeof url === "string" && PROXYABLE_UPLOAD.test(url);
}

function upstreamPath(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    if (path.includes("..") || path.includes("//")) return null;
    return path.startsWith("/resources/upload/") ? path.slice("/resources/upload".length) : path;
  } catch {
    return null;
  }
}

/**
 * A resized proxy URL for pbatour.org upload artwork, or the original URL when
 * hosted elsewhere.
 */
export function eventArtUrl(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  if (!isEventArt(url)) return url;
  const path = upstreamPath(url);
  if (!path) return url;
  return `/api/photo?src=${encodeURIComponent(path)}&w=${Math.round(width)}`;
}

export function eventArtSrcSet(url: string | null | undefined, widths: number[]): string | undefined {
  if (!isEventArt(url)) return undefined;
  const candidates = widths.map((width) => eventArtUrl(url, width)).filter(Boolean);
  if (candidates.length < 2) return undefined;
  return candidates.map((value, index) => `${value} ${index + 2}x`).join(", ");
}
