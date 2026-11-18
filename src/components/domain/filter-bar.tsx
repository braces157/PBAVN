import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { DataStatus } from "@/components/site/data-status";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

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

  const scrollable = options.length > 4;

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5", className)}>
      <span className="min-w-[50px] shrink-0 font-display text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">
        {label}
      </span>
      <div
        className={cn(
          "flex w-full min-w-0 max-w-full gap-1 sm:w-auto",
          scrollable ? "no-scrollbar flex-nowrap overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0" : "flex-wrap",
        )}
      >
        {options.map((option) => {
          const isActive = option.value === active;
          return (
            <Link
              key={option.value || "all"}
              href={buildHref(option.value)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-[3px] border px-2 py-0.5 text-[12px] font-semibold transition-colors hover:no-underline",
                isActive
                  ? "border-[var(--line-2)] border-b-2 border-b-[var(--yellow)] bg-[var(--bar-2)] text-[var(--text)]"
                  : "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
              )}
            >
              {option.label}
              {typeof option.count === "number" && (
                <span className={cn("tnum ml-1.5 text-[10.5px]", isActive ? "text-[var(--text)]" : "text-[var(--muted)]")}>
                  {option.count}
                </span>
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
  failures?: string[];
}) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)]">
      <div className="wrap py-3.5 sm:py-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="eyebrow">{eyebrow}</p>
          {description && (
            <>
              <span aria-hidden="true" className="text-[var(--muted)]">
                ·
              </span>
              <p className="text-[12px] text-[var(--text-2)]">{description}</p>
            </>
          )}
        </div>
        <h1 className="display-md mt-1 text-[var(--text)]">{title}</h1>
        {children && <div className="mt-3">{children}</div>}
        <DataStatus failures={failures} />
      </div>
    </header>
  );
}
