import Link from "next/link";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  {
    title: "Follow",
    links: [
      { href: "/live", label: "Live tables" },
      { href: "/schedule", label: "Schedule" },
      { href: "/teams", label: "Team League" },
      { href: "/news", label: "News" },
    ],
  },
  {
    title: "Numbers",
    links: [
      { href: "/rankings", label: "Rankings" },
      { href: "/records", label: "Records" },
      { href: "/players", label: "Players" },
      { href: "/compare", label: "Compare players" },
    ],
  },
  {
    title: "Site",
    links: [
      { href: "/about", label: "About the data" },
      { href: "/teams/matches", label: "Round fixtures" },
      { href: "https://www.pbatour.org/en/index", label: "pbatour.org ↗", external: true },
      {
        href: "https://www.youtube.com/channel/UCuXTHFVxa6tPC_jmqwpyOUA",
        label: "PBA TV ↗",
        external: true,
      },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-[var(--hair)] bg-[#151412] text-[#d9d3c6]">
      <div className="wrap grid grid-cols-2 gap-8 pb-[30px] pt-9 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
        <div className="col-span-full lg:col-span-1">
          <Wordmark compact inverse />
          <p className="mt-2.5 max-w-[38ch] text-[13.5px] leading-relaxed text-[#a8a191]">
            An independent reader for the Professional Billiards Association. All results come from pbatour.org
            when the page is loaded.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h5 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8d8678]">
              {column.title}
            </h5>
            <ul>
              {column.links.map((link) => (
                <li key={`${column.title}-${link.href}`} className="py-[3px] text-[14px]">
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[#d9d3c6] hover:underline"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-[#d9d3c6] hover:underline">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[#33302a] text-[12px] text-[#8d8678]">
        <div className="wrap flex flex-col justify-between gap-1 py-4 sm:flex-row">
          <span>Not affiliated with the PBA. Data © Professional Billiards Association.</span>
          <span>Times shown in KST</span>
        </div>
      </div>
    </footer>
  );
}
