"use client";

import { useState, type ReactNode } from "react";
import type { MatchState } from "@/lib/pba/matches-on-day";
import { cn } from "@/components/ui/primitives";

export function MatchFilters({ matches, className }: {
  matches: { key: string; state: MatchState; row: ReactNode }[];
  className?: string;
}) {
  const [filter, setFilter] = useState<"all" | MatchState>("all");
  const visible = matches.filter((match) => filter === "all" || match.state === filter);
  return <>
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-800 px-3 py-2" aria-label="Match filters">
      {([["all", "All"], ["live", "Live"], ["next", "Upcoming"], ["final", "Results"]] as const).map(([value, label]) => (
        <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
          className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", filter === value ? "bg-ink-700 text-fog-100" : "text-fog-400 hover:text-fog-100")}>
          {label}
        </button>
      ))}
      <span className="ml-auto text-[11px] text-fog-400">Times in KST</span>
    </div>
    <p className="sr-only" role="status">{visible.length} matches shown</p>
    {visible.length ? <ul className={cn("divide-y divide-ink-800/70", className)}>{visible.map((match) => match.row)}</ul>
      : <p className="px-3 py-4 text-xs text-fog-400">No matches in this category on this date.</p>}
  </>;
}
