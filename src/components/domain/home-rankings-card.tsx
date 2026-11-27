"use client";

import Link from "next/link";
import { useState } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { FollowButton } from "@/components/ui/follow-button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HomeRankItem } from "./home-types";

type RankTab = "pba" | "lpba" | "prize";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function HomeRankingsCard({
  pba,
  lpba,
  prize,
}: {
  pba: HomeRankItem[];
  lpba: HomeRankItem[];
  prize: HomeRankItem[];
}) {
  const [tab, setTab] = useState<RankTab>("pba");
  const rows = tab === "lpba" ? lpba : tab === "prize" ? prize : pba;
  const fullHref =
    tab === "lpba"
      ? "/rankings?league=LPBA1"
      : tab === "prize"
        ? "/rankings?metric=prize"
        : "/rankings?league=PBA1&metric=point";

  return (
    <Card className="overflow-hidden" aria-label="World tour rankings">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">World Rankings</h2>

        <Tabs value={tab} onValueChange={(v) => setTab(v as RankTab)}>
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="pba" className="h-6 px-2 text-[11px]">
              PBA
            </TabsTrigger>
            <TabsTrigger value="lpba" className="h-6 px-2 text-[11px]">
              LPBA
            </TabsTrigger>
            <TabsTrigger value="prize" className="h-6 px-2 text-[11px]">
              Prize
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.slice(0, 8).map((row) => (
            <li
              key={`${tab}-${row.code}-${row.rank}`}
              className="grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-2 px-3.5 py-2 transition-colors hover:bg-accent/50"
            >
              <span
                className={`mono text-center text-xs font-semibold ${
                  row.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                }`}
              >
                {row.rank}
              </span>

              <Link
                href={`/players/${encodeURIComponent(row.code)}`}
                title={row.name}
                className="group flex min-w-0 items-center gap-2"
              >
                <span className="relative inline-grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-[10px] font-semibold text-muted-foreground">
                  <span aria-hidden="true">{initialsOf(row.name)}</span>
                  {row.photo && (
                    <SafeImage
                      src={row.photo}
                      alt=""
                      revealOnLoad
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      fallback={null}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground group-hover:text-[var(--pba)]">
                  {row.name}
                </span>
              </Link>

              <FollowButton
                compact
                className="shrink-0"
                player={{
                  code: row.code,
                  name: row.name,
                  circuit: row.circuit,
                  nation: row.nation,
                }}
              />

              <span className="mono min-w-[48px] text-right text-xs font-semibold text-foreground">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          Rankings temporarily unavailable.
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">Star to follow live</span>
        <Link href={fullHref} className="font-medium text-[var(--pba)] hover:underline">
          Full standings →
        </Link>
      </div>
    </Card>
  );
}
