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
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h2 className="display-md text-fog-100">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-fog-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-fog-300 transition-colors hover:text-lime-400"
    >
      {children}
      <svg viewBox="0 0 12 12" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
        <path
          d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

/* ----------------------------------------------------------------- chips */

const TONE: Record<string, string> = {
  lime: "border-lime-400/35 bg-lime-400/10 text-lime-300",
  rose: "border-rose-450/35 bg-rose-450/10 text-rose-450",
  cyan: "border-cyan-450/35 bg-cyan-450/10 text-cyan-450",
  amber: "border-amber-450/35 bg-amber-450/10 text-amber-450",
  violet: "border-violet-450/35 bg-violet-450/10 text-violet-450",
  neutral: "border-ink-650 bg-ink-800 text-fog-400",
  live: "border-live-500/40 bg-live-500/12 text-live-400",
  gold: "border-gold-400/40 bg-gold-400/10 text-gold-400",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-[0.08em]",
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-live-500/40 bg-live-500/12 px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.1em] text-live-400">
      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: "live" | "upcoming" | "completed" }) {
  if (status === "live") return <LiveChip />;
  if (status === "upcoming")
    return (
      <Chip tone="lime" className="tracking-[0.1em]">
        Upcoming
      </Chip>
    );
  return (
    <Chip tone="neutral" className="tracking-[0.1em]">
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
        "tnum inline-grid place-items-center rounded-md font-display font-bold",
        size === "sm" ? "h-6 min-w-6 px-1 text-[11px]" : "h-7 min-w-7 px-1.5 text-xs",
        highlight
          ? "bg-gold-400/15 text-gold-400 ring-1 ring-gold-400/30"
          : rank <= 3
            ? "bg-ink-700 text-fog-200"
            : "text-fog-500",
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
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-fog-600">{label}</p>
      <p
        className={cn(
          "tnum mt-1.5 font-display text-[22px] font-bold leading-none tracking-tight",
          accent ? "text-lime-400" : "text-fog-100",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-fog-500">{hint}</p>}
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
        "flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-ink-700 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid h-11 w-11 place-items-center rounded-full border border-ink-700 text-fog-600">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8.5 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-display text-base font-semibold text-fog-200">{title}</p>
      {description && <p className="max-w-md text-[13px] leading-relaxed text-fog-500">{description}</p>}
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
    "tnum inline-grid h-9 min-w-9 place-items-center rounded-md border px-2.5 text-[13px] font-medium transition-colors";

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-8" aria-label="Pagination">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          base,
          "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
          page === 1 && "pointer-events-none opacity-35",
        )}
      >
        ←
      </Link>

      {pages[0] > 1 && (
        <>
          <Link href={buildHref(1)} className={cn(base, "border-ink-700 text-fog-400 hover:text-fog-100")}>
            1
          </Link>
          {pages[0] > 2 && <span className="px-1 text-fog-600">…</span>}
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
              ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
              : "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
          )}
        >
          {p}
        </Link>
      ))}

      {pages[pages.length - 1] < pageCount && (
        <>
          {pages[pages.length - 1] < pageCount - 1 && <span className="px-1 text-fog-600">…</span>}
          <Link href={buildHref(pageCount)} className={cn(base, "border-ink-700 text-fog-400 hover:text-fog-100")}>
            {pageCount}
          </Link>
        </>
      )}

      <Link
        href={buildHref(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={cn(
          base,
          "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
          page === pageCount && "pointer-events-none opacity-35",
        )}
      >
        →
      </Link>
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
              "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "border-lime-400/45 bg-lime-400/10 text-lime-300"
                : "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className="tnum ml-1.5 text-[11px] text-fog-600">{item.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-ink-800", className)} />;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-800 py-2.5 last:border-0">
      <dt className="shrink-0 text-[12px] font-medium uppercase tracking-[0.08em] text-fog-600">{label}</dt>
      <dd className="text-right text-[13.5px] text-fog-200">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------- console building blocks */

/**
 * The panel that every console page is built from: a 1px hairline card with a
 * compact title bar. Matches the sheet-like blocks on a scoreboard site —
 * content first, chrome kept to a single line of type.
 */
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
  /**
   * Keep the title bar under the site header while the panel body scrolls past.
   * On short panels the browser clamps the offset, which inside an
   * `overflow-hidden` ancestor hides the header entirely — so only long panels
   * ask for it.
   */
  stickyHead?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        // `overflow-hidden` makes the section a scroll container, which stops the
        // sticky header from ever pinning; clip cuts without that side effect.
        "rounded-[10px] border border-ink-750 bg-ink-900",
        stickyHead ? "overflow-clip" : "overflow-hidden",
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cn(
            "flex min-h-[38px] items-center justify-between gap-3 border-b border-ink-800 px-3 py-2",
            stickyHead && "sticky top-16 z-30 bg-ink-900",
          )}
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="truncate font-display text-[12.5px] font-bold uppercase tracking-[0.09em] text-fog-100">
              {title}
            </h2>
            {meta && <span className="tnum shrink-0 text-[11px] text-fog-600">{meta}</span>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * A strip of tabs rendered as links, so every view stays addressable.
 * The active tab keeps the restrained lime underline rather than a filled pill:
 * a scoreboard reader scans labels, not buttons.
 */
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
        "flex items-stretch gap-0 overflow-x-auto border-b border-ink-800",
        sticky && "sticky top-16 z-30 bg-ink-950/92 backdrop-blur-xl",
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
            "relative -mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[12.5px] font-semibold transition-colors",
            item.active
              ? "border-lime-400 text-fog-100"
              : "border-transparent text-fog-500 hover:border-ink-600 hover:text-fog-200",
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className="tnum ml-1.5 text-[10.5px] text-fog-600">{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Small right-aligned count badge for a list row, e.g. "3M" matches in a round. */
export function CountTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "tnum inline-block rounded-[4px] border border-ink-700 bg-ink-850 px-1.5 py-[1px] text-[10px] font-semibold text-fog-500",
        className,
      )}
    >
      {children}
    </span>
  );
}
