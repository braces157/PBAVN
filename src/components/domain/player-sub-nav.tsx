"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui/primitives";

interface Section {
  id: string;
  label: string;
}

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

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-60px 0px -35% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-30 mb-5 rounded-[3px] border border-[var(--line)] bg-[var(--panel)] px-2.5"
    >
      <div className="no-scrollbar flex gap-3 overflow-x-auto">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? "location" : undefined}
            className={cn(
              "relative -mb-px shrink-0 border-b-2 py-2 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors hover:no-underline",
              active === section.id
                ? "border-[var(--yellow)] text-[var(--text)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
