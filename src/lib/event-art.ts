/**
 * Sponsor and tournament artwork.
 *
 * The association publishes these as full-resolution PNGs on a plate — the
 * Welcome Savings Bank mark alone is 80 KB. An event header that draws it at
 * 56 px does not need the original, so it goes through `/api/photo` like a
 * player photo does and comes back as a WebP at the width the layout asks for.
 *
 * Imported by client components, so it must stay dependency-free.
 */

/** Tournament artwork is published under `/resources/upload/tournament/…`. */
const EVENT_ART = /^https:\/\/(?:www\.)?pbatour\.org\/resources\/upload\/[\w./-]+\.(?:png|jpe?g|webp)$/i;

export function isEventArt(url: string | null | undefined): url is string {
  return typeof url === "string" && EVENT_ART.test(url);
}

function upstreamPath(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    // The proxy serves the whole upload tree, but only the tournament folder is
    // artwork it is allowed to read — send it the short form.
    return path.startsWith("/resources/upload/") ? path.slice("/resources/upload".length) : path;
  } catch {
    return null;
  }
}

/**
 * A resized URL for tournament artwork, or the original when the file lives
 * somewhere the proxy does not serve (an external sponsor CDN, for instance).
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
