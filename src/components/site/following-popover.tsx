"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, X } from "lucide-react";
import type { LiveMatch } from "@/lib/pba/live";
import { flagClass } from "@/lib/flag";
import { useFollowing, type FollowedPlayer } from "@/lib/following";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function findLiveStatus(player: FollowedPlayer, liveMatches: LiveMatch[]) {
  const needle = player.name.trim().toLowerCase();
  const last = needle.split(/\s+/).pop() ?? "";
  for (const m of liveMatches) {
    const idx = m.sides.findIndex((s) => {
      const n = s.name.trim().toLowerCase();
      return n === needle || (last.length >= 3 && n.includes(last));
    });
    if (idx !== -1) {
      const opp = m.sides[idx === 0 ? 1 : 0];
      const self = m.sides[idx];
      const setsA = m.fixtureScore ? m.fixtureScore[idx] : self?.setsWon ?? 0;
      const setsB = m.fixtureScore ? m.fixtureScore[idx === 0 ? 1 : 0] : opp?.setsWon ?? 0;
      return {
        pstCode: m.pstCode,
        opponent: opp?.name ?? "Opponent",
        score: `${self?.points ?? setsA}–${opp?.points ?? setsB}`,
        sets: `${setsA}–${setsB}`,
      };
    }
  }
  return null;
}

export function FollowingPopover({ liveMatches }: { liveMatches: LiveMatch[] }) {
  const [open, setOpen] = useState(false);
  const { players, remove, clear } = useFollowing();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 px-2.5 text-xs font-medium sm:px-3"
          aria-label="Followed players watchlist"
        >
          <Star className={`size-3.5 ${players.length > 0 ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
          <span className="hidden md:inline">Following</span>
          {players.length > 0 && (
            <span className="mono rounded bg-secondary px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground">
              {players.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="text-xs font-semibold text-foreground">Followed Players</span>
          {players.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        {players.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Star any player in World Rankings or search to track their live scorecards here.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-3">
              <Link href="/rankings" onClick={() => setOpen(false)}>
                Browse Rankings
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="max-h-[300px] divide-y divide-border overflow-y-auto">
            {players.map((player) => {
              const live = findLiveStatus(player, liveMatches);
              return (
                <li key={player.code} className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-accent/50">
                  <Link
                    href={`/players/${encodeURIComponent(player.code)}`}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <i className={flagClass(player.nation)} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{player.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {live ? `vs ${live.opponent} · Sets ${live.sets}` : player.circuit || "PBA Tour"}
                      </span>
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {live && (
                      <Link href={live.pstCode ? `/matches/${live.pstCode}?live=1` : "/live"} onClick={() => setOpen(false)}>
                        <Badge variant="live" className="mono">
                          {live.score}
                        </Badge>
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => remove(player.code)}
                      aria-label={`Unfollow ${player.name}`}
                      title={`Unfollow ${player.name}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
