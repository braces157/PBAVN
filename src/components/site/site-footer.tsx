import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { BrandEmblem } from "./wordmark";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border bg-card">
      <div className="wrap grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <BrandEmblem size={22} />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              PBA <span className="text-[var(--pba)]">Hub</span>
            </span>
          </div>
          <p className="max-w-[300px] text-xs leading-relaxed text-muted-foreground">
            Independent 3-cushion billiards stats reader for the Korean Professional Billiards
            Association. All match times in KST, source data from pbatour.org.
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold text-foreground">Circuits</p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>
              <Link href="/rankings?league=PBA1" className="hover:text-foreground">
                PBA Men&apos;s Tour
              </Link>
            </li>
            <li>
              <Link href="/rankings?league=LPBA1" className="hover:text-foreground">
                LPBA Women&apos;s Tour
              </Link>
            </li>
            <li>
              <Link href="/teams" className="hover:text-foreground">
                PBA Team League
              </Link>
            </li>
            <li>
              <Link href="/records" className="hover:text-foreground">
                Season Stat Leaders
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold text-foreground">Match Day</p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>
              <Link href="/live" className="hover:text-foreground">
                Live Arena Tables
              </Link>
            </li>
            <li>
              <Link href="/schedule" className="hover:text-foreground">
                Tournament Calendar
              </Link>
            </li>
            <li>
              <Link href="/players" className="hover:text-foreground">
                Player Directory
              </Link>
            </li>
            <li>
              <Link href="/compare" className="hover:text-foreground">
                Head-to-Head Compare
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold text-foreground">Broadcast &amp; Source</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            SBS Sports · MBC Sports+ · Billiards TV · PBA&amp;GOLF · IB Sports · YouTube (@pbatv)
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
            <Link href="/news" className="hover:text-foreground">
              Newsroom
            </Link>
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <a
              href="https://www.pbatour.org/en/index"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              pbatour.org <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-muted-foreground">
          <span>PBA Hub · Independent 3-Cushion Reader · Times in KST</span>
          <span>Live scoring synced with pbatour.org</span>
        </div>
      </div>
    </footer>
  );
}
