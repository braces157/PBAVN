import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer mt-8">
      <div className="wrap">
        <span>PBA Hub · independent stats reader · data from pbatour.org · times in KST</span>
        <nav aria-label="Footer navigation">
          <Link href="/about">About</Link>
          <Link href="/players">Players</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/live">Live</Link>
          <a href="https://www.pbatour.org/en/index" target="_blank" rel="noreferrer noopener">
            pbatour.org <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
