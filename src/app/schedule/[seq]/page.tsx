import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentDetail } from "@/lib/pba/api";
import { getEventMatches, type BracketMatch } from "@/lib/pba/bracket";
import { getEventTeamFixtures } from "@/lib/pba/service";
import type { TeamFixture } from "@/lib/pba/team-matches";
import { calendarEvent, calendarEvents, type CalendarEvent } from "@/lib/pba/calendar";
import { getLiveFeed, type LiveMatch } from "@/lib/pba/live";
import { leagueByCode, normalizeEvent, type EventStatus } from "@/lib/normalize";
import type { RawTournamentDetail } from "@/lib/pba/types";
import { clockLabel, dayCount, dayKeys, dayOfEvent, fmtRange, isPlaceholder, kstDay, stampDay } from "@/lib/format";
import { EventCrest } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, Panel, TabStrip, TextLink, cn } from "@/components/ui/primitives";
import { BracketView } from "@/components/domain/bracket-view";
import { FixtureBoard, type FixtureClub } from "@/components/domain/fixture-board";
import { NowNextStrip, LiveIdle, type NextFixture } from "@/components/domain/now-next";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ seq: string }>;
  searchParams: Promise<{ all?: string; tab?: string }>;
}

const TABS = ["results", "bracket", "overview"] as const;
type Tab = (typeof TABS)[number];

const ROUND_PREVIEW = 5;

function detailCalendarEntry(detail: RawTournamentDetail, seq: string): CalendarEvent {
  const { raw: _raw, ...event } = normalizeEvent(detail);
  return { ...event, id: seq, top: detail.TOP_YN === 1 };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seq } = await params;
  const entry = calendarEvent(seq);
  if (!entry) {
    const detail = await getTournamentDetail(seq);
    if (!detail) return { title: "Event not found" };
    const title = detail.TITLE_EN || detail.TITLE || seq;
    return {
      title,
      description: `${title} — ${detail.PLACE_EN || detail.PLACE}. Dates, results, bracket and match cards for the event.`,
    };
  }
  return {
    title: entry.title,
    description: `${entry.title} — ${entry.venue}. Dates, results, bracket and match cards for the event.`,
  };
}

export default async function EventPage({ params, searchParams }: PageProps) {
  const [{ seq }, search] = await Promise.all([params, searchParams]);

  const detail = await getTournamentDetail(seq);
  const entry = calendarEvent(seq) ?? (detail ? detailCalendarEntry(detail, seq) : null);
  if (!entry) notFound();

  const showAll = search.all === "1";
  const tab: Tab = TABS.includes(search.tab as Tab) ? (search.tab as Tab) : "results";
  const isTeamLeague = entry.league === "TLG";

  const matchCode = detail && /^\d+$/.test(detail.MATCH_CODE ?? "") ? detail.MATCH_CODE : "";

  const teamEvent =
    isTeamLeague && matchCode
      ? await getEventTeamFixtures({ matchCode, seasonCode: entry.season })
      : null;

  const matches = !isTeamLeague && matchCode ? await getEventMatches(matchCode) : [];

  const feed = entry.status === "live" ? await getLiveFeed() : null;
  const liveMatch =
    feed?.matches.find((match) => (isTeamLeague ? match.competition : !match.competition)) ?? null;

  const fixtures = teamEvent?.fixtures ?? [];
  const days = dayCount(entry.start, entry.end);
  const keys = dayKeys(entry.start, entry.end);
  const today = kstDay();

  const next = nextUp({
    fixtures,
    matches,
    seasonCode: teamEvent?.seasonCode,
    round: teamEvent ? String(teamEvent.round.라운드코드) : undefined,
  });
  const facts = buildFacts(detail);

  return (
    <>
      <EventHeader
        entry={entry}
        seq={seq}
        tab={tab}
        matchCount={matches.length || fixtures.length}
        bracketCount={matches.length}
        today={today}
        keys={keys}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <NowNextStrip
          event={entry}
          live={
            liveMatch ? (
              <LiveBlock match={liveMatch} />
            ) : (
              <LiveIdle unavailable={entry.status === "live" && (!feed || !feed.reachable)} />
            )
          }
          next={next}
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_308px]">
          <div className="min-w-0">
            {tab === "overview" ? (
              <OverviewPanel event={entry} facts={facts} days={days} />
            ) : tab === "bracket" && matches.length > 0 ? (
              <Panel title="Bracket" meta={`${matches.length} matches`} stickyHead>
                <BracketView matches={matches} tourCode={matchCode} eventSeq={seq} />
              </Panel>
            ) : (
              <ResultsPanel
                entry={entry}
                seq={seq}
                showAll={showAll}
                teamEvent={teamEvent}
                matches={matches}
                matchCode={matchCode}
                today={today}
              />
            )}
          </div>

          <aside className="space-y-4">
            <EventQuickFacts event={entry} days={days} />
            <DaysPanel entry={entry} keys={keys} today={today} />
            <SiblingsPanel entry={entry} />
          </aside>
        </div>
      </div>
    </>
  );
}

function EventHeader({
  entry,
  seq,
  tab,
  matchCount,
  bracketCount,
  today,
  keys,
}: {
  entry: CalendarEvent;
  seq: string;
  tab: Tab;
  matchCount: number;
  bracketCount: number;
  today: string;
  keys: string[];
}) {
  const league = leagueByCode(entry.league);
  const days = dayCount(entry.start, entry.end);
  const dayNumber = keys.includes(today) ? keys.indexOf(today) + 1 : null;

  return (
    <header className="border-b border-ink-800 bg-ink-900/60">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-1.5 py-2.5 text-[11px] text-fog-500" aria-label="Breadcrumb">
          <Link href="/schedule" className="transition-colors hover:text-carom-300">
            Schedule
          </Link>
          <Separator />
          <Link
            href={`/schedule?league=${entry.league}&season=${entry.season}`}
            className="transition-colors hover:text-carom-300"
          >
            {league.name}
          </Link>
          <Separator />
          <Link
            href={`/schedule?season=${entry.season}&league=${entry.league}`}
            className="transition-colors hover:text-carom-300"
          >
            {entry.season}
          </Link>
          <Separator />
          <span className="max-w-[260px] truncate text-fog-300">{entry.title}</span>
        </nav>

        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 pb-4 pt-1">
          <EventCrest
            src={entry.logo}
            name={entry.sponsor !== "—" ? entry.sponsor : entry.title}
            league={entry.league}
            size="lg"
          />
          <div className="min-w-0 flex-1 basis-full sm:basis-[320px]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={entry.status} dayNumber={dayNumber} />
              <Chip tone={league.tone}>{league.name}</Chip>
              {days && <span className="text-[11px] text-fog-500">{days}-day event</span>}
            </div>
            <h1 className="display-sm mt-1.5 max-w-3xl text-balance text-fog-100">{entry.title}</h1>
            <p className="tnum mt-1 text-[12px] text-fog-400">
              {fmtRange(entry.start, entry.end)}
              <span className="mx-1.5 text-ink-600">·</span>
              {entry.venue}
              {entry.sponsor !== "—" && (
                <>
                  <span className="mx-1.5 text-ink-600">·</span>
                  Presented by {entry.sponsor}
                </>
              )}
            </p>
          </div>

          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            {entry.guideUrl && (
              <a
                href={entry.guideUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="press inline-flex items-center gap-1 bg-[var(--ink)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--paper)] transition-colors hover:bg-[var(--red)] hover:text-white"
              >
                Event guide ↗
              </a>
            )}
            <a
              href="https://www.pbatour.org/en/tournament/schedule/index"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-[12px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
            >
              pbatour.org ↗
            </a>
          </div>
        </div>

        <TabStrip
          items={[
            {
              href: `/schedule/${seq}`,
              label: "Results",
              active: tab === "results",
              count: matchCount || undefined,
            },
            ...(bracketCount > 0
              ? [{ href: `/schedule/${seq}?tab=bracket`, label: "Bracket", active: tab === "bracket" }]
              : []),
            { href: `/schedule/${seq}?tab=overview`, label: "Overview", active: tab === "overview" },
          ]}
        />
      </div>
    </header>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-ink-600">
      /
    </span>
  );
}

function StatusChip({ status, dayNumber }: { status: EventStatus; dayNumber: number | null }) {
  if (status === "live") {
    return <LiveChip label={dayNumber ? `Live · day ${dayNumber}` : "In progress"} />;
  }
  if (status === "upcoming") {
    return (
      <Chip tone="carom" className="tracking-[0.08em]">
        Upcoming
      </Chip>
    );
  }
  return (
    <Chip tone="neutral" className="tracking-[0.08em]">
      Completed
    </Chip>
  );
}

function ResultsPanel({
  entry,
  seq,
  showAll,
  teamEvent,
  matches,
  matchCode,
  today,
}: {
  entry: CalendarEvent;
  seq: string;
  showAll: boolean;
  teamEvent: Awaited<ReturnType<typeof getEventTeamFixtures>>;
  matches: BracketMatch[];
  matchCode: string;
  today: string;
}) {
  if (entry.league === "TLG") {
    if (!teamEvent || teamEvent.fixtures.length === 0) {
      return (
        <Panel title="Fixtures" meta="0">
          <EmptyState
            className="border-0"
            title="Fixtures not published yet"
            description={
              matchCode
                ? "The team-league terminal has no fixture list for this round."
                : "This round's fixtures appear here once published."
            }
          />
        </Panel>
      );
    }

    const { fixtures, clubs, seasonCode, round } = teamEvent;
    const played = fixtures.filter((fixture) => fixture.played).length;

    return (
      <Panel
        title="Round fixtures"
        meta={`${fixtures.length} · ${played} played · ${fixtures.length - played} upcoming`}
        stickyHead
        action={
          <Link
            href={`/teams/matches?season=${encodeURIComponent(seasonCode)}&round=${round.라운드코드}`}
            className="text-[11.5px] font-semibold text-carom-300 transition-colors hover:text-carom-400"
          >
            Team League view →
          </Link>
        }
      >
        <FixtureBoard
          fixtures={fixtures}
          clubs={new Map<string, FixtureClub>(clubs)}
          season={seasonCode}
          round={String(round.라운드코드)}
          today={today}
          playedOpen={showAll}
          playedHref={`/schedule/${seq}?all=1`}
        />
      </Panel>
    );
  }

  if (matches.length === 0) {
    return (
      <Panel title="Matches">
        <EmptyState
          className="border-0"
          title={entry.status === "upcoming" ? "Draw not published yet" : "No match cards published"}
          description={
            entry.status === "upcoming"
              ? "Match cards appear here as soon as the draw opens and scoring begins."
              : "No bracket records were found under this event code."
          }
        />
      </Panel>
    );
  }

  const shown = showAll ? matches : matches.slice(0, ROUND_PREVIEW);
  const hidden = matches.length - shown.length;
  const moreHref = `/schedule/${seq}?all=1`;

  return (
    <>
      {hidden > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-ink-750 bg-ink-900 px-3.5 py-2.5">
          <p className="text-[12px] text-fog-400">
            Showing the <span className="font-semibold text-fog-100">closing {shown.length} matches</span> of{" "}
            {matches.length}.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={moreHref}
              className="rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
            >
              Show all rounds
            </Link>
            <Link
              href={`/schedule/${seq}?tab=bracket`}
              className="rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:border-carom-400/50 hover:text-carom-300"
            >
              Full bracket
            </Link>
          </div>
        </div>
      )}
      <Panel title="Results" meta={`${matches.length} matches`} stickyHead>
        <BracketView matches={shown} tourCode={matchCode} eventSeq={seq} />
      </Panel>
    </>
  );
}

function EventQuickFacts({ event, days }: { event: CalendarEvent; days: number | null }) {
  const rows = [
    { label: "Prize pool", value: event.prizePool },
    { label: "Defending champ", value: event.defendingChampion },
    { label: "Duration", value: days ? `${days} days` : "—" },
    { label: "Season", value: `${event.season}-${Number(event.season) + 1}` },
  ].filter((row) => row.value && row.value !== "—");

  if (rows.length === 0) return null;

  return (
    <Panel title="Event info">
      <dl className="divide-y divide-ink-800/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 px-3.5 py-2">
            <dt className="micro-label shrink-0">{row.label}</dt>
            <dd className="tnum text-right text-[12px] font-medium text-fog-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function DaysPanel({ entry, keys, today }: { entry: CalendarEvent; keys: string[]; today: string }) {
  if (keys.length === 0) return null;
  return (
    <Panel title="Competition days" meta={String(keys.length)}>
      <ul className="divide-y divide-ink-800/70">
        {keys.map((key) => {
          const index = dayOfEvent(key, entry.start, entry.end) ?? 0;
          const isToday = key === today;
          return (
            <li
              key={key}
              className={cn(
                "flex items-center justify-between gap-2 px-3.5 py-2 text-[12px]",
                isToday && "bg-carom-400/[0.08]",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className="tnum w-4 text-right font-display text-[11px] font-bold text-fog-550">
                  {index}
                </span>
                <span className={cn("tnum", isToday ? "font-semibold text-fog-100" : "text-fog-300")}>{keyLabel(key)}</span>
              </span>
              {isToday && <LiveChip label="Today" />}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function SiblingsPanel({ entry }: { entry: CalendarEvent }) {
  const league = leagueByCode(entry.league);
  const target = entry.start?.getTime() ?? 0;
  const nearby = calendarEvents()
    .filter((event) => event.season === entry.season && event.league === entry.league && event.id !== entry.id)
    .sort((a, b) => {
      const at = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return Math.abs(at - target) - Math.abs(bt - target);
    })
    .slice(0, 5);

  return (
    <Panel title="Around this event">
      {nearby.length === 0 ? (
        <p className="px-3.5 py-3 text-[12px] text-fog-500">No other published events on this circuit.</p>
      ) : (
        <ul className="divide-y divide-ink-800/70">
          {nearby.map((sibling) => (
            <li key={sibling.id}>
              <Link href={`/schedule/${sibling.id}`} className="row-hover block px-3.5 py-2.5">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-[12px] font-medium leading-snug text-fog-100">
                    {sibling.title}
                  </span>
                  {sibling.status === "live" ? (
                    <span className="live-dot mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-live-500" aria-label="Live" />
                  ) : null}
                </span>
                <span className="tnum mt-0.5 block text-[10.5px] text-fog-550">
                  {fmtRange(sibling.start, sibling.end)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-ink-800 px-3.5 py-2.5">
        <TextLink href={`/schedule?season=${entry.season}&league=${entry.league}`}>
          All {league.name} events
        </TextLink>
      </div>
    </Panel>
  );
}

function OverviewPanel({
  event,
  facts,
  days,
}: {
  event: CalendarEvent;
  facts: { label: string; value: string }[];
  days: number | null;
}) {
  const rows = [
    { label: "Circuit", value: leagueByCode(event.league).name },
    { label: "Season", value: event.season },
    { label: "Venue", value: event.venue },
    { label: "Dates", value: fmtRange(event.start, event.end) },
    { label: "Duration", value: days ? `${days} days` : "—" },
    { label: "Presenter", value: event.sponsor },
    { label: "Prize pool", value: event.prizePool },
    ...facts,
  ].filter((row) => row.value && row.value !== "—");

  return (
    <Panel title="Event specifications">
      <dl className="divide-y divide-ink-800/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6 px-4 py-2.5">
            <dt className="micro-label shrink-0">{row.label}</dt>
            <dd className="text-right text-[13px] leading-snug text-fog-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function LiveBlock({ match }: { match: LiveMatch }) {
  return (
    <div className="bg-ink-900 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-live-400">
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
        On table now
      </p>
      <ol className="mt-2 space-y-1">
        {match.sides.map((side, index) => (
          <li key={`${side.name}-${index}`} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] font-semibold text-fog-100">{side.name}</span>
            <span className="tnum shrink-0 text-[13.5px] font-bold text-live-400">{side.points}</span>
          </li>
        ))}
      </ol>
      <p className="tnum mt-1.5 text-[11px] leading-snug text-fog-450">
        Set {match.latestSet.setNo}
        {match.latestSet.target !== null ? ` · race to ${match.latestSet.target}` : ""} ·{" "}
        {match.sides[0]?.setsWon ?? 0}–{match.sides[1]?.setsWon ?? 0} in sets
      </p>
      {match.competition || !match.pstCode ? null : (
        <Link
          href={`/matches/${match.pstCode}?live=1`}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-carom-300 transition-colors hover:text-carom-400"
        >
          Open live card →
        </Link>
      )}
    </div>
  );
}

function buildFacts(detail: Awaited<ReturnType<typeof getTournamentDetail>>) {
  if (!detail) return [];
  return [
    { label: "Table", value: detail.TABLE_MODEL ?? "" },
    { label: "Ball", value: detail.BALL_MODEL ?? "" },
    { label: "Cloth", value: detail.CLOTH_MODEL ?? "" },
    { label: "Broadcast", value: detail.BROADCAST_EN || detail.BROADCAST || "" },
    { label: "Champion prize", value: detail.WINNING_PRIZE_EN || detail.WINNING_PRIZE || "" },
    { label: "Defending champion", value: detail.PREV_WINNER_NAME_EN || detail.PREV_WINNER_NAME || "" },
  ].filter((row) => row.value && !isPlaceholder(row.value));
}

function nextUp({
  fixtures,
  matches,
  seasonCode,
  round,
}: {
  fixtures: TeamFixture[];
  matches: BracketMatch[];
  seasonCode?: string;
  round?: string;
}): NextFixture | null {
  const pending = fixtures
    .filter((fixture) => !fixture.played)
    .sort((a, b) => (a.playedAt ?? "9999").localeCompare(b.playedAt ?? "9999"));
  const fixture = pending[0];
  if (fixture) {
    const query = new URLSearchParams({
      ...(seasonCode ? { season: seasonCode } : {}),
      ...(round ? { round } : {}),
    }).toString();
    return {
      home: fixture.home.name,
      away: fixture.away.name,
      at: fixture.playedAt,
      label: distanceLabel(fixture.playedAt),
      href: fixture.gameNo
        ? `/teams/matches/${fixture.gameNo}${query ? `?${query}` : ""}`
        : null,
    };
  }

  const drawn = matches.find((match) =>
    match.sides.every((side) => side.sets === null || side.sets === undefined),
  );
  if (!drawn) return null;
  return {
    home: drawn.sides[0]?.name ?? "TBD",
    away: drawn.sides[1]?.name ?? "TBD",
    at: drawn.scheduledAt,
    label: distanceLabel(drawn.scheduledAt),
    href: null,
  };
}

function distanceLabel(stamp: string | null): string {
  const clock = clockLabel(stamp);
  const day = stampDay(stamp);
  if (!day) return "Time to be confirmed";
  const today = kstDay();
  if (!today) return clock ?? "Scheduled";
  if (day === today) return clock ? `Today ${clock}` : "Today";
  const diff = Math.round(
    (new Date(`${day}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  );
  if (diff === 1) return clock ? `Tomorrow ${clock}` : "Tomorrow";
  if (diff < 0) return clock ? `Played ${clock}` : "Played";
  const date = new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return clock ? `${date} ${clock}` : date;
}

function keyLabel(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
