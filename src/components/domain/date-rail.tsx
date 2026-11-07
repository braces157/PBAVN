import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { dateParts, isoDay, parseIsoDay, startOfWeek } from "@/lib/format";
import { RailFocus } from "./rail-focus";

/**
 * The day rail.
 *
 * A sports reader opens the page to answer "what is on, and when", so the page
 * opens on a column of dates rather than a paragraph. The rail is laid out as
 * weeks — Monday first, a 26 px date cell flanked by the month and a bar per
 * event — because a week is the unit a fixture list is planned in, and a bare
 * column of numbers makes a Sunday and a Wednesday look alike.
 */
export function DateRail({
  days,
  counts,
  selected,
  today,
  hrefFor,
  label,
  scrollerId,
}: {
  days: string[];
  /** Optional per-day count, drawn as a thin bar. */
  counts?: Map<string, number>;
  selected: string;
  today: string;
  hrefFor: (day: string) => string;
  /** A small heading above the rail. */
  label?: string;
  /** Distinguishes two rails on one document; also the scroll-focus key. */
  scrollerId?: string;
}) {
  if (days.length === 0) {
    return (
      <div className="rounded-[10px] border border-ink-750 bg-ink-900 p-4">
        <p className="text-[11.5px] leading-relaxed text-fog-500">No dated events in this window.</p>
      </div>
    );
  }

  // Group into Monday-first weeks, keeping the month label of each week's start.
  const weeks: { key: string; label: string; days: string[] }[] = [];
  for (const day of days) {
    const monday = startOfWeek(day);
    const key = monday ? (isoDay(monday) ?? day) : day;
    const existing = weeks.find((week) => week.key === key);
    if (existing) existing.days.push(day);
    else {
      const label2 =
        parseIsoDay(day)?.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) ?? "";
      weeks.push({ key, label: label2, days: [day] });
    }
  }

  return (
    <nav
      aria-label={label ?? "Dates"}
      className="overflow-hidden rounded-[10px] border border-ink-750 bg-ink-900"
    >
      {label && (
        <p className="border-b border-ink-800 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-fog-600">
          {label}
        </p>
      )}
      <div className="rail-scroll max-h-[calc(100vh-240px)] overflow-x-hidden" data-rail-scroll={scrollerId}>
        {/* The reveal follows the selection, not today: on /schedule?day=X the
            highlighted row is the day being read, and on the home page the two
            are the same. */}
        <RailFocus id={`day-${selected}`} />
        {weeks.map((week, index) => (
          <div key={week.key} className="border-b border-ink-800/60 last:border-b-0">
            {(index === 0 || weeks[index - 1].label !== week.label) && (
            <p className="flex items-baseline justify-between bg-ink-900 px-2.5 pb-0.5 pt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fog-600">
              <span className="truncate">{week.label}</span>
            </p>
            )}
            <ul>
              {week.days.map((day) => {
                const parts = dateParts(day);
                const active = day === selected;
                const isToday = day === today;
                const count = counts?.get(day) ?? 0;
                return (
                  <li key={day}>
                    <Link
                      href={hrefFor(day)}
                      id={`day-${day}`}
                      aria-current={active ? "date" : undefined}
                      className={cn(
                        "flex h-[27px] items-center gap-1.5 px-2 text-[11px] transition-colors",
                        active
                          ? "bg-ink-800 text-fog-100"
                          : "text-fog-300 hover:bg-ink-850 hover:text-fog-100",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] tabular-nums",
                          active
                            ? "bg-lime-400 font-bold text-ink-950"
                            : isToday
                              ? "ring-1 ring-inset ring-lime-400 font-semibold text-lime-400"
                              : "font-medium text-fog-300",
                        )}
                      >
                        {Number(parts.day)}
                      </span>
                      <span
                        className={cn(
                          "flex-1 truncate text-[10.5px] tracking-[0.01em]",
                          active ? "text-fog-100" : "text-fog-400",
                        )}
                      >
                        {parts.weekday}
                      </span>
                      {count > 0 && (
                        <span className="flex shrink-0 items-center gap-[2px]" aria-hidden="true">
                          {Array.from({ length: Math.min(count, 3) }, (_, index) => (
                            <span
                              key={index}
                              className={cn(
                                "h-[3px] w-[3px] rounded-full",
                                active ? "bg-ink-950" : isToday ? "bg-lime-400" : "bg-ink-500",
                              )}
                            />
                          ))}
                          {/* The dots are decorative; the count rides along as
                              text a screen reader will actually announce. */}
                          <span className="sr-only">{`${count} event${count === 1 ? "" : "s"}`}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * The same day window as a horizontal strip for phones.
 *
 * The week-rail above is desktop-only, which left a handset with no day
 * navigation at all on the schedule — the one page where picking a day is the
 * point. Same window, same links, touch-sized cells; the selected day scrolls
 * into view on mount like the rail does.
 */
export function DateStrip({
  days,
  counts,
  selected,
  today,
  hrefFor,
  label,
}: {
  days: string[];
  counts?: Map<string, number>;
  selected: string;
  today: string;
  hrefFor: (day: string) => string;
  label?: string;
}) {
  if (days.length === 0) return null;

  return (
    <nav aria-label={label ?? "Dates"} className="lg:hidden">
      <div className="rail-scroll flex gap-1.5 overflow-x-auto pb-1 pt-0.5" data-rail-scroll="">
        <RailFocus id={`strip-day-${selected}`} axis="x" />
        {days.map((day) => {
          const parts = dateParts(day);
          const active = day === selected;
          const isToday = day === today;
          const count = counts?.get(day) ?? 0;
          return (
            <Link
              key={day}
              href={hrefFor(day)}
              id={`strip-day-${day}`}
              aria-current={active ? "date" : undefined}
              className={cn(
                "flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[9px] border transition-colors",
                active
                  ? "border-lime-400/60 bg-ink-800 text-fog-100"
                  : "border-ink-750 bg-ink-900 text-fog-300 hover:border-ink-600 hover:text-fog-100",
              )}
            >
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-fog-550">
                {parts.weekday.slice(0, 3)}
              </span>
              <span
                className={cn(
                  "flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] text-[12px] tabular-nums",
                  active
                    ? "bg-lime-400 font-bold text-ink-950"
                    : isToday
                      ? "font-semibold text-lime-400"
                      : "font-medium",
                )}
              >
                {Number(parts.day)}
              </span>
              {/* Same signal as the rail's dots: how busy the day is. */}
              {count > 0 && (
                <span
                  className={cn(
                    "h-[3px] w-[3px] rounded-full",
                    active ? "bg-lime-400" : isToday ? "bg-lime-400" : "bg-ink-500",
                  )}
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
