import { asset, isRealAsset } from "@/lib/pba/http";
import { photoUrl } from "@/lib/photo";
import { pick } from "@/lib/format";
import type { RawRankingRow } from "@/lib/pba/types";
import { DataTable, type CellValue, type TableColumn, type TableRow } from "@/components/ui/data-table";

/** Table rows show a 28px avatar, so 96px covers a 3x display without shipping the 640px original. */
export function rankingPhoto(row: RawRankingRow): string | null {
  return photoUrl(row.ImgURL, 96) ?? (isRealAsset(row.ImgURL) ? asset(row.ImgURL) : null);
}

/** ₩216.0M for dense cards, ₩216,000,000 for a dedicated column. */
function money(value: number): string {
  if (!value) return "—";
  const trim = (input: string) => input.replace(/\.0$/, "");
  if (value >= 1_000_000_000) return `₩${trim((value / 1_000_000_000).toFixed(1))}B`;
  if (value >= 1_000_000) return `₩${trim((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `₩${trim((value / 1_000).toFixed(0))}K`;
  return `₩${value}`;
}

export function buildRankingColumns(metric: "prize" | "point", dense: boolean): TableColumn[] {
  const columns: TableColumn[] = [
    { id: "player", label: "Player", align: "left", defaultDirection: "asc" },
    { id: "nation", label: "Nation", align: "left", hideBelow: "sm", defaultDirection: "asc" },
    metric === "prize"
      ? { id: "prize", label: "Prize money", shortLabel: "Prize", numeric: true, defaultDirection: "desc" }
      : { id: "points", label: "Ranking points", shortLabel: "Points", numeric: true, defaultDirection: "desc" },
  ];

  if (!dense) {
    columns.push(
      metric === "prize"
        ? { id: "points", label: "Points", shortLabel: "Points", numeric: true, hideBelow: "md", defaultDirection: "desc" }
        : { id: "prize", label: "Prize", shortLabel: "Prize", numeric: true, hideBelow: "md", defaultDirection: "desc" },
    );
  }

  return columns;
}

export function buildRankingRows(rows: RawRankingRow[], metric: "prize" | "point", dense: boolean): TableRow[] {
  return rows.map((row, index) => {
    const cells: Record<string, CellValue> = {
      player: {
        kind: "person",
        href: `/players/${row.MemCode}`,
        name: pick(row.PlayerNameEN, row.PlayerNameKO),
        sub: dense ? undefined : row.PlayerNameKO,
        photo: rankingPhoto(row),
      },
      nation: row.NationCode || null,
      prize: money(row.Prize),
      points: row.RankingPoint ? row.RankingPoint.toLocaleString("en-US") : "—",
    };
    return { key: `${row.MemCode}-${row.Rank}-${index}`, href: `/players/${row.MemCode}`, linkLabel: `Open ${pick(row.PlayerNameEN, row.PlayerNameKO)}`, cells };
  });
}

export function RankingTable({
  rows,
  metric = "prize",
  limit,
  dense = false,
  className,
  maxHeight,
}: {
  rows: RawRankingRow[];
  metric?: "prize" | "point";
  limit?: number;
  dense?: boolean;
  className?: string;
  maxHeight?: string;
}) {
  const visible = typeof limit === "number" ? rows.slice(0, limit) : rows;

  return (
    <DataTable
      className={className}
      payload={{
        columns: buildRankingColumns(metric, dense),
        rows: buildRankingRows(visible, metric, dense),
        ranks: Object.fromEntries(visible.map((row, index) => [`${row.MemCode}-${row.Rank}-${index}`, row.Rank])),
        initialSort: metric === "prize" ? { id: "prize", direction: "desc" } : { id: "points", direction: "desc" },
        maxHeight,
      }}
    />
  );
}
