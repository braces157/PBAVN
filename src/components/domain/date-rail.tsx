import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { dateParts, isoDay, parseIsoDay, startOfWeek } from "@/lib/format";
import { RailFocus } from "./rail-focus";

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
  counts?: Map<string, number>;
  selected: string;
  today: string;
  hrefFor: (day: string) => string;
  label?: string;
  scrollerId?: string;
}) {
  if (days.length === 0) {
    return (
      <div className="rounded-[8px] border border-ink-750 bg-ink-900 p-4">
        <p className="text-[11.5px] leading-relaxed text-fog-500">No dated events in this window.</p>
      </div>
    );
  }

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
      className="overflow-hidden rounded-[8px] border border-ink-750 bg-ink-900"
    >
      {label && (
        <p className="border-b border-ink-750 bg-ink-850 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-fog-450">
          {label}
        </p>
      )}
      <div className="rail-scroll max-h-[calc(100vh-200px)] overflow-x-hidden" data-rail-scroll={scrollerId}>
        <RailFocus id={`day-${selected}`} />
        {weeks.map((week, index) => {
          const showMonth = index === 0 || week.label !== weeks[index - 1]?.label;
          return (
            <div key={week.key} className="border-b border-ink-800/60 last:border-b-0">
              {showMonth && week.label && (
                <p className="flex items-baseline justify-between bg-ink-900 px-2.5 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-fog-550">
                  <span className="truncate">{week.label}</span>
                </p>
              )}
              <ul className={showMonth ? undefined : "pt-0.5"}>
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
                          "flex h-[27px] items-center gap-1.5 px-2 text-[11.5px] transition-colors",
                          active
                            ? "bg-ink-800 text-fog-100"
                            : "text-fog-300 hover:bg-ink-850 hover:text-fog-100",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[2px] tabular-nums",
                            active
                              ? "bg-[var(--yellow)] font-bold text-[#1d2329]"
                              : isToday
                                ? "font-bold text-[var(--live)] ring-1 ring-inset ring-[var(--live)]"
                                : "font-medium text-fog-300",
                          )}
                        >
                          {Number(parts.day)}
                        </span>
                        <span
                          className={cn(
                            "flex-1 truncate text-[11px]",
                            active ? "font-semibold text-fog-100" : "text-fog-400",
                          )}
                        >
                          {parts.weekday}
                        </span>
                        {count > 0 && (
                          <span className="flex shrink-0 items-center gap-[2px]" aria-label={`${count} events`}>
                            {Array.from({ length: Math.min(count, 3) }, (_, index2) => (
                              <span
                                key={index2}
                                className={cn(
                                  "h-[3px] w-[3px] rounded-full",
                                  active ? "bg-carom-300" : isToday ? "bg-carom-400" : "bg-fog-500",
                                )}
                              />
                            ))}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile horizontal date strip mirroring `DateRail` below the `lg` breakpoint. */
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
    <nav aria-label={label ?? "Dates"} className="relative max-w-full overflow-hidden lg:hidden">
      <div className="rail-scroll flex max-w-full gap-1.5 overflow-x-auto pb-1.5 pt-0.5" data-rail-scroll="">
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
                "relative flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[3px] border transition-colors hover:no-underline",
                active
                  ? "border-[var(--line-2)] border-b-2 border-b-[var(--yellow)] bg-[var(--bar-2)] text-[var(--text)]"
                  : isToday
                    ? "border-[var(--live)] bg-[var(--panel)] text-[var(--text)]"
                    : "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:border-[var(--link)] hover:text-[var(--text)]",
              )}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
                {parts.weekday.slice(0, 3)} {day.slice(5, 7)}
              </span>
              <span
                className={cn(
                  "tnum text-[14px] font-bold leading-none",
                  isToday ? "text-[var(--live)]" : "text-[var(--text)]",
                )}
              >
                {Number(parts.day)}
              </span>
              {count > 0 && (
                <span className="flex items-center gap-[2px]">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-[3px] w-[3px] rounded-full",
                      active ? "bg-[var(--link)]" : isToday ? "bg-[var(--live)]" : "bg-[var(--muted)]",
                    )}
                  />
                  <span className="sr-only">{`${count} event${count === 1 ? "" : "s"}`}</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
