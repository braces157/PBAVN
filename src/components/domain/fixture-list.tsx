import Link from "next/link";
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
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {fixtures.map((fixture, index) => {
        const home = club(fixture.home.clubCode, fixture.home.name);
        const away = club(fixture.away.clubCode, fixture.away.name);
        const link = href(fixture);
        const key = fixture.gameNo ?? `fixture-${index}`;

        const body = (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-ink-800 pb-2.5">
              <span className="tnum text-[10.5px] font-bold uppercase tracking-[0.1em] text-fog-500">
                {fixture.gameNo ? `Fixture #${fixture.gameNo}` : "Scheduled"}
              </span>
              {fixture.played ? (
                <span className="tnum text-[10.5px] text-fog-450">{fixture.playedAt ?? ""}</span>
              ) : (
                <Chip tone="neutral">Scheduled</Chip>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {([home, away] as const).map((side, position) => {
                const competitor = position === 0 ? fixture.home : fixture.away;
                return (
                  <div key={position} className="flex min-w-0 items-center gap-2.5">
                    <TeamLogo src={side.logo} name={side.name} size="xs" />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        competitor.won ? "font-bold text-fog-100" : "text-fog-300",
                      )}
                    >
                      {side.name}
                    </span>
                    {fixture.played ? (
                      <span className="tnum shrink-0 text-right">
                        <span
                          className={cn(
                            "font-display text-[16px] font-bold",
                            competitor.won ? "text-carom-300" : "text-fog-500",
                          )}
                        >
                          {competitor.sets ?? "–"}
                        </span>
                        <span className="ml-2 hidden text-[10.5px] text-fog-550 sm:inline">
                          {competitor.average?.toFixed(3) ?? "—"} · HR {competitor.highRun ?? "—"}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {link && (
              <div className="mt-2.5 flex items-center justify-between border-t border-ink-800 pt-2 text-[10.5px]">
                <span className="tnum text-fog-550">
                  {fixture.played ? (fixture.playedAt ?? "") : fixture.playedAt ? `Kickoff ${fixture.playedAt}` : ""}
                </span>
                <span className="font-semibold text-carom-400">
                  {fixture.played ? "Bouts & innings →" : "Fixture details →"}
                </span>
              </div>
            )}
            {!link && fixture.playedAt && (
              <p className="tnum mt-2.5 border-t border-ink-800 pt-2 text-[10.5px] text-fog-450">
                Kickoff {fixture.playedAt}
              </p>
            )}
            {!link && (
              <p className="mt-2.5 text-[10.5px] text-fog-550">
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
                className="surface card-hover flex h-full min-w-0 flex-col p-4"
                aria-label={`${home.name} against ${away.name}${fixture.played ? `, ${fixture.home.sets}–${fixture.away.sets}` : ", scheduled"}`}
              >
                {body}
              </Link>
            ) : (
              <div className="surface flex h-full min-w-0 flex-col p-4 opacity-90">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
