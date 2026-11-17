import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------- headings */

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
    <div className={cn("flex flex-wrap items-baseline justify-between gap-3 pb-2", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="display-sm text-[var(--ink)]">{title}</h2>
        {description && (
          <p className="font-serif-ed mt-1.5 text-[14px] leading-relaxed text-[var(--ink-2)]">{description}</p>
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
      className="group inline-flex items-center gap-1 text-[13px] font-bold text-[var(--ink)] transition-colors hover:text-[var(--red)] hover:no-underline"
    >
      {children}
      <svg viewBox="0 0 12 12" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
        <path
          d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

/* ----------------------------------------------------------------- chips */

const TONE: Record<string, string> = {
  carom: "border-[var(--red)]/45 bg-[var(--red)]/10 text-[var(--red)]",
  lime: "border-[var(--ink)]/35 bg-[var(--paper-2)] text-[var(--ink)]",
  cloth: "border-[var(--cloth)]/45 bg-[var(--cloth)]/10 text-[var(--cloth)]",
  rose: "border-[var(--red)]/45 bg-[var(--red)]/10 text-[var(--red)]",
  cyan: "border-[var(--cloth)]/45 bg-[var(--cloth)]/10 text-[var(--cloth)]",
  amber: "border-[var(--yellow)] bg-[var(--yellow)]/20 text-[var(--ink)]",
  violet: "border-[var(--cloth)]/45 bg-[var(--cloth)]/10 text-[var(--cloth)]",
  neutral: "border-[var(--hair)] bg-[var(--paper-2)] text-[var(--ink-2)]",
  live: "border-[var(--red)] bg-[var(--red)] text-white",
  gold: "border-[var(--yellow)] bg-[var(--yellow)]/25 text-[var(--ink)]",
};

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-[2px] text-[11px] font-bold uppercase tracking-[0.05em]",
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
    <span className="tag-live">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: "live" | "upcoming" | "completed" }) {
  if (status === "live") return <LiveChip />;
  if (status === "upcoming") {
    return (
      <Chip tone="amber" className="tracking-[0.06em]">
        Upcoming
      </Chip>
    );
  }
  return (
    <Chip tone="neutral" className="tracking-[0.06em]">
      Final
    </Chip>
  );
}

/* ------------------------------------------------------------------ rank */

export function RankBadge({ rank, size = "md" }: { rank: number; size?: "sm" | "md" }) {
  const highlight = rank === 1;
  return (
    <span
      className={cn(
        "tnum inline-grid place-items-center font-bold",
        size === "sm" ? "h-6 min-w-6 px-1 text-[11px]" : "h-7 min-w-7 px-1.5 text-xs",
        highlight
          ? "bg-[var(--ink)] text-[var(--paper)]"
          : rank <= 3
            ? "border border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)]"
            : "text-[var(--ink-3)]",
      )}
    >
      {rank || "—"}
    </span>
  );
}

/* ------------------------------------------------------------------ stats */

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
      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{label}</p>
      <p
        className={cn(
          "x num mt-1 text-[24px] font-extrabold leading-none",
          accent ? "text-[var(--red)]" : "text-[var(--ink)]",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- empty state */

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
        "flex flex-col items-center justify-center gap-2.5 border-y border-dashed border-[var(--hair)] bg-[var(--paper-2)]/50 px-5 py-10 text-center",
        className,
      )}
    >
      <p className="x text-[20px] font-extrabold text-[var(--ink)]">{title}</p>
      {description && (
        <p className="font-serif-ed max-w-md text-[14px] leading-relaxed text-[var(--ink-2)]">{description}</p>
      )}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- pagination */

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
    "tnum inline-grid h-8 min-w-8 place-items-center border px-2 text-[13px] font-bold transition-colors";

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-7" aria-label="Pagination">
      {page === 1 ? (
        <span aria-hidden="true" className={cn(base, "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] opacity-35")}>
          ←
        </span>
      ) : (
        <Link
          href={buildHref(page - 1)}
          className={cn(base, "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]")}
        >
          ←
        </Link>
      )}

      {pages[0] > 1 && (
        <>
          <Link
            href={buildHref(1)}
            className={cn(base, "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] hover:text-[var(--ink)]")}
          >
            1
          </Link>
          {pages[0] > 2 && <span className="px-1 text-[var(--ink-3)]">…</span>}
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
              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
              : "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
          )}
        >
          {p}
        </Link>
      ))}

      {pages[pages.length - 1] < pageCount && (
        <>
          {pages[pages.length - 1] < pageCount - 1 && <span className="px-1 text-[var(--ink-3)]">…</span>}
          <Link
            href={buildHref(pageCount)}
            className={cn(base, "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] hover:text-[var(--ink)]")}
          >
            {pageCount}
          </Link>
        </>
      )}

      {page === pageCount ? (
        <span aria-hidden="true" className={cn(base, "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] opacity-35")}>
          →
        </span>
      ) : (
        <Link
          href={buildHref(page + 1)}
          className={cn(base, "border-[var(--hair)] bg-[var(--paper)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]")}
        >
          →
        </Link>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ tabs */

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
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "border px-3 py-1.5 text-[13px] font-bold transition-colors hover:no-underline",
              isActive
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                : "border-[var(--hair)] bg-transparent text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("tnum ml-1.5 text-[11px]", isActive ? "opacity-80" : "text-[var(--ink-3)]")}>
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--hair)]", className)} />;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--hair)] py-2 last:border-0">
      <dt className="shrink-0 text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</dt>
      <dd className="text-right text-[13.5px] font-medium text-[var(--ink)]">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------- panel building blocks */

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
        "border-b border-[var(--hair)] border-t-2 border-t-[var(--ink)] bg-[var(--paper)]",
        stickyHead ? "overflow-clip" : "overflow-hidden",
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cn(
            "flex min-h-[40px] items-center justify-between gap-3 border-b border-[var(--hair)] bg-[var(--paper)] px-3.5 py-2",
            stickyHead && "sticky top-0 z-30",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="x truncate text-[18px] font-extrabold text-[var(--ink)]">{title}</h2>
            {meta && <span className="tnum shrink-0 text-[12px] font-semibold text-[var(--ink-3)]">{meta}</span>}
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
        "no-scrollbar mask-fade-r flex items-stretch gap-4 overflow-x-auto border-b border-[var(--hair)] pr-4",
        sticky && "sticky top-0 z-30 bg-[var(--paper)]",
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
            "relative -mb-px shrink-0 border-b-2 py-2.5 text-[13.5px] font-bold transition-colors hover:no-underline",
            item.active
              ? "border-[var(--ink)] text-[var(--ink)]"
              : "border-transparent text-[var(--ink-3)] hover:border-[var(--hair)] hover:text-[var(--ink)]",
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className="tnum ml-1.5 text-[11px] text-[var(--ink-3)]">{item.count}</span>
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
        "tnum inline-block border border-[var(--hair)] bg-[var(--paper-2)] px-1.5 py-[1px] text-[11px] font-bold text-[var(--ink)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
