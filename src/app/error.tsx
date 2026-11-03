"use client";

import { useEffect } from "react";

/**
 * A render failure inside a route segment. The site previously had no error
 * boundary at all, so a thrown fetch surfaced as a blank page.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[720px] flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="display-md mt-3 text-fog-100">This page could not be rendered</h1>
      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-fog-500">
        The association's data service may be unreachable, or a response arrived in a shape this
        page did not expect. Retrying usually works; the official site is the source of truth.
      </p>
      {error.digest && (
        <p className="tnum mt-3 rounded border border-ink-700 px-2 py-1 text-[10.5px] text-fog-600">
          ref {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="press rounded-lg bg-lime-400 px-4 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
        >
          Try again
        </button>
        <a
          href="https://www.pbatour.org/en/index"
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg border border-ink-700 px-4 py-2.5 text-[13px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
        >
          pbatour.org ↗
        </a>
      </div>
    </div>
  );
}
