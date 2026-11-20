"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
}

export interface TablePayload {
  columns: TableColumn[];
  rows: TableRow[];
  ranks?: Record<string, number>;
  initialSort?: { id: string; direction: SortDirection } | null;
  rankLabel?: string;
  maxHeight?: string;
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
  return value.text;
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

function Cell({ value }: { value: CellValue }) {
  if (value === null || value === undefined || value === "") return <span className="text-[var(--ink-3)]">—</span>;

  if (typeof value === "number") return <span className="tnum">{value.toLocaleString("en-US")}</span>;
  if (typeof value === "string") return <>{value}</>;

  if (value.kind === "rank") {
    return (
      <span
        className={cn(
          "tnum inline-grid h-5 min-w-5 place-items-center rounded-[2px] px-1 text-[11px] font-bold",
          value.value === 1
            ? "bg-[var(--yellow)] text-[#1d2329]"
            : value.value <= 3
              ? "text-[var(--gold)]"
              : "text-[var(--muted)]",
        )}
      >
        {value.value || "—"}
      </span>
    );
  }

  if (value.kind === "tag") {
    return (
      <span className="rounded-[2px] border border-[var(--line)] bg-[var(--bar-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-2)]">
        {value.text}
      </span>
    );
  }

  if (value.kind === "link") {
    return (
      <Link
        href={value.href}
        onClick={(e) => e.stopPropagation()}
        className="text-[12.5px] font-medium text-[var(--text-2)] underline-offset-2 transition-colors hover:text-[var(--link)] hover:underline"
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
    <Link href={value.href} className="group/cell flex items-center gap-2 transition-colors hover:text-[var(--link)] hover:no-underline">
      <span className="av overflow-hidden">
        <SafeImage
          src={value.photo}
          alt=""
          className="h-full w-full object-cover object-top"
          fallback={<span>{fallbackInitials}</span>}
        />
      </span>
      <span className="block min-w-0 max-w-[165px]">
        <span className="block truncate text-[12.5px] font-semibold text-[var(--text)] group-hover/cell:text-[var(--link)]">
          {value.name}
        </span>
        {value.sub && <span className="block truncate text-[11px] text-[var(--muted)]">{value.sub}</span>}
      </span>
      {value.badge && (
        <span className="shrink-0 rounded-[2px] border border-[var(--line)] bg-[var(--bar-2)] px-1 py-0.5 text-[9.5px] font-semibold uppercase text-[var(--text-2)]">
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
  const { columns, rows, ranks, initialSort, rankLabel = "#", maxHeight } = payload;
  const router = useRouter();
  const initialSortKey = initialSort ? `${initialSort.id}:${initialSort.direction}` : "";
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

  const ordered = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return rows
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
  }, [rows, sort]);

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

  const showSourceRank = !sort && ranks;
  const hiddenSortable = columns.filter((col) => Boolean(col.hideBelow) && col.id !== "note");
  const hasXlHidden = hiddenSortable.some((col) => col.hideBelow === "xl");
  const mobileSortHideClass = hasXlHidden ? "xl:hidden" : "lg:hidden";
  const showReset = sort !== null;

  return (
    <div className={cn("overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--panel)]", className)}>
      {!hideSortBar && ordered.length > 0 && (showReset || hiddenSortable.length > 0) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--bar)] px-2.5 py-1.5 text-[11.5px]",
            !showReset && mobileSortHideClass,
          )}
        >
          {hiddenSortable.length > 0 && (
            <div className={cn("flex flex-wrap items-center gap-1", mobileSortHideClass)}>
              <span className="mr-1 font-display text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted)]">
                Sort
              </span>
              {hiddenSortable.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => toggle(column)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors",
                      active
                        ? "border-[var(--line-2)] border-b-2 border-b-[var(--yellow)] bg-[var(--bar-2)] text-[var(--text)]"
                        : "border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:text-[var(--text)]",
                    )}
                  >
                    {column.shortLabel ?? column.label}
                    {active && <span aria-hidden="true">{sort?.direction === "desc" ? "▼" : "▲"}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {showReset && (
            <button
              type="button"
              onClick={() => setSort(null)}
              className="ml-auto rounded-[2px] border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-2)] transition-colors hover:border-[var(--link)] hover:text-[var(--link)]"
            >
              Reset order
            </button>
          )}
        </div>
      )}
      {ordered.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">
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
                        active && "!text-[var(--text)]",
                      )}
                      aria-sort={active ? (sort?.direction === "desc" ? "descending" : "ascending") : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(column)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-1 font-display font-semibold uppercase tracking-[0.05em] transition-colors hover:text-[var(--text)]",
                          alignRight && "ml-auto",
                        )}
                      >
                        {column.label}
                        <span aria-hidden="true" className={cn("text-[9px] leading-none", active ? "text-[var(--link)] opacity-100" : "opacity-45")}>
                          {active ? (sort?.direction === "desc" ? "▼" : "▲") : "⇅"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, position) => {
                const rankNumber = showSourceRank ? ranks[row.key] ?? position + 1 : position + 1;
                const hasInlineLink = Object.values(row.cells).some(
                  (cell) =>
                    typeof cell === "object" &&
                    cell !== null &&
                    "kind" in cell &&
                    cell.kind === "person" &&
                    Boolean(cell.href),
                );
                return (
                  <tr
                    key={row.key}
                    className="group"
                    data-href={row.href}
                    onClick={(event) => {
                      if (!row.href) return;
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
                      if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
                      router.push(row.href);
                    }}
                  >
                    <td>
                      {row.href && !hasInlineLink ? (
                        <Link
                          href={row.href}
                          aria-label={row.linkLabel ?? "Open details"}
                          className={cn(
                            "tnum inline-grid h-5 min-w-5 place-items-center rounded-[2px] px-1 text-[11px] font-bold transition-colors hover:no-underline",
                            rankNumber <= 3 ? "text-[var(--gold)]" : "text-[var(--muted)] group-hover:text-[var(--link)]",
                          )}
                        >
                          {rankNumber}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "tnum inline-grid h-5 min-w-5 place-items-center rounded-[2px] px-1 text-[11px] font-bold",
                            rankNumber <= 3 ? "text-[var(--gold)]" : "text-[var(--muted)]",
                          )}
                        >
                          {rankNumber}
                        </span>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
