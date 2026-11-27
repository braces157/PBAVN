"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CommandSearch } from "@/components/ui/command-search";
import type { LiveMatch } from "@/lib/pba/live";
import { LogoLink } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";
import { FollowingPopover } from "./following-popover";

interface NavItem {
  href: string;
  label: string;
  live?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Matches" },
  { href: "/live", label: "Live", live: true },
  { href: "/schedule", label: "Schedule" },
  { href: "/players", label: "Players" },
  { href: "/rankings", label: "Rankings" },
  { href: "/teams", label: "Team League" },
  { href: "/compare", label: "Compare" },
  { href: "/records", label: "Stats" },
  { href: "/news", label: "News" },
];

const LIVE_POLL_MS = 20_000;
let lastLiveFetch = 0;
let cachedMatches: LiveMatch[] = [];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/matches/");
  if (href === "/teams") return pathname === "/teams" || pathname.startsWith("/teams/");
  if (href === "/players") return pathname === "/players" || pathname.startsWith("/players/");
  if (href === "/compare") return pathname === "/compare" || pathname.startsWith("/compare/");
  if (href === "/records") return pathname === "/records" || pathname.startsWith("/records/");
  if (href === "/live") return pathname === "/live";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>(cachedMatches);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchLive = (force = false) => {
      if (!force && Date.now() - lastLiveFetch < LIVE_POLL_MS - 1_000) {
        setLiveMatches(cachedMatches);
        return;
      }
      fetch("/api/live", { cache: "no-store", signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!controller.signal.aborted && data && Array.isArray(data.matches)) {
            cachedMatches = data.matches as LiveMatch[];
            lastLiveFetch = Date.now();
            setLiveMatches(cachedMatches);
          }
        })
        .catch(() => undefined);
    };

    fetchLive(false);
    const interval = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) fetchLive(true);
    }, LIVE_POLL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) fetchLive(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  const liveCount = liveMatches.length;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <LogoLink />

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13.5px] font-medium transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  {active &&
                    (mounted ? (
                      <motion.span
                        layoutId="nav-active-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 -z-10 rounded-lg bg-secondary"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="absolute inset-0 -z-10 rounded-lg bg-secondary"
                        aria-hidden="true"
                      />
                    ))}
                  <span>{item.label}</span>
                  {item.live && liveCount > 0 && (
                    <span className="mono text-xs font-semibold text-red-600 dark:text-red-400">
                      {liveCount}
                      <span className="sr-only"> live matches</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CommandSearch />
          <FollowingPopover liveMatches={liveMatches} />
          <ThemeToggle />
        </div>
      </div>

      <div className="relative border-t border-border bg-card lg:hidden">
        <nav
          className="no-scrollbar mask-fade-r flex items-center gap-1 overflow-x-auto px-3 py-1.5 pr-10"
          aria-label="Mobile navigation"
        >
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{item.label}</span>
                {item.live && liveCount > 0 && (
                  <span className="mono text-[11px] font-semibold text-red-600 dark:text-red-400">
                    {liveCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
