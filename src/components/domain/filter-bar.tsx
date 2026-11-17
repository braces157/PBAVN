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
    <div className={cn("flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3", className)}>
      <span className="min-w-[54px] shrink-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">
        {label}
      </span>
      <div
        className={cn(
          "flex max-w-full gap-1.5",
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
                "shrink-0 border px-2.5 py-1 text-[12.5px] font-bold transition-colors hover:no-underline",
                isActive
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                  : "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
              )}
            >
              {option.label}
              {typeof option.count === "number" && (
                <span className={cn("tnum ml-1.5 text-[11px]", isActive ? "opacity-80" : "text-[var(--ink-3)]")}>
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
    <header className="border-b-2 border-[var(--ink)] bg-[var(--paper)]">
      <div className="wrap py-5 sm:py-6">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="eyebrow">{eyebrow}</p>
          {description && (
            <>
              <span aria-hidden="true" className="text-[var(--ink-3)]">
                ·
              </span>
              <p className="font-serif-ed text-[14px] text-[var(--ink-2)]">{description}</p>
            </>
          )}
        </div>
        <h1 className="x mt-1.5 text-[36px] text-[var(--ink)] sm:text-[48px]">{title}</h1>
        {children && <div className="mt-4">{children}</div>}
        <DataStatus failures={failures} />
      </div>
    </header>
  );
}
