/**
 * Player photos are published twice upstream: a ~160px `small` thumbnail and a
 * ~640px `big` copy. The feed hands every surface the *small* path, which is why
 * a 170–240px card used to show a 160px file — soft at 1x, obviously blurred on
 * a retina display.
 *
 * Rather than ship the 640px original (≈110 KB each, 36 to a page), photo URLs
 * point at `/api/photo`, which upgrades the path to the big file, resizes it to
 * the width the layout needs and re-encodes it as WebP. `srcSet` then lets a
 * retina display ask for 2x or 3x without every visitor paying for it.
 *
 * This module is imported by client components, so it deliberately depends on
 * nothing — pulling `isRealAsset` out of the transport would drag `node:https`
 * into the browser bundle.
 */

const PLAYER_SRC = /^\/players\/[\w-]+\/(?:small|big)\/[\w.\-]+\.(?:jpe?g|png|webp)$/i;

/** Mirrors `isRealAsset`: upstream sometimes stores a literal placeholder, not a path. */
const PLACEHOLDER = /^(tbd|tba|n\/a|none|null|undefined|-|미정|없음)$/i;

/** The raw upstream path for a player photo, or null when the feed has none. */
export function playerPhotoPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = String(raw).trim();
  if (!path || PLACEHOLDER.test(path)) return null;
  return PLAYER_SRC.test(path) ? path : null;
}

/** Proxy URL for a raw upstream photo path, at `width` device pixels. */
export function photoUrl(path: string | null | undefined, width: number): string | null {
  const clean = playerPhotoPath(path);
  if (!clean) return null;
  return `/api/photo?src=${encodeURIComponent(clean)}&w=${Math.round(width)}`;
}

/** `2x, 3x` candidates so a retina screen gets a sharp file and others do not. */
export function photoSrcSet(path: string | null | undefined, widths: number[]): string | undefined {
  const candidates = widths.map((width) => photoUrl(path, width)).filter(Boolean);
  if (candidates.length < 2) return undefined;
  return candidates.map((url, index) => `${url} ${index + 2}x`).join(", ");
}
