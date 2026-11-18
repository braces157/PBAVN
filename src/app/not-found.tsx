import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The requested PBA Hub page could not be found.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-[640px] flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display-lg mt-2.5 text-fog-100">Page not found</h1>
      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-fog-450">
        The requested route does not exist or the match record has not been published.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="press rounded-[3px] bg-[var(--nav)] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--link)]"
        >
          Matches home
        </Link>
        <Link
          href="/players"
          className="rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-[12.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
        >
          Players
        </Link>
        <Link
          href="/schedule"
          className="rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-[12.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
        >
          Schedule
        </Link>
      </div>
    </div>
  );
}
