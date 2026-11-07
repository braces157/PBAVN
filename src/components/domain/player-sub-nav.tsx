"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui/primitives";

interface Section {
  id: string;
  label: string;
}

/**
 * In-page navigation for a long entity profile. Sections are plain anchors so the
 * page stays server-rendered; only the active highlight needs the client.
 */
export function PlayerSubNav({
  hasSeason,
  hasEvents,
  hasTitles,
}: {
  hasSeason: boolean;
  hasEvents: boolean;
  hasTitles: boolean;
}) {
  const sections = useMemo<Section[]>(
    () => [
      { id: "overview", label: "Overview" },
      { id: "matches", label: "Matches" },
      ...(hasSeason ? [{ id: "season", label: "Season stats" }] : []),
      ...(hasEvents ? [{ id: "events", label: "Events" }] : []),
      { id: "career", label: "Career" },
      ...(hasTitles ? [{ id: "titles", label: "Titles" }] : []),
    ],
    [hasSeason, hasEvents, hasTitles],
  );

  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0) return;

    // A section becomes active once its heading passes the sticky chrome.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Sections"
      className="sticky top-[100px] lg:top-16 z-30 -mx-4 mb-8 border-y border-ink-800 bg-ink-950/85 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
    >
      <div className="flex gap-1 overflow-x-auto py-2">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              active === section.id
                ? "bg-lime-400/10 text-lime-300"
                : "text-fog-500 hover:bg-ink-850 hover:text-fog-200",
            )}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
