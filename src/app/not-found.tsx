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
      <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="mt-2.5 text-3xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        The requested route does not exist or the match record has not been published.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:no-underline"
        >
          Matches home
        </Link>
        <Link
          href="/players"
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
        >
          Players
        </Link>
        <Link
          href="/schedule"
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
        >
          Schedule
        </Link>
      </div>
    </div>
  );
}
