"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { flagClass } from "@/lib/flag";
import { SafeImage } from "./safe-image";
import { cn } from "./primitives";

export type SortDirection = "asc" | "desc";

export type CellValue =
  | string
  | number
  | null
  | {
      kind: "person";
      href: string;
      name: string;
      sub?: string;
      photo?: string | null;
      badge?: string;
    }
  | { kind: "rank"; value: number }
  | { kind: "tag"; text: string; tone?: string }
  | { kind: "nation"; code: string }
  | { kind: "link"; href: string; text: string };

export interface TableColumn {
  id: string;
  label: string;
  shortLabel?: string;
  numeric?: boolean;
  align?: "left" | "right";
  hideBelow?: "sm" | "md" | "lg" | "xl";
  defaultDirection?: SortDirection;
}

export interface TableRow {
  key: string;
  href?: string;
  linkLabel?: string;
  cells: Record<string, CellValue>;
  sortValues?: Record<string, number | string>;
  /** Searchable text used when `searchable` is enabled on DataTable. */
  searchText?: string;
  /** Nation code used when `nationFilter` is enabled on DataTable. */
  nationCode?: string;
  /** Optional PBA cutline banner rendered directly before this row in default order. */
  dividerBefore?: {
    label: string;
    tone?: "carom" | "amber" | "rose";
  };
}

export interface TablePayload {
  columns: TableColumn[];
  rows: TableRow[];
  ranks?: Record<string, number>;
  /** Keep official `ranks` intact even when sorting by another column or filtering. */
  preserveRanks?: boolean;
  initialSort?: { id: string; direction: SortDirection } | null;
  rankLabel?: string;
  maxHeight?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  nationFilter?: boolean;
}

const HIDE_CLASS: Record<NonNullable<TableColumn["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

function sortKey(value: CellValue | undefined): number | string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (value.kind === "rank") return value.value;
  if (value.kind === "person") return value.name;
  if (value.kind === "nation") return value.code;
  return value.text;
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

function SortIcon({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />;
  return direction === "desc" ? (
    <ArrowDown className="h-3 w-3 text-foreground" aria-hidden="true" />
  ) : (
    <ArrowUp className="h-3 w-3 text-foreground" aria-hidden="true" />
  );
}

function Cell({ value }: { value: CellValue }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/60">—</span>;
  }

  if (typeof value === "number") {
    return <span className="font-mono tabular-nums">{value.toLocaleString("en-US")}</span>;
  }
  if (typeof value === "string") return <>{value}</>;

  if (value.kind === "rank") {
    return (
      <span
        className={cn(
          "inline-grid h-5 min-w-5 place-items-center rounded-md px-1 font-mono text-[11px] font-semibold tabular-nums",
          value.value === 1
            ? "bg-foreground text-background"
            : value.value <= 3
              ? "bg-secondary text-foreground"
              : "text-muted-foreground",
        )}
      >
        {value.value || "—"}
      </span>
    );
  }

  if (value.kind === "tag") {
    return (
      <span className="inline-flex items-center rounded-md border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {value.text}
      </span>
    );
  }

  if (value.kind === "nation") {
    if (!value.code) return <span className="text-muted-foreground/60">—</span>;
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <i className={flagClass(value.code)} aria-hidden="true" />
        <span>{value.code}</span>
      </span>
    );
  }

  if (value.kind === "link") {
    return (
      <Link
        href={value.href}
        onClick={(e) => e.stopPropagation()}
        className="text-[13px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        {value.text}
      </Link>
    );
  }

  const fallbackInitials =
    value.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "–";

  return (
    <Link href={value.href} className="group/cell flex items-center gap-2.5 transition-colors hover:no-underline">
      <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-[10px] font-semibold text-muted-foreground">
        <span aria-hidden="true">{fallbackInitials}</span>
        <SafeImage
          src={value.photo}
          alt=""
          revealOnLoad
          className="absolute inset-0 h-full w-full object-cover object-top"
          fallback={null}
        />
      </span>
      <span className="block min-w-0 max-w-[175px]">
        <span className="block truncate text-[13px] font-medium text-foreground group-hover/cell:underline">
          {value.name}
        </span>
        {value.sub && <span className="block truncate text-[11px] text-muted-foreground">{value.sub}</span>}
      </span>
      {value.badge && (
        <span className="shrink-0 rounded-md border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-muted-foreground">
          {value.badge}
        </span>
      )}
    </Link>
  );
}

export function DataTable({
  payload,
  empty,
  className,
  hideSortBar = false,
}: {
  payload: TablePayload;
  empty?: string;
  className?: string;
  hideSortBar?: boolean;
}) {
  const {
    columns,
    rows,
    ranks,
    preserveRanks = false,
    initialSort,
    rankLabel = "#",
    maxHeight,
    searchable = false,
    searchPlaceholder = "Filter players…",
    nationFilter = false,
  } = payload;
  const router = useRouter();
  const initialSortKey = initialSort ? `${initialSort.id}:${initialSort.direction}` : "";
  const [query, setQuery] = useState("");
  const [nation, setNation] = useState("");
  const [sortState, setSortState] = useState<{
    seed: string;
    value: { id: string; direction: SortDirection } | null;
  }>({
    seed: initialSortKey,
    value: initialSort ?? null,
  });

  // Commit the new default seed whenever server-supplied `initialSort` changes.
  if (sortState.seed !== initialSortKey) {
    setSortState({
      seed: initialSortKey,
      value: initialSort ?? null,
    });
  }
  const sort = sortState.seed === initialSortKey ? sortState.value : (initialSort ?? null);
  const setSort = (
    updater:
      | ({ id: string; direction: SortDirection } | null)
      | ((
          current: { id: string; direction: SortDirection } | null,
        ) => { id: string; direction: SortDirection } | null),
  ) => {
    setSortState((prev) => {
      const current = prev.seed === initialSortKey ? prev.value : (initialSort ?? null);
      const next = typeof updater === "function" ? updater(current) : updater;
      return { seed: initialSortKey, value: next };
    });
  };

  const nationOptions = useMemo(() => {
    if (!nationFilter) return [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const code = (row.nationCode ?? "").trim().toUpperCase();
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8);
  }, [rows, nationFilter]);

  const filtered = useMemo(() => {
    const normQuery = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .normalize("NFC");
    if (!normQuery && !nation) return rows;
    return rows.filter((row) => {
      if (nation && (row.nationCode ?? "").trim().toUpperCase() !== nation) return false;
      if (!normQuery) return true;
      const haystack = (
        row.searchText ??
        Object.values(row.cells)
          .map((c) => {
            if (typeof c === "string" || typeof c === "number") return String(c);
            if (c && typeof c === "object" && "kind" in c) {
              if (c.kind === "person") return `${c.name} ${c.sub ?? ""}`;
              if (c.kind === "nation") return c.code;
              if ("text" in c) return c.text;
            }
            return "";
          })
          .join(" ")
      )
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .normalize("NFC");
      return haystack.includes(normQuery);
    });
  }, [rows, query, nation]);

  const ordered = useMemo(() => {
    if (!sort) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return filtered
      .map((row, position) => ({ row, position }))
      .sort(
        (a, b) =>
          factor *
            compareValues(
              sortKey(a.row.sortValues?.[sort.id] ?? a.row.cells[sort.id]),
              sortKey(b.row.sortValues?.[sort.id] ?? b.row.cells[sort.id]),
            ) || a.position - b.position,
      )
      .map((entry) => entry.row);
  }, [filtered, sort]);

  const toggle = (column: TableColumn) => {
    setSort((current) => {
      if (current?.id !== column.id) {
        return {
          id: column.id,
          direction: column.defaultDirection ?? (column.numeric ? "desc" : "asc"),
        };
      }
      return { id: column.id, direction: current.direction === "desc" ? "asc" : "desc" };
    });
  };

  const isDefaultSort =
    (!sort && !initialSort) ||
    (Boolean(sort && initialSort) && sort?.id === initialSort?.id && sort?.direction === initialSort?.direction);
  const showSourceRank = Boolean(ranks && (preserveRanks || isDefaultSort));
  const showDividers = isDefaultSort && !query.trim() && !nation;
  const hiddenSortable = columns.filter((col) => Boolean(col.hideBelow) && col.id !== "note");
  const hasXlHidden = hiddenSortable.some((col) => col.hideBelow === "xl");
  const mobileSortHideClass = hasXlHidden ? "xl:hidden" : "lg:hidden";
  const showReset = !isDefaultSort;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      {(searchable || (nationFilter && nationOptions.length > 1)) && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/20 px-4 py-2.5">
          {searchable && (
            <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {nationFilter && nationOptions.length > 1 && (
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto" role="group" aria-label="Filter by nationality">
              <button
                type="button"
                onClick={() => setNation("")}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
                  nation === ""
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                All ({rows.length})
              </button>
              {nationOptions.map(([code, count]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setNation((curr) => (curr === code ? "" : code))}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-medium whitespace-nowrap transition-colors",
                    nation === code
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <i className={flagClass(code)} aria-hidden="true" />
                  <span>{code}</span>
                  <span className="opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!hideSortBar && ordered.length > 0 && (showReset || hiddenSortable.length > 0) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-xs",
            !showReset && mobileSortHideClass,
          )}
        >
          {hiddenSortable.length > 0 && (
            <div className={cn("flex flex-wrap items-center gap-1", mobileSortHideClass)}>
              <span className="mr-1 text-[11px] font-medium text-muted-foreground">Sort</span>
              {hiddenSortable.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => toggle(column)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {column.shortLabel ?? column.label}
                    {active && <SortIcon active direction={sort?.direction} />}
                  </button>
                );
              })}
            </div>
          )}
          {showReset && (
            <button
              type="button"
              onClick={() => setSort(initialSort ?? null)}
              className="ml-auto cursor-pointer rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset order
            </button>
          )}
        </div>
      )}
      {ordered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {empty ?? "No rows to show."}
        </div>
      ) : (
        <div
          className="overflow-auto"
          style={maxHeight ? { maxHeight } : undefined}
          data-sticky-table={maxHeight ? "true" : undefined}
        >
          <table className="stat-table">
            <thead>
              <tr>
                <th scope="col" className="!w-10">{rankLabel}</th>
                {columns.map((column) => {
                  const active = sort?.id === column.id;
                  const alignRight = column.align === "right" || (column.align === undefined && column.numeric);
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      className={cn(
                        column.hideBelow && HIDE_CLASS[column.hideBelow],
                        !alignRight && "!text-left",
                        active && "!text-foreground",
                      )}
                      aria-sort={active ? (sort?.direction === "desc" ? "descending" : "ascending") : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(column)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-1 font-sans text-[11px] font-medium uppercase tracking-wider transition-colors hover:text-foreground",
                          alignRight && "ml-auto",
                        )}
                      >
                        {column.label}
                        <SortIcon active={active} direction={sort?.direction} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, position) => {
                const rankNumber = showSourceRank ? ranks![row.key] ?? position + 1 : position + 1;
                const hasInlineLink = Object.values(row.cells).some(
                  (c) => typeof c === "object" && c !== null && "kind" in c && c.kind === "person" && Boolean(c.href),
                );
                const rankCls = cn(
                  "inline-grid h-5 min-w-5 place-items-center rounded-md px-1 font-mono text-[11px] font-semibold tabular-nums",
                  rankNumber === 1
                    ? "bg-foreground text-background"
                    : rankNumber <= 3
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                );
                const divider = showDividers ? row.dividerBefore : undefined;
                return (
                  <RowWithDivider
                    key={row.key}
                    divider={divider}
                    colSpan={columns.length + 1}
                    row={row}
                    rankNumber={rankNumber}
                    hasInlineLink={hasInlineLink}
                    rankCls={rankCls}
                    columns={columns}
                    onNavigate={(href) => router.push(href)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowWithDivider({
  divider,
  colSpan,
  row,
  rankNumber,
  hasInlineLink,
  rankCls,
  columns,
  onNavigate,
}: {
  divider?: TableRow["dividerBefore"];
  colSpan: number;
  row: TableRow;
  rankNumber: number;
  hasInlineLink: boolean;
  rankCls: string;
  columns: TableColumn[];
  onNavigate: (href: string) => void;
}) {
  const dividerTone =
    divider?.tone === "rose"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      : divider?.tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";

  return (
    <>
      {divider && (
        <tr className="pointer-events-none">
          <td
            colSpan={colSpan}
            className={cn(
              "!border-y !py-1.5 !text-left font-mono text-[10.5px] font-semibold uppercase tracking-wider",
              dividerTone,
            )}
          >
            {divider.label}
          </td>
        </tr>
      )}
      <tr
        className="group"
        data-href={row.href}
        onClick={(event) => {
          if (!row.href || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
          if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
          onNavigate(row.href);
        }}
      >
        <td>
          {row.href && !hasInlineLink ? (
            <Link href={row.href} aria-label={row.linkLabel ?? "Open details"} className={cn(rankCls, "hover:no-underline")}>
              {rankNumber}
            </Link>
          ) : (
            <span className={rankCls}>{rankNumber}</span>
          )}
        </td>
        {columns.map((column) => {
          const alignRight =
            column.align === "right" || (column.align === undefined && column.numeric);
          return (
            <td
              key={column.id}
              className={cn(
                column.hideBelow && HIDE_CLASS[column.hideBelow],
                !alignRight && "!text-left",
              )}
            >
              <Cell value={row.cells[column.id]} />
            </td>
          );
        })}
      </tr>
    </>
  );
}
