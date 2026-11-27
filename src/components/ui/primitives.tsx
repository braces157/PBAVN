import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export { cn };

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3 pb-1", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1 text-xs font-medium text-[var(--pba)]">{eyebrow}</p>}
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-xs font-medium text-[var(--pba)] transition-colors hover:underline"
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

const TONE: Record<string, string> = {
  carom: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  lime: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cloth: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  rose: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  cyan: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  violet: "border-pink-500/25 bg-pink-500/10 text-pink-600 dark:text-pink-400",
  neutral: "border-border bg-secondary text-muted-foreground",
  live: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  gold: "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-400",
};

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE | string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        TONE[tone] ?? TONE.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveChip({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
      <Radio className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: "live" | "upcoming" | "completed" }) {
  if (status === "live") return <LiveChip />;
  if (status === "upcoming") return <Chip tone="amber">Upcoming</Chip>;
  return <Chip tone="neutral">Final</Chip>;
}

export function RankBadge({ rank, size = "md" }: { rank: number; size?: "sm" | "md" }) {
  const top3 = rank > 0 && rank <= 3;
  return (
    <span
      className={cn(
        "mono inline-grid place-items-center rounded-md font-semibold",
        size === "sm" ? "h-5 min-w-5 px-1 text-[11px]" : "h-6 min-w-6 px-1.5 text-xs",
        rank === 1
          ? "bg-amber-500 text-zinc-950"
          : top3
            ? "border border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-400"
            : "text-muted-foreground",
      )}
    >
      {rank || "—"}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mono mt-0.5 text-lg font-semibold leading-tight tracking-tight",
          accent ? "text-[var(--win)]" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const window = 2;
  const pages: number[] = [];
  for (let i = Math.max(1, page - window); i <= Math.min(pageCount, page + window); i += 1) {
    pages.push(i);
  }

  const base =
    "mono inline-grid h-8 min-w-8 place-items-center rounded-lg border px-2.5 text-xs font-medium transition-colors hover:no-underline";

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-6" aria-label="Pagination">
      {page === 1 ? (
        <span aria-hidden="true" className={cn(base, "border-border bg-secondary text-muted-foreground opacity-50")}>
          <ChevronLeft className="size-3.5" />
        </span>
      ) : (
        <Link
          href={buildHref(page - 1)}
          aria-label="Previous page"
          className={cn(base, "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground")}
        >
          <ChevronLeft className="size-3.5" />
        </Link>
      )}

      {pages[0] > 1 && (
        <>
          <Link
            href={buildHref(1)}
            className={cn(base, "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            1
          </Link>
          {pages[0] > 2 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            base,
            p === page
              ? "border-primary bg-primary text-primary-foreground hover:text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {p}
        </Link>
      ))}

      {pages[pages.length - 1] < pageCount && (
        <>
          {pages[pages.length - 1] < pageCount - 1 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}
          <Link
            href={buildHref(pageCount)}
            className={cn(base, "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            {pageCount}
          </Link>
        </>
      )}

      {page === pageCount ? (
        <span aria-hidden="true" className={cn(base, "border-border bg-secondary text-muted-foreground opacity-50")}>
          <ChevronRight className="size-3.5" />
        </span>
      ) : (
        <Link
          href={buildHref(page + 1)}
          aria-label="Next page"
          className={cn(base, "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground")}
        >
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </nav>
  );
}

export function TabLinks({
  items,
  active,
  className,
}: {
  items: { href: string; label: string; count?: number }[];
  active: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-secondary p-1", className)}>
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all hover:no-underline",
              isActive
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span className={cn("mono text-[11px]", isActive ? "text-muted-foreground" : "opacity-65")}>
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function Panel({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
  id,
  stickyHead = false,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  stickyHead?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        stickyHead ? "overflow-clip" : "overflow-hidden",
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cn(
            "flex min-h-[46px] items-center justify-between gap-2 border-b border-border bg-card px-4 py-3",
            stickyHead && "sticky top-0 z-30",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            {meta && <span className="mono shrink-0 text-xs text-muted-foreground">{meta}</span>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function TabStrip({
  items,
  className,
  sticky = false,
}: {
  items: { href: string; label: string; count?: number; active?: boolean }[];
  className?: string;
  sticky?: boolean;
}) {
  return (
    <nav
      aria-label="Section tabs"
      className={cn(
        "no-scrollbar mask-fade-r flex items-stretch gap-5 overflow-x-auto border-b border-border bg-card px-4 sm:[mask-image:none]",
        sticky && "sticky top-0 z-30",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          data-active={item.active ? "true" : undefined}
          className={cn(
            "relative -mb-px shrink-0 border-b-2 py-3 text-sm font-medium transition-colors hover:no-underline",
            item.active
              ? "border-foreground font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className="mono ml-1.5 text-xs text-muted-foreground">{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function CountTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mono inline-block rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
