import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer mt-8">
      <div className="wrap">
        <span>PBA Hub · independent stats reader · data from pbatour.org · times in KST</span>
        <nav aria-label="Footer navigation">
          <Link href="/about">About</Link>
          <Link href="/players">Players</Link>
          <Link href="/live">API status</Link>
          <a href="https://www.pbatour.org/en/index" target="_blank" rel="noreferrer noopener">
            pbatour.org ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
