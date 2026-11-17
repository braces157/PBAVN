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
  | { kind: "tag"; text: string; tone?: string };

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
          "tnum inline-grid h-6 min-w-6 place-items-center px-1 text-[11px] font-bold",
          value.value === 1
            ? "bg-[var(--ink)] text-[var(--paper)]"
            : value.value <= 3
              ? "border border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)]"
              : "text-[var(--ink-3)]",
        )}
      >
        {value.value || "—"}
      </span>
    );
  }

  if (value.kind === "tag") {
    return (
      <span className="border border-[var(--hair)] bg-[var(--paper-2)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-2)]">
        {value.text}
      </span>
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
    <Link href={value.href} className="group/cell flex items-center gap-2 transition-colors hover:text-[var(--red)] hover:no-underline">
      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--hair)] bg-[var(--paper-2)] text-[9.5px] font-bold text-[var(--ink)]">
        <SafeImage
          src={value.photo}
          alt=""
          className="h-full w-full object-cover object-top"
          fallback={<span>{fallbackInitials}</span>}
        />
      </span>
      <span className="block min-w-0 max-w-[165px]">
        <span className="block truncate text-[13px] font-bold text-[var(--ink)] group-hover/cell:text-[var(--red)]">
          {value.name}
        </span>
        {value.sub && <span className="block truncate text-[11px] text-[var(--ink-3)]">{value.sub}</span>}
      </span>
      {value.badge && (
        <span className="shrink-0 border border-[var(--hair)] px-1 py-0.5 text-[9.5px] font-bold uppercase text-[var(--ink-2)]">
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
          factor *
            compareValues(
              sortKey(a.row.sortValues?.[sort.id] ?? a.row.cells[sort.id]),
              sortKey(b.row.sortValues?.[sort.id] ?? b.row.cells[sort.id]),
            ) ||
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
    <div className={cn("overflow-hidden border-b border-[var(--ink)] bg-[var(--paper)]", className)}>
      {ordered.length === 0 ? (
        <div className="border-t-2 border-[var(--ink)] px-4 py-10 text-center text-[13.5px] text-[var(--ink-2)]">
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
                <th className="!w-10">{rankLabel}</th>
                {columns.map((column) => {
                  const active = sort?.id === column.id;
                  const alignRight = column.align === "right" || (column.align === undefined && column.numeric);
                  return (
                    <th
                      key={column.id}
                      className={cn(
                        column.hideBelow && HIDE_CLASS[column.hideBelow],
                        !alignRight && "!text-left",
                        active && "!text-[var(--ink)]",
                      )}
                      aria-sort={active ? (sort?.direction === "desc" ? "descending" : "ascending") : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(column)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-1 font-bold uppercase tracking-[0.05em] transition-colors hover:text-[var(--ink)]",
                          alignRight && "ml-auto",
                        )}
                      >
                        {column.label}
                        <span aria-hidden="true" className={cn("text-[9px] leading-none", active ? "opacity-100 text-[var(--red)]" : "opacity-45")}>
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
                return (
                  <tr
                    key={row.key}
                    className="group"
                    data-href={row.href}
                    onClick={(event) => {
                      if (!row.href) return;
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      if ((event.target as HTMLElement).closest("a")) return;
                      router.push(row.href);
                    }}
                  >
                    <td>
                      {row.href ? (
                        <Link
                          href={row.href}
                          aria-label={row.linkLabel ?? "Open details"}
                          className={cn(
                            "tnum inline-grid h-6 min-w-6 place-items-center px-1 text-[11px] font-bold transition-colors hover:no-underline",
                            rankNumber === 1
                              ? "bg-[var(--ink)] text-[var(--paper)]"
                              : rankNumber <= 3
                                ? "border border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)]"
                                : "text-[var(--ink-3)] group-hover:text-[var(--red)]",
                          )}
                        >
                          {rankNumber}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "tnum inline-grid h-6 min-w-6 place-items-center px-1 text-[11px] font-bold",
                            rankNumber === 1 ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-3)]",
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
