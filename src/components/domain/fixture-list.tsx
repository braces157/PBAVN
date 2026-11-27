import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TeamLogo } from "@/components/ui/media";
import { Chip, EmptyState, cn } from "@/components/ui/primitives";
import type { TeamFixture } from "@/lib/pba/team-matches";

export interface FixtureClub {
  name: string;
  logo: string | null;
}

export function FixtureList({
  fixtures,
  clubs,
  season,
  round,
  emptyTitle = "No fixtures published",
  emptyDescription,
}: {
  fixtures: TeamFixture[];
  clubs?: Map<string, FixtureClub>;
  season?: string;
  round?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (fixtures.length === 0) {
    return <EmptyState className="border-0" title={emptyTitle} description={emptyDescription} />;
  }

  const club = (code: string | null, fallback: string): FixtureClub => {
    const known = code ? clubs?.get(code) : undefined;
    return known ?? { name: fallback, logo: null };
  };

  const href = (fixture: TeamFixture) => {
    if (!fixture.gameNo) return null;
    const search = new URLSearchParams();
    if (season) search.set("season", season);
    if (round) search.set("round", round);
    const query = search.toString();
    return `/teams/matches/${encodeURIComponent(fixture.gameNo)}${query ? `?${query}` : ""}`;
  };

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fixtures.map((fixture, index) => {
        const home = club(fixture.home.clubCode, fixture.home.name);
        const away = club(fixture.away.clubCode, fixture.away.name);
        const link = href(fixture);
        const key = fixture.gameNo ?? `fixture-${index}`;

        const body = (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {fixture.gameNo ? `Fixture #${fixture.gameNo}` : "Scheduled"}
              </span>
              {fixture.played ? (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {fixture.playedAt ?? ""}
                </span>
              ) : (
                <Chip tone="neutral">Scheduled</Chip>
              )}
            </div>

            <div className="mt-3 space-y-2.5">
              {([home, away] as const).map((side, position) => {
                const competitor = position === 0 ? fixture.home : fixture.away;
                return (
                  <div key={position} className="flex min-w-0 items-center gap-2.5">
                    <TeamLogo src={side.logo} name={side.name} size="xs" />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13.5px]",
                        competitor.won ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {side.name}
                    </span>
                    {fixture.played ? (
                      <span className="shrink-0 text-right font-mono tabular-nums">
                        <span
                          className={cn(
                            "text-base font-semibold",
                            competitor.won ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                          )}
                        >
                          {competitor.sets ?? "–"}
                        </span>
                        <span className="ml-2 hidden text-[11px] text-muted-foreground sm:inline">
                          {competitor.average?.toFixed(3) ?? "—"} · HR {competitor.highRun ?? "—"}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {link && (
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {fixture.played
                    ? (() => {
                        const h = fixture.home.sets ?? 0;
                        const a = fixture.away.sets ?? 0;
                        if (h === 4 && a === 3) return "Pts: 2 – 1 (full 7 sets)";
                        if (a === 4 && h === 3) return "Pts: 1 – 2 (full 7 sets)";
                        if (h === 4) return "Pts: 3 – 0";
                        if (a === 4) return "Pts: 0 – 3";
                        return "Final";
                      })()
                    : fixture.playedAt
                      ? `Kickoff ${fixture.playedAt} KST`
                      : "Scheduled"}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  {fixture.played ? "Bouts & innings" : "Fixture details"}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </span>
              </div>
            )}
            {!link && fixture.playedAt && (
              <p className="mt-3 border-t border-border/60 pt-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                Kickoff {fixture.playedAt}
              </p>
            )}
            {!link && (
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                Bout scorecard not published yet.
              </p>
            )}
          </>
        );

        return (
          <li key={key} className="min-w-0">
            {link ? (
              <Link
                href={link}
                className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40 hover:no-underline"
                aria-label={`${home.name} against ${away.name}${fixture.played ? `, ${fixture.home.sets}–${fixture.away.sets}` : ", scheduled"}`}
              >
                {body}
              </Link>
            ) : (
              <div className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card p-4 opacity-90">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
