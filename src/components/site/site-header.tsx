"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PlayerSearch } from "@/components/ui/player-search";
import { LogoLink } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Matches" },
  { href: "/live", label: "Live", live: true },
  { href: "/teams/matches", label: "Results" },
  { href: "/schedule", label: "Events" },
  { href: "/rankings", label: "Rankings" },
  { href: "/records", label: "Stats" },
  { href: "/teams", label: "Team League" },
  { href: "/news", label: "News" },
];

const LIVE_THROTTLE_MS = 15_000;
let lastLiveCheck = 0;
let cachedLiveCount = 0;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/teams") return pathname === "/teams" || (pathname.startsWith("/teams/") && !pathname.startsWith("/teams/matches"));
  if (href === "/teams/matches") return pathname.startsWith("/teams/matches") || pathname.startsWith("/matches/");
  if (href === "/records") return pathname.startsWith("/records") || pathname.startsWith("/players") || pathname.startsWith("/compare");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [liveCount, setLiveCount] = useState<number>(cachedLiveCount);

  useEffect(() => {
    const now = Date.now();
    if (now - lastLiveCheck < LIVE_THROTTLE_MS) {
      setLiveCount(cachedLiveCount);
      return;
    }

    const controller = new AbortController();
    lastLiveCheck = now;

    fetch("/api/live", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.matches)) {
          cachedLiveCount = data.matches.length;
          setLiveCount(cachedLiveCount);
        }
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [pathname]);

  return (
    <header className="nav">
      <div className="wrap">
        <LogoLink />

        <nav className="desknav" aria-label="Primary navigation">
          <ul>
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={active ? "on" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.live && (
                      <i
                        className={liveCount > 0 ? "dot" : "dot dot-idle"}
                        aria-hidden="true"
                      />
                    )}
                    {item.label}
                    {item.live && liveCount > 0 && (
                      <span className="cnt">
                        {liveCount}
                        <span className="sr-only"> live matches</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="right">
          <PlayerSearch />
          <ThemeToggle />
        </div>
      </div>

      <nav className="mobnav" aria-label="Mobile navigation">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "on" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
              {item.live && liveCount > 0 ? ` ${liveCount}` : ""}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
