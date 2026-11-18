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

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/teams") return pathname === "/teams" || (pathname.startsWith("/teams/") && !pathname.startsWith("/teams/matches"));
  if (href === "/teams/matches") return pathname.startsWith("/teams/matches") || pathname.startsWith("/matches/");
  if (href === "/records") return pathname.startsWith("/records") || pathname.startsWith("/players") || pathname.startsWith("/compare");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [liveCount, setLiveCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.matches)) {
          setLiveCount(data.matches.length);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <header className="nav">
      <div className="wrap">
        <LogoLink />

        <ul aria-label="Primary navigation">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={active ? "on" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {item.live && <i className="dot" aria-hidden="true" />}
                  {item.label}
                  {item.live && liveCount > 0 && <span className="cnt">{liveCount}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

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
