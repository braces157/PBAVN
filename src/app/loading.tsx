/**
 * Shown while a route's data streams in. Every stats page awaits the association's
 * service, which can take seconds on a cold cache, so the shell paints first.
 */
export default function RouteLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading data from the association…</p>
      <div className="h-3 w-24 animate-pulse rounded bg-ink-800" />
      <div className="mt-4 h-9 w-2/3 max-w-md animate-pulse rounded bg-ink-800" />
      <div className="mt-3 h-3 w-1/2 max-w-sm animate-pulse rounded bg-ink-800/70" />

      <div className="mt-10 grid gap-px overflow-hidden rounded-[14px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-ink-900 p-4">
            <div className="h-2.5 w-16 animate-pulse rounded bg-ink-800" />
            <div className="mt-2.5 h-6 w-20 animate-pulse rounded bg-ink-800/80" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-[14px] border border-ink-750 bg-ink-900">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-ink-800 px-4 py-3.5 last:border-0">
            <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-ink-800" />
            <div className="h-3 w-40 animate-pulse rounded bg-ink-800" style={{ opacity: 1 - index * 0.09 }} />
            <div className="ml-auto h-3 w-14 animate-pulse rounded bg-ink-800" style={{ opacity: 1 - index * 0.09 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
