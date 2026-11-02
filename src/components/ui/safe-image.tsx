"use client";

import { useState, type ReactNode } from "react";
import { photoSrcSet, photoUrl } from "@/lib/photo";

/**
 * Upstream stores a photo path for every member, but only about half of those
 * files were ever uploaded — the URL simply 404s. Rather than render a broken
 * image (and its alt-text flash) we swap in a typographic fallback the first time
 * a load fails.
 *
 * Pass `path` — the raw upstream photo path — to get the resized big variant
 * from `/api/photo`; `src` is for URLs that are already final.
 */
export function SafeImage({
  src,
  path,
  width = 320,
  alt,
  className,
  fallback,
  loading = "lazy",
}: {
  src?: string | null;
  path?: string | null;
  /** Requested width in CSS pixels; 2x and 3x candidates are added for retina. */
  width?: number;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);

  const resolved = path ? photoUrl(path, width) : src;
  const srcSet = path ? photoSrcSet(path, [width * 2, width * 3]) : undefined;

  if (!resolved || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      srcSet={srcSet}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
