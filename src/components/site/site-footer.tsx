import Link from "next/link";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  {
    title: "Tour",
    links: [
      { href: "/live", label: "Live match centre" },
      { href: "/schedule", label: "Season schedule" },
      { href: "/records", label: "Records & leaders" },
      { href: "/rankings", label: "Prize & point rankings" },
    ],
  },
  {
    title: "Competitors",
    links: [
      { href: "/players", label: "Player directory" },
      { href: "/teams", label: "Team league" },
      { href: "/compare", label: "Head-to-head" },
      { href: "/rankings?league=PBA1", label: "PBA standings" },
    ],
  },
  {
    title: "Media",
    links: [
      { href: "/news", label: "Newsroom" },
      { href: "/news?tab=videos", label: "PBA TV" },
      { href: "/about", label: "About the tour" },
      { href: "/about#data", label: "Where the data comes from" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-ink-750 bg-ink-950">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-4 text-[13.5px] leading-relaxed text-fog-500">
              An independent reader for the Professional Billiards Association tour. Every number on
              this site is pulled live from the official pbatour.org data service.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="https://www.pbatour.org/en/index"
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
              >
                Official site ↗
              </a>
              <a
                href="https://www.youtube.com/channel/UCuXTHFVxa6tPC_jmqwpyOUA"
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
              >
                PBA TV ↗
              </a>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="eyebrow mb-4">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-fog-400 transition-colors hover:text-fog-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-ink-800 pt-6 text-xs text-fog-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Unofficial fan project. PBA, LPBA and all tournament marks belong to the Professional
            Billiards Association.
          </p>
          <p className="tnum">
            Data source: pbatour.org · Built with Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
