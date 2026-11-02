"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "./primitives";

export type SortDirection = "asc" | "desc";

/**
 * A serialisable table row.
 *
 * Everything a client component needs to reorder and repaint must survive the
 * server/client boundary, so cells arrive as plain values rather than render
 * functions. A cell is either a formatted string, a number, or a small tagged
 * object for the few cells that carry structure (a person chip, a rank chip).
 */
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
  | { kind: "tag"; text: string; tone?: string };

export interface TableColumn {
  id: string;
  label: string;
  shortLabel?: string;
  numeric?: boolean;
  align?: "left" | "right";
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Which sort should the table start on. */
  defaultDirection?: SortDirection;
}

export interface TableRow {
  key: string;
  href?: string;
  /** Accessible name for the row link. */
  linkLabel?: string;
  cells: Record<string, CellValue>;
}

export interface TablePayload {
  columns: TableColumn[];
  rows: TableRow[];
  /** Upstream rank per row, shown when the table is untouched. */
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
  if (value === null || value === undefined || value === "") return <span className="text-fog-600">—</span>;

  if (typeof value === "number") return <span className="tnum">{value.toLocaleString("en-US")}</span>;
  if (typeof value === "string") return <>{value}</>;

  if (value.kind === "rank") {
    return (
      <span
        className={cn(
          "tnum inline-grid h-6 min-w-6 place-items-center rounded-md px-1 text-[11px] font-bold",
          value.value === 1
            ? "bg-gold-400/15 text-gold-400"
            : value.value <= 3
              ? "bg-ink-700 text-fog-200"
              : "bg-ink-800 text-fog-400",
        )}
      >
        {value.value || "—"}
      </span>
    );
  }

  if (value.kind === "tag") {
    return (
      <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-fog-500">
        {value.text}
      </span>
    );
  }

  return (
    <Link href={value.href} className="flex items-center gap-2.5 transition-colors hover:text-lime-300">
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-750 font-display text-[10px] font-bold text-fog-400">
        {value.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.photo} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
        ) : (
          value.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()
        )}
      </span>
      <span className="block min-w-0 max-w-[150px]">
        <span className="block truncate text-[13px] font-medium text-fog-100">{value.name}</span>
        {value.sub && <span className="block truncate text-[10.5px] text-fog-600">{value.sub}</span>}
      </span>
      {value.badge && (
        <span className="shrink-0 rounded border border-ink-700 px-1 py-0.5 text-[9px] font-bold uppercase text-fog-500">
          {value.badge}
        </span>
      )}
    </Link>
  );
}

/**
 * The site's only sortable table.
 *
 * Rows arrive from the server already projected to plain values; this component
 * only reorders them and repaints. Rank renumbers to follow the current sort,
 * the way a leaderboard does, and falls back to the source rank when untouched.
 */
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
  const [sort, setSort] = useState<{ id: string; direction: SortDirection } | null>(initialSort ?? null);

  const ordered = useMemo(() => {
    if (!sort) return rows;
    const index = new Map<number, number>(rows.map((row, position) => [position, position]));
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows]
      .map((row, position) => ({ row, position }))
      .sort(
        (a, b) =>
          factor * compareValues(sortKey(a.row.cells[sort.id]), sortKey(b.row.cells[sort.id])) ||
          (index.get(a.position) ?? 0) - (index.get(b.position) ?? 0),
      )
      .map((entry) => entry.row);
  }, [rows, sort]);

  const toggle = (column: TableColumn) => {
    setSort((current) => {
      if (current?.id !== column.id) {
        return { id: column.id, direction: column.numeric ? "desc" : "asc" };
      }
      return { id: column.id, direction: current.direction === "desc" ? "asc" : "desc" };
    });
  };

  const showSourceRank = !sort && ranks;

  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-ink-750 bg-ink-900", className)}>
      {!hideSortBar && columns.length > 2 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-800 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">Sort</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {columns
              .filter((column) => column.id !== "note")
              .map((column) => {
                const active = sort?.id === column.id;
                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => toggle(column)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors",
                      active
                        ? "border-lime-400/45 bg-lime-400/10 text-lime-300"
                        : "border-ink-700 text-fog-400 hover:border-ink-500 hover:text-fog-100",
                    )}
                  >
                    {column.shortLabel ?? column.label}
                    {active && (
                      <span aria-hidden="true" className="text-[9px]">
                        {sort?.direction === "desc" ? "▼" : "▲"}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          {sort && (
            <button
              type="button"
              onClick={() => setSort(null)}
              className="ml-auto text-[11px] text-fog-600 underline-offset-2 transition-colors hover:text-fog-300"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="px-4 py-12 text-center text-[13px] text-fog-500">{empty ?? "No rows to show."}</div>
      ) : (
        <div
          className="overflow-auto"
          style={maxHeight ? { maxHeight } : undefined}
          data-sticky-table={maxHeight ? "true" : undefined}
        >
          <table className="stat-table">
            <thead>
              <tr>
                <th className="!w-12">{rankLabel}</th>
                {columns.map((column) => {
                  const active = sort?.id === column.id;
                  const alignRight = column.align === "right" || (column.align === undefined && column.numeric);
                  return (
                    <th
                      key={column.id}
                      className={cn(
                        column.hideBelow && HIDE_CLASS[column.hideBelow],
                        !alignRight && "!text-left",
                        "cursor-pointer select-none",
                        active && "!text-lime-300",
                      )}
                      aria-sort={active ? (sort?.direction === "desc" ? "descending" : "ascending") : undefined}
                      onClick={() => toggle(column)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {column.label}
                        <span aria-hidden="true" className={cn("text-[8px] leading-none", active ? "opacity-100" : "opacity-30")}>
                          {active ? (sort?.direction === "desc" ? "▼" : "▲") : "⇅"}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, position) => (
                <tr
                  key={row.key}
                  className="group"
                  data-href={row.href}
                  onClick={(event) => {
                    if (!row.href) return;
                    // Modifier clicks and real links keep their native behaviour.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    if ((event.target as HTMLElement).closest("a")) return;
                    router.push(row.href);
                  }}
                >
                  <td>
                    {row.href && (
                      <Link
                        href={row.href}
                        aria-label={row.linkLabel ?? "Open details"}
                        className="tnum inline-grid h-6 min-w-6 place-items-center rounded-md bg-ink-800 px-1 text-[11px] font-bold text-fog-300 transition-colors hover:bg-ink-700 hover:text-lime-300"
                      >
                        {showSourceRank ? ranks[row.key] ?? position + 1 : position + 1}
                      </Link>
                    )}
                    {!row.href && (
                      <span
                        className={cn(
                          "tnum inline-grid h-6 min-w-6 place-items-center rounded-md px-1 text-[11px] font-bold",
                          (showSourceRank ? ranks[row.key] : position + 1) === 1
                            ? "bg-gold-400/15 text-gold-400"
                            : "bg-ink-800 text-fog-300",
                        )}
                      >
                        {showSourceRank ? ranks[row.key] ?? position + 1 : position + 1}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

