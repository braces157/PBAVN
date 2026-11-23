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
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">No dated events in this window.</p>
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
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      {label && (
        <p className="border-b border-border bg-secondary/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <div className="rail-scroll max-h-[calc(100vh-200px)] overflow-x-hidden" data-rail-scroll={scrollerId}>
        <RailFocus id={`day-${selected}`} />
        {weeks.map((week, index) => {
          const showMonth = index === 0 || week.label !== weeks[index - 1]?.label;
          return (
            <div key={week.key} className="border-b border-border/60 last:border-b-0">
              {showMonth && week.label && (
                <p className="flex items-baseline justify-between bg-card px-2.5 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                          "flex h-7 items-center gap-1.5 px-2 text-xs transition-colors hover:no-underline",
                          active
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] tabular-nums",
                            active
                              ? "bg-foreground font-semibold text-background"
                              : isToday
                                ? "font-semibold text-rose-500 ring-1 ring-inset ring-rose-500/40"
                                : "font-medium text-foreground/80",
                          )}
                        >
                          {Number(parts.day)}
                        </span>
                        <span
                          className={cn(
                            "flex-1 truncate text-[11px]",
                            active ? "font-semibold text-foreground" : "text-muted-foreground",
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
                                  "h-1 w-1 rounded-full",
                                  active ? "bg-foreground" : isToday ? "bg-rose-500" : "bg-muted-foreground/60",
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
                "relative flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors hover:no-underline",
                active
                  ? "border-foreground bg-foreground text-background"
                  : isToday
                    ? "border-rose-500/50 bg-card text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "text-[9.5px] font-medium uppercase tracking-wider",
                  active ? "text-background/75" : "text-muted-foreground",
                )}
              >
                {parts.weekday.slice(0, 3)} {day.slice(5, 7)}
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-semibold leading-none tabular-nums",
                  active ? "text-background" : isToday ? "text-rose-500" : "text-foreground",
                )}
              >
                {Number(parts.day)}
              </span>
              {count > 0 && (
                <span className="flex items-center gap-[2px]">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1 w-1 rounded-full",
                      active ? "bg-background" : isToday ? "bg-rose-500" : "bg-muted-foreground",
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
