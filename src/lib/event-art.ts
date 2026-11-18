/**
 * Sponsor, tournament, team, and press/gallery artwork hosted on pbatour.org.
 *
 * Routing these through `/api/photo` avoids intermittent client TLS-chain
 * failures on `pbatour.org` and resizes large originals to WebP.
 *
 * Imported by client components, so it must stay dependency-free.
 */

const PROXYABLE_UPLOAD =
  /^https:\/\/(?:www\.)?pbatour\.org\/resources\/upload\/((?:tournament|board|sponsor|team|banner|media)\/[\w./-]+\.(?:png|jpe?g|webp|gif))$/i;

function hasUnsafeSegments(path: string): boolean {
  if (path.includes("\\") || path.includes("//")) return true;
  return path.split("/").some((segment) => segment === "." || segment === "..");
}

export function isEventArt(url: string | null | undefined): url is string {
  if (typeof url !== "string") return false;
  const match = url.match(PROXYABLE_UPLOAD);
  return Boolean(match && !hasUnsafeSegments(`/${match[1]}`));
}

function upstreamPath(url: string): string | null {
  const match = url.match(PROXYABLE_UPLOAD);
  if (!match) return null;
  const rel = `/${match[1]}`;
  return hasUnsafeSegments(rel) ? null : rel;
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
