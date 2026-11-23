"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { HomeFixtureRow, HomeLeadStory } from "./home-types";

export function HomeEditorialHero({
  leadStory,
  upcomingToday,
  nextClock,
  countdown,
  feedReachable = true,
}: {
  leadStory: HomeLeadStory | null;
  upcomingToday: HomeFixtureRow[];
  nextClock: string;
  countdown: string | null;
  feedReachable?: boolean;
}) {
  const nextGroup = nextClock
    ? upcomingToday.filter((m) => m.clock === nextClock).slice(0, 3)
    : upcomingToday.slice(0, 3);

  return (
    <Card className="overflow-hidden" aria-label="Featured PBA highlight">
      <div className="grid grid-cols-1 sm:grid-cols-[1.05fr_1fr]">
        {leadStory?.photo && (
          <Link
            href={`/news/${leadStory.seq}`}
            className="group relative block min-h-[210px] overflow-hidden bg-zinc-950"
          >
            <SafeImage
              src={leadStory.photo}
              alt={leadStory.title}
              loading="eager"
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-xs font-medium text-zinc-400">
                  PBA Tour
                </div>
              }
            />
          </Link>
        )}

        <div className="flex min-w-0 flex-col justify-between gap-4 p-5">
          <div>
            {!feedReachable ? (
              <Badge variant="outline" className="gap-1.5 border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3" />
                <span>Live scoring temporarily unavailable</span>
              </Badge>
            ) : nextClock ? (
              <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 text-[11px]">
                <Clock className="size-3 text-[var(--pba)]" />
                <span suppressHydrationWarning>
                  Next {nextClock} KST{countdown ? ` · ${countdown}` : ""}
                </span>
              </Badge>
            ) : (
              <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                PBA Tour
              </Badge>
            )}

            <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-foreground">
              {leadStory ? leadStory.title : "Korean Professional 3-Cushion Billiards"}
            </h1>

            {leadStory?.summary && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {leadStory.summary}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {leadStory && (
              <Button size="sm" asChild>
                <Link href={`/news/${leadStory.seq}`}>
                  Read story <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href="/live">Live Arena</Link>
            </Button>
          </div>
        </div>
      </div>

      {nextGroup.length > 0 && (
        <div className="border-t border-border bg-secondary/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted-foreground">
              Queued at {nextClock} KST ({upcomingToday.length} today)
            </span>
            <Link href="/schedule" className="font-medium text-[var(--pba)] hover:underline">
              Full schedule →
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
