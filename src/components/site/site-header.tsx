"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoLink } from "./wordmark";
import { PlayerSearch } from "@/components/ui/player-search";

const NAV = [
  { href: "/live", label: "Live" },
  { href: "/schedule", label: "Schedule" },
  { href: "/players", label: "Players" },
  { href: "/rankings", label: "Rankings" },
  { href: "/teams", label: "Teams" },
  { href: "/records", label: "Records" },
  { href: "/news", label: "News" },
];

/**
 * A match card is reached from an event, so the Schedule nav stays lit for
 * `/matches/*` — otherwise the header loses its position on the way to the card
 * and the reader has to work out where they are.
 */
function isActive(pathname: string, href: string) {
  if (href === "/schedule" && pathname.startsWith("/matches")) return true;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-ink-750 bg-ink-950/85 backdrop-blur-xl"
          : "border-transparent bg-ink-950/40 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <LogoLink />

        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={`link-underline rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  active ? "text-fog-100" : "text-fog-400 hover:text-fog-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <div className="hidden md:block">
            <PlayerSearch />
          </div>
          <Link
            href="/compare"
            className="hidden rounded-md border border-ink-700 px-3 py-1.5 text-[13px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100 lg:block"
          >
            Head-to-head
          </Link>
          <a
            href="https://www.pbatour.org/en/index"
            target="_blank"
            rel="noreferrer noopener"
            className="press hidden items-center gap-1.5 rounded-md bg-lime-400 px-3 py-1.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-lime-300 xl:inline-flex"
          >
            pbatour.org
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
              <path
                d="M3 9 9 3M4.5 3H9v4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-9 w-9 place-items-center rounded-md border border-ink-700 text-fog-300 transition-colors hover:text-fog-100 lg:hidden"
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute left-0 block h-[1.5px] w-4 bg-current transition-transform duration-300 ${
                  open ? "top-1.5 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 block h-[1.5px] w-4 bg-current transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 block h-[1.5px] w-4 bg-current transition-transform duration-300 ${
                  open ? "top-1.5 -rotate-45" : "top-3"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer. `invisible` when closed, not just `max-h-0`: a
          zero-height overflow container still leaves its boxes hit-testable in
          one-column layouts, which made every nav link look clickable while it
          was covered by the page behind it. */}
      <div
        aria-hidden={!open}
        className={`overflow-hidden border-t border-ink-750 bg-ink-950/97 backdrop-blur-xl transition-[max-height,opacity] duration-300 lg:hidden ${
          open ? "max-h-[520px] opacity-100" : "invisible max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-[1440px] px-4 pt-3 sm:px-6 md:hidden">
          <PlayerSearch variant="page" />
        </div>
        <nav className="mx-auto grid max-w-[1440px] gap-1 px-4 py-3 sm:px-6" aria-label="Mobile">
          {[...NAV, { href: "/compare", label: "Head-to-head" }, { href: "/about", label: "About" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-ink-800 text-lime-400"
                  : "text-fog-300 hover:bg-ink-850 hover:text-fog-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
