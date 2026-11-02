import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-[1440px] flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="pointer-events-none absolute inset-0 grid-field opacity-40" aria-hidden="true" />
      <div className="relative">
        <p className="eyebrow">404</p>
        <h1 className="display-lg mt-4 text-fog-100">Off the table</h1>
        <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-fog-500">
          That page is not on the tour. It may have been moved, or the record you are looking for was
          never published.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/"
            className="rounded-lg bg-lime-400 px-4 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
          >
            Back to home
          </Link>
          <Link
            href="/players"
            className="rounded-lg border border-ink-700 px-4 py-2.5 text-[13px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
          >
            Player directory
          </Link>
          <Link
            href="/schedule"
            className="rounded-lg border border-ink-700 px-4 py-2.5 text-[13px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
          >
            Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}
