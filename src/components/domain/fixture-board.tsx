import Link from "next/link";
import { TeamLogo } from "@/components/ui/media";
import { cn } from "@/components/ui/primitives";
import { clockLabel, stampDay } from "@/lib/format";
import type { TeamFixture } from "@/lib/pba/team-matches";

export interface FixtureClub {
  name: string;
  logo: string | null;
}

/**
 * One team-league round as a scoreboard: a club on each side, the fixture score
 * in a fixed column, and the result mark in the gutter.
 *
 * A round is 45 fixtures, so the dense row is the only form that fits without
 * turning the event page into a wall of cards. Fixtures that are scheduled but
 * unplayed keep the same shape and read "-", which is what makes the list
 * scannable for "what is next" as well as "what happened".
 */
export function FixtureBoard({
  fixtures,
  clubs,
  season,
  round,
  today,
  playedOpen = false,
  playedHref,
}: {
  fixtures: TeamFixture[];
  clubs?: Map<string, FixtureClub>;
  season?: string;
  round?: string;
  /** `YYYY-MM-DD`; days before it collapse under one "Played" header. */
  today?: string;
  /** Render the played block's rows, or fold them behind a link. */
  playedOpen?: boolean;
  /** Where the fold-out link goes. */
  playedHref?: string;
}) {
  const club = (code: string | null, fallback: string): FixtureClub => {
    const known = code ? clubs?.get(code) : undefined;
    return known ?? { name: fallback, logo: null };
  };

  const groups = groupByDay(fixtures, today);
  // A finished round has nothing left to play, so collapsing its only group
  // would hide the result the page exists to show.
  const hasToPlay = groups.some((group) => group.key !== "played");

  return (
    <div>
      {groups.map((group) => {
        const collapsed = group.key === "played" && !playedOpen && hasToPlay;
        return (
          <section key={group.key}>
            {group.label && (
              <header className="sticky top-16 z-20 flex items-center justify-between gap-3 border-y border-ink-800 bg-ink-950/94 px-2.5 py-1.5 backdrop-blur-md">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fog-450">
                  {group.label}
                </p>
                <p className="tnum flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-fog-600">
                  {collapsed && playedHref ? (
                    <Link href={playedHref} className="font-semibold text-fog-300 transition-colors hover:text-lime-300">
                      Show {group.rows.length} results →
                    </Link>
                  ) : (
                    group.rows.length
                  )}
                </p>
              </header>
            )}
            {collapsed ? null : (
              <ul className="divide-y divide-ink-800/70">
                {group.rows.map((fixture, index) => {
                  const home = club(fixture.home.clubCode, fixture.home.name);
                  const away = club(fixture.away.clubCode, fixture.away.name);
                  const query = new URLSearchParams({
                    ...(season ? { season } : {}),
                    ...(round ? { round } : {}),
                  }).toString();
                  const link = fixture.gameNo
                    ? `/teams/matches/${encodeURIComponent(fixture.gameNo)}${query ? `?${query}` : ""}`
                    : null;
                  const clock = clockLabel(fixture.playedAt);
                  const drawn = fixture.played && fixture.home.sets === fixture.away.sets;

                  return (
                    <li key={fixture.gameNo ?? `fixture-${group.key}-${index}`}>
                      <div className="row-hover relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2">
                        <div className="grid min-w-0 gap-[2px]">
                          <SideLine
                            name={home.name}
                            logo={home.logo}
                            won={fixture.played && fixture.home.won}
                            dim={fixture.played && !fixture.home.won && !drawn}
                          />
                          <SideLine
                            name={away.name}
                            logo={away.logo}
                            won={fixture.played && fixture.away.won}
                            dim={fixture.played && !fixture.away.won && !drawn}
                          />
                        </div>

                        <div className="flex flex-col items-end">
                          <Score
                            value={fixture.played ? fixture.home.sets : null}
                            won={fixture.played && fixture.home.won}
                          />
                          <Score
                            value={fixture.played ? fixture.away.sets : null}
                            won={fixture.played && fixture.away.won}
                          />
                        </div>

                        <div className="w-[58px] shrink-0 text-right">
                          <p className="tnum text-[10px] leading-tight text-fog-550">
                            No {fixture.gameNo ?? "—"}
                          </p>
                          <p className="tnum text-[10px] leading-tight text-fog-600">{clock ?? ""}</p>
                        </div>

                        {link ? (
                          <Link
                            href={link}
                            aria-label={`${home.name} against ${away.name}`}
                            className="absolute inset-0 z-[1] rounded-sm focus-visible:z-[3]"
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

interface FixtureGroup {
  key: string;
  label: string;
  rows: TeamFixture[];
}

/**
 * The days of a round, in the order a reader wants them.
 *
 * Unlike a league table, a 45-fixture round is mostly future: what matters is
 * what is on today and after it. So the days in the future (today first) lead,
 * the played days follow oldest-last, and only then do the finished fixtures
 * collapse into one block — with a control to fold them away entirely.
 *
 * A round with nothing left to play inverts that: the results are the page.
 */
function groupByDay(fixtures: TeamFixture[], today?: string): FixtureGroup[] {
  const played: TeamFixture[] = [];
  const byDay = new Map<string, TeamFixture[]>();
  const undated: TeamFixture[] = [];

  for (const fixture of fixtures) {
    if (fixture.played) {
      played.push(fixture);
      continue;
    }
    const day = stampDay(fixture.playedAt);
    if (!day) {
      undated.push(fixture);
      continue;
    }
    const bucket = byDay.get(day) ?? [];
    bucket.push(fixture);
    byDay.set(day, bucket);
  }

  const FUTURE = today ? [...byDay.keys()].filter((day) => day >= today).sort() : [...byDay.keys()].sort();
  const PAST = today ? [...byDay.keys()].filter((day) => day < today).sort() : [];
  const upcoming = [...FUTURE, ...PAST].map<FixtureGroup>((day) => ({
    key: day,
    label: day === today ? `Today · ${dayLabel(day)}` : dayLabel(day),
    rows: byDay.get(day) ?? [],
  }));

  const playedGroup: FixtureGroup = { key: "played", label: "Played", rows: played };
  const undatedGroup: FixtureGroup = {
    key: "tbd",
    label: "Time to be confirmed",
    rows: undated,
  };

  const groups = played.length > 0 && FUTURE.length > 0
    ? [...upcoming, playedGroup]
    : [...played.length > 0 ? [playedGroup] : [], ...upcoming];

  if (undated.length > 0) groups.push(undatedGroup);
  return groups;
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function Score({ value, won }: { value: number | null | undefined; won: boolean }) {
  return (
    <span
      className={cn(
        "score-cell flex h-[21px] w-[20px] items-center justify-end text-[14px]",
        value === null || value === undefined ? "text-fog-600" : won ? "text-fog-100" : "text-fog-500",
      )}
    >
      {value ?? "–"}
    </span>
  );
}

function SideLine({
  name,
  logo,
  won,
  dim,
}: {
  name: string;
  logo: string | null;
  won: boolean;
  dim: boolean;
}) {
  return (
    <span className="flex h-[21px] min-w-0 items-center gap-2">
      <TeamLogo src={logo} name={name} size="xs" className="!h-[19px] !w-[19px] !rounded-[3px] !p-0.5" />
      <span
        className={cn(
          "min-w-0 truncate text-[12.5px] leading-none",
          won ? "font-semibold text-fog-100" : dim ? "text-fog-550" : "text-fog-200",
        )}
      >
        {name}
      </span>
    </span>
  );
}
