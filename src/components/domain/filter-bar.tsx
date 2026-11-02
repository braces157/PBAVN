import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { DataStatus } from "@/components/site/data-status";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Filters are links, not client state: every view stays shareable, cacheable and
 * server-rendered, and the back button behaves the way people expect.
 */
export function FilterRow({
  label,
  options,
  active,
  basePath,
  params,
  paramKey,
  className,
}: {
  label: string;
  options: FilterOption[];
  active: string;
  basePath: string;
  params: Record<string, string | undefined>;
  paramKey: string;
  className?: string;
}) {
  const buildHref = (value: string) => {
    const search = new URLSearchParams();
    for (const [key, raw] of Object.entries(params)) {
      if (!raw || key === paramKey) continue;
      search.set(key, raw);
    }
    if (value) search.set(paramKey, value);
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fog-600">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isActive = option.value === active;
          return (
            <Link
              key={option.value || "all"}
              href={buildHref(option.value)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                isActive
                  ? "border-lime-400/45 bg-lime-400/10 text-lime-300"
                  : "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
              )}
            >
              {option.label}
              {typeof option.count === "number" && (
                <span className="tnum ml-1.5 text-[10.5px] text-fog-600">{option.count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  failures,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Feeds that failed while this page loaded; renders the partial-data notice. */
  failures?: string[];
}) {
  return (
    <header className="relative overflow-hidden border-b border-ink-800">
      <div className="pointer-events-none absolute inset-0 grid-field opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-[380px] w-[380px] rounded-full opacity-[0.10] blur-[110px]"
        style={{ background: "var(--color-lime-400)" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-8 pt-12 sm:px-6 lg:px-10 lg:pb-10 lg:pt-14">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-lg mt-3 max-w-3xl text-fog-100">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-fog-400">{description}</p>
        )}
        {children && <div className="mt-7">{children}</div>}
        <DataStatus failures={failures} />
      </div>
    </header>
  );
}
