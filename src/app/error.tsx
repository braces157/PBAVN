"use client";

import { useEffect } from "react";

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
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-4 text-center"
    >
      <p className="eyebrow">Request error</p>
      <h1 className="display-md mt-2.5 text-fog-100">Unable to load this page</h1>
      <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-fog-450">
        The association&apos;s data service may be temporarily unreachable or returned an unexpected response.
      </p>
      {error.digest && (
        <p className="tnum mt-3 rounded border border-ink-700 bg-ink-900 px-2.5 py-1 text-[10.5px] text-fog-500">
          ref {error.digest}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="press rounded-[3px] bg-[var(--nav)] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--link)]"
        >
          Retry
        </button>
        <a
          href="https://www.pbatour.org/en/index"
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-[12.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
        >
          pbatour.org ↗
        </a>
      </div>
    </div>
  );
}
