import Link from "next/link";
import { cn } from "@/lib/utils";
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
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3", className)}>
      <span className="min-w-[56px] shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <nav
        aria-label={label}
        className={cn(
          "inline-flex w-full min-w-0 max-w-full items-center gap-0.5 rounded-lg bg-secondary p-1 sm:w-auto",
          scrollable
            ? "no-scrollbar mask-fade-r flex-nowrap overflow-x-auto pr-4 sm:flex-wrap sm:overflow-visible sm:pr-1 sm:[mask-image:none]"
            : "flex-wrap",
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
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all hover:no-underline",
                isActive
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{option.label}</span>
              {typeof option.count === "number" && (
                <span className={cn("mono text-[11px]", isActive ? "text-muted-foreground" : "opacity-65")}>
                  {option.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
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
    <header className="border-b border-border bg-card">
      <div className="wrap py-5 sm:py-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <p className="font-medium text-[var(--pba)]">{eyebrow}</p>
          {description && (
            <>
              <span aria-hidden="true" className="text-muted-foreground/60">
                /
              </span>
              <p className="text-muted-foreground">{description}</p>
            </>
          )}
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {children && <div className="mt-4">{children}</div>}
        <DataStatus failures={failures} />
      </div>
    </header>
  );
}
