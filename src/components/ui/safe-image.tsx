"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { photoSrcSet, photoUrl } from "@/lib/photo";

/**
 * Upstream stores a photo path for every member, but only about half of those
 * files were ever uploaded — the URL simply 404s. Rather than render a broken
 * or blank image we swap in a typographic fallback on error AND check
 * `img.complete && img.naturalWidth === 0` after hydration.
 *
 * When `revealOnLoad` is set (used by layered avatars where initials sit
 * underneath), the `<img>` stays `opacity-0` until it actually decodes pixels
 * (`naturalWidth > 0`), so slow or 404 portraits never flash an empty box.
 */
export function SafeImage({
  src,
  path,
  width = 320,
  alt,
  className,
  fallback,
  loading = "lazy",
  revealOnLoad = false,
}: {
  src?: string | null;
  path?: string | null;
  /** Requested width in CSS pixels; 2x and 3x candidates are added for retina. */
  width?: number;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading?: "lazy" | "eager";
  revealOnLoad?: boolean;
}) {
  const resolved = (path ? photoUrl(path, width) : null) ?? src ?? null;
  const srcSet = path ? photoSrcSet(path, [width * 2, width * 3]) : undefined;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el || !resolved) return;
    if (el.complete) {
      if (el.naturalWidth === 0) setFailedSrc(resolved);
      else setLoadedSrc(resolved);
    }
  }, [resolved]);

  if (!resolved || failedSrc === resolved) return <>{fallback}</>;

  const visible = !revealOnLoad || loadedSrc === resolved;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={resolved}
      srcSet={srcSet}
      alt={alt}
      loading={loading}
      decoding="async"
      onLoad={() => setLoadedSrc(resolved)}
      onError={() => setFailedSrc(resolved)}
      className={
        revealOnLoad
          ? `${className ?? ""} transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`
          : className
      }
    />
  );
}
