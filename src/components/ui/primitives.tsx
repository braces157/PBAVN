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
      className="group inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--link)] transition-colors hover:underline"
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
  carom: "border-[var(--link)]/35 bg-[var(--link)]/10 text-[var(--link)]",
  lime: "border-[var(--win)]/35 bg-[var(--win)]/10 text-[var(--win)]",
  cloth: "border-[var(--cloth)]/40 bg-[var(--cloth)]/10 text-[var(--cloth)]",
  rose: "border-[var(--live)]/40 bg-[var(--live)]/10 text-[var(--live)]",
  cyan: "border-[var(--cloth)]/40 bg-[var(--cloth)]/10 text-[var(--cloth)]",
  amber: "border-[var(--gold)]/45 bg-[var(--gold)]/12 text-[var(--gold)]",
  violet: "border-[var(--cloth)]/40 bg-[var(--cloth)]/10 text-[var(--cloth)]",
  neutral: "border-[var(--line)] bg-[var(--bar-2)] text-[var(--text-2)]",
  live: "border-[var(--live)] bg-[var(--live)] text-white",
  gold: "border-[var(--gold)]/50 bg-[var(--gold)]/15 text-[var(--gold)]",
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
        "inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-[1px] font-display text-[10px] font-bold uppercase tracking-[0.05em]",
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
  const top3 = rank > 0 && rank <= 3;
  return (
    <span
      className={cn(
        "tnum inline-grid place-items-center rounded-[2px] font-bold",
        size === "sm" ? "h-5 min-w-5 px-1 text-[11px]" : "h-6 min-w-6 px-1.5 text-[12px]",
        rank === 1
          ? "bg-[var(--yellow)] text-[#1d2329]"
          : top3
            ? "border border-[var(--gold)]/45 bg-[var(--gold)]/12 text-[var(--gold)]"
            : "text-[var(--muted)]",
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
      <p className="font-display text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 font-display text-[20px] font-bold leading-tight",
          accent ? "text-[var(--win)]" : "text-[var(--text)]",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{hint}</p>}
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
        "flex flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed border-[var(--line-2)] bg-[var(--panel)] px-5 py-9 text-center",
        className,
      )}
    >
      <p className="font-display text-[16px] font-bold text-[var(--text)]">{title}</p>
      {description && (
        <p className="max-w-md text-[12.5px] leading-relaxed text-[var(--text-2)]">{description}</p>
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
    "tnum inline-grid h-7 min-w-7 place-items-center rounded-[2px] border px-2 text-[12px] font-semibold transition-colors";

  return (
    <nav className="flex items-center justify-center gap-1 pt-5" aria-label="Pagination">
      {page === 1 ? (
        <span aria-hidden="true" className={cn(base, "border-[var(--line)] bg-[var(--bar)] text-[var(--muted)] opacity-60")}>
          ←
        </span>
      ) : (
        <Link
          href={buildHref(page - 1)}
          className={cn(base, "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:border-[var(--link)] hover:text-[var(--link)]")}
        >
          ←
        </Link>
      )}

      {pages[0] > 1 && (
        <>
          <Link
            href={buildHref(1)}
            className={cn(base, "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:text-[var(--link)]")}
          >
            1
          </Link>
          {pages[0] > 2 && <span className="px-1 text-[var(--muted)]">…</span>}
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
              ? "border-[var(--line-2)] border-b-2 border-b-[var(--yellow)] bg-[var(--bar-2)] text-[var(--text)]"
              : "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:border-[var(--link)] hover:text-[var(--link)]",
          )}
        >
          {p}
        </Link>
      ))}

      {pages[pages.length - 1] < pageCount && (
        <>
          {pages[pages.length - 1] < pageCount - 1 && <span className="px-1 text-[var(--muted)]">…</span>}
          <Link
            href={buildHref(pageCount)}
            className={cn(base, "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:text-[var(--link)]")}
          >
            {pageCount}
          </Link>
        </>
      )}

      {page === pageCount ? (
        <span aria-hidden="true" className={cn(base, "border-[var(--line)] bg-[var(--bar)] text-[var(--muted)] opacity-60")}>
          →
        </span>
      ) : (
        <Link
          href={buildHref(page + 1)}
          className={cn(base, "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:border-[var(--link)] hover:text-[var(--link)]")}
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
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-[3px] border px-2.5 py-1 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors hover:no-underline",
              isActive
                ? "border-[var(--line-2)] border-b-2 border-b-[var(--yellow)] bg-[var(--bar-2)] text-[var(--text)]"
                : "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("tnum ml-1.5 text-[10.5px]", isActive ? "text-[var(--text)]" : "text-[var(--muted)]")}>
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
  return <div className={cn("h-px w-full bg-[var(--line)]", className)} />;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0">
      <dt className="shrink-0 font-display text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-[12.5px] font-medium text-[var(--text)]">{children}</dd>
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
        "rounded-[3px] border border-[var(--line)] bg-[var(--panel)]",
        stickyHead ? "overflow-clip" : "overflow-hidden",
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cn(
            "flex h-[34px] items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--bar)] px-2.5",
            stickyHead && "sticky top-0 z-30",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-display text-[12.5px] font-bold uppercase tracking-[0.05em] text-[var(--text)]">
              {title}
            </h2>
            {meta && <span className="tnum shrink-0 text-[11.5px] font-medium text-[var(--muted)]">{meta}</span>}
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
        "no-scrollbar mask-fade-r flex items-stretch gap-3 overflow-x-auto border-b border-[var(--line)] bg-[var(--panel)] px-2.5",
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
            "relative -mb-px shrink-0 border-b-2 py-2 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors hover:no-underline",
            item.active
              ? "border-[var(--yellow)] text-[var(--text)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className="tnum ml-1.5 text-[10.5px] text-[var(--muted)]">{item.count}</span>
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
        "tnum inline-block rounded-[2px] border border-[var(--line)] bg-[var(--bar-2)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--text-2)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
