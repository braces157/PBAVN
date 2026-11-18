export default function RouteLoading() {
  return (
    <div className="mx-auto max-w-[1300px] px-3 py-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading scores and statistics…</p>
      <div className="h-3 w-28 animate-pulse rounded bg-ink-800" />
      <div className="mt-3 h-7 w-2/3 max-w-md animate-pulse rounded bg-ink-800" />

      <div className="mt-5 grid gap-px overflow-hidden rounded-[3px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-ink-900 p-4">
            <div className="h-2.5 w-16 animate-pulse rounded bg-ink-800" />
            <div className="mt-2 h-5 w-20 animate-pulse rounded bg-ink-800/80" />
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-[3px] border border-ink-750 bg-ink-900">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-ink-800 px-4 py-3 last:border-0">
            <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-ink-800" />
            <div className="h-3 w-44 animate-pulse rounded bg-ink-800" style={{ opacity: 1 - index * 0.09 }} />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-ink-800" style={{ opacity: 1 - index * 0.09 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
