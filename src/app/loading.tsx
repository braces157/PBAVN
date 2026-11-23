export default function RouteLoading() {
  return (
    <div className="wrap py-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading scores and statistics…</p>
      <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-7 w-2/3 max-w-md animate-pulse rounded bg-secondary" />

      <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-card p-4">
            <div className="h-2.5 w-16 animate-pulse rounded bg-secondary" />
            <div className="mt-2 h-5 w-20 animate-pulse rounded bg-secondary/80" />
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
            <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-secondary" />
            <div className="h-3 w-44 animate-pulse rounded bg-secondary" style={{ opacity: 1 - index * 0.09 }} />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-secondary" style={{ opacity: 1 - index * 0.09 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
