"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoLink } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";
import { PlayerSearch } from "@/components/ui/player-search";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/live", label: "Live" },
  { href: "/schedule", label: "Schedule" },
  { href: "/rankings", label: "Rankings" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Team League" },
  { href: "/records", label: "Records" },
  { href: "/compare", label: "Compare" },
  { href: "/news", label: "News" },
];

function isActive(pathname: string, href: string) {
  if (href === "/schedule" && pathname.startsWith("/matches")) return true;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function kstNowLabel(): { date: string; time: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return { date, time: `${time} KST` };
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  const { date, time } = kstNowLabel();

  return (
    <header className="bg-[var(--paper)]">
      {/* Utility bar */}
      <div className="border-b border-[var(--hair)] text-[12.5px] text-[var(--ink-2)]">
        <div className="wrap flex h-8 items-center justify-between gap-4">
          <div className="truncate">
            <b className="font-bold text-[var(--ink)]">{date}</b>
            <span className="mx-1.5">·</span>
            <span className="tnum">{time}</span>
          </div>
          <nav className="flex shrink-0 items-center gap-4.5" aria-label="Utility">
            <Link href="/about" className="hidden hover:underline md:inline">
              About the data
            </Link>
            <a
              href="https://www.pbatour.org/en/index"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden hover:underline md:inline"
            >
              pbatour.org ↗
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </div>

      {/* Broadsheet masthead */}
      <div className="mast">
        <div className="wrap grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-2 pb-2 pt-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-8 lg:pb-3 lg:pt-[18px]">
          <LogoLink />

          <nav
            className="no-scrollbar mask-fade-r col-span-full row-start-2 flex items-center gap-5 overflow-x-auto pb-1.5 text-[15px] font-semibold lg:col-span-1 lg:row-start-auto lg:gap-[20px] lg:pb-[6px] lg:[mask-image:none]"
            aria-label="Primary"
          >
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className="link-underline whitespace-nowrap pb-1 text-[var(--ink)] hover:no-underline"
                >
                  {item.href === "/live" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="live-dot inline-block h-[7px] w-[7px] rounded-full bg-[var(--red)]"
                        aria-hidden="true"
                      />
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end lg:pb-1">
            <div className="hidden lg:block">
              <PlayerSearch />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-expanded={mobileSearchOpen}
              aria-label={mobileSearchOpen ? "Close player search" : "Search players"}
              className="grid h-8 w-8 place-items-center text-[var(--ink)] hover:text-[var(--red)] lg:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="m11 11 4 4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="wrap pb-3 lg:hidden">
            <PlayerSearch variant="page" />
          </div>
        )}

        <div className="wrap">
          <div className="rule-double" />
        </div>
      </div>
    </header>
  );
}
