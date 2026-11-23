"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  const handleRetry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-4 text-center"
    >
      <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Request error</p>
      <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Unable to load this page
      </h1>
      <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        The association&apos;s data service may be temporarily unreachable or returned an unexpected response.
      </p>
      {error.digest && (
        <p className="mt-3 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground">
          ref {error.digest}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retry
        </button>
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
        >
          Matches home
        </Link>
        <a
          href="https://www.pbatour.org/en/index"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
        >
          pbatour.org <span aria-hidden="true" className="ml-1">↗</span>
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      </div>
    </div>
  );
}
