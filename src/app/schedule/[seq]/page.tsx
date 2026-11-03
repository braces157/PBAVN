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
import { clockLabel, dayCount, dayKeys, dayOfEvent, fmtRange, isoDay, isPlaceholder, kstDay, stampDay } from "@/lib/format";
import { eventArtUrl } from "@/lib/event-art";
import { EventCrest } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, Panel, TabStrip, TextLink, cn } from "@/components/ui/primitives";
import { BracketView } from "@/components/domain/bracket-view";
import { FixtureBoard, type FixtureClub } from "@/components/domain/fixture-board";
import { NowNextStrip, LiveIdle, type NextFixture } from "@/components/domain/now-next";

/** A drawn event settles within the hour; the calendar itself is pre-shared. */
export const revalidate = 300;

interface PageProps {
  params: Promise<{ seq: string }>;
  searchParams: Promise<{ all?: string; tab?: string }>;
}

const TABS = ["results", "bracket", "overview"] as const;
type Tab = (typeof TABS)[number];

/** Deepest rounds shown before "show every round". */
const ROUND_PREVIEW = 5;

/** A calendar entry rebuilt from the live detail feed, for events the built
 * calendar does not carry yet. */
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

  // The feed still owns the fields that move during a tournament: the match
  // code, the winner, the broadcast list. The calendar supplies the identity.
  const detail = await getTournamentDetail(seq);

  // The live board links events the built calendar has not picked up yet, and
  // the detail feed answers for them; without this fallback those links 404
  // until the next calendar rebuild ships.
  const entry = calendarEvent(seq) ?? (detail ? detailCalendarEntry(detail, seq) : null);
  if (!entry) notFound();

  const showAll = search.all === "1";
  const tab: Tab = TABS.includes(search.tab as Tab) ? (search.tab as Tab) : "results";
  const league = leagueByCode(entry.league);
  const isTeamLeague = entry.league === "TLG";

  const matchCode = detail && /^\d+$/.test(detail.MATCH_CODE ?? "") ? detail.MATCH_CODE : "";

  const teamEvent =
    isTeamLeague && matchCode
      ? await getEventTeamFixtures({ matchCode, seasonCode: entry.season })
      : null;

  const matches = !isTeamLeague && matchCode ? await getEventMatches(matchCode) : [];

  // The wire only covers what is on now; a finished event has no table to
  // report, so it is not asked for.
  const feed = entry.status === "live" ? await getLiveFeed() : null;
  // A fixture from the other terminal cannot belong to this event, so the live
  // block only takes matches from the terminal this event runs on.
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

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10">
        <NowNextStrip
          event={entry}
          live={liveMatch ? <LiveBlock match={liveMatch} /> : <LiveIdle />}
          next={next}
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_318px] lg:gap-6">
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
            <DaysPanel entry={entry} keys={keys} today={today} />
            <SiblingsPanel entry={entry} />
            <Panel title="Where the numbers come from">
              <ul className="space-y-1.5 px-3 py-2.5 text-[11.5px] leading-relaxed text-fog-500">
                <li>Dates, venue and prize money — the schedule feed.</li>
                <li>
                  {isTeamLeague ? "Fixtures and club scores" : "Match cards and set scores"} — the
                  association's scoring terminal.
                </li>
                <li>Live state — the scoreboard wire, read at request time.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ header */

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
    <header className="border-b border-ink-800 bg-ink-950">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <nav className="flex flex-wrap items-center gap-1.5 py-2.5 text-[11px] text-fog-600" aria-label="Breadcrumb">
          <Link href="/schedule" className="transition-colors hover:text-fog-300">
            Schedule
          </Link>
          <Separator />
          <Link
            href={`/schedule?league=${entry.league}&season=${entry.season}`}
            className="transition-colors hover:text-fog-300"
          >
            {league.name}
          </Link>
          <Separator />
          <Link
            href={`/schedule?season=${entry.season}&league=${entry.league}`}
            className="transition-colors hover:text-fog-300"
          >
            {entry.season}
          </Link>
          <Separator />
          <span className="max-w-[240px] truncate text-fog-450">{entry.title}</span>
        </nav>

        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 pb-4 pt-0.5">
          <EventCrest
            src={entry.logo}
            name={entry.sponsor !== "—" ? entry.sponsor : entry.title}
            league={entry.league}
            size="lg"
          />
          {/* `min-w-0 basis-full` on a phone: the title gets the full width and
              wraps on word boundaries instead of being squeezed into the few
              pixels left beside the crest. */}
          <div className="min-w-0 flex-1 basis-full sm:basis-[320px]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={entry.status} dayNumber={dayNumber} />
              <Chip tone={league.tone}>{league.name}</Chip>
              {days && <span className="text-[11px] text-fog-550">{days}-day event</span>}
            </div>
            <h1 className="display-sm mt-1.5 max-w-3xl text-balance text-fog-100">{entry.title}</h1>
            <p className="tnum mt-1 text-[12.5px] text-fog-450">
              {fmtRange(entry.start, entry.end)}
              <span className="mx-1.5 text-ink-500">·</span>
              {entry.venue}
              {entry.sponsor !== "—" && (
                <>
                  <span className="mx-1.5 text-ink-500">·</span>
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
                className="press inline-flex items-center gap-1.5 rounded-md bg-lime-400 px-3 py-1.5 text-[12px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
              >
                Event guide ↗
              </a>
            )}
            <a
              href="https://www.pbatour.org/en/tournament/schedule/index"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-1.5 text-[12px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
            >
              On pbatour.org ↗
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
    <span aria-hidden="true" className="text-ink-500">
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
      <Chip tone="lime" className="tracking-[0.1em]">
        Upcoming
      </Chip>
    );
  }
  return (
    <Chip tone="neutral" className="tracking-[0.1em]">
      Completed
    </Chip>
  );
}

/* ------------------------------------------------------------------ panels */

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
                : "This round's fixtures appear here as soon as the association publishes them."
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
        meta={`${fixtures.length} · ${played} played · ${fixtures.length - played} to play`}
        stickyHead
        action={
          <Link
            href={`/teams/matches?season=${encodeURIComponent(seasonCode)}&round=${round.라운드코드}`}
            className="text-[11.5px] font-semibold text-fog-300 transition-colors hover:text-lime-300"
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
          // A round is 45 fixtures; the page opens on today and the days after
          // it, and the played history is one click away rather than 15 rows of
          // scroll before the reader reaches what is on now.
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
          title={entry.status === "upcoming" ? "The draw is not out yet" : "No match cards published"}
          description={
            entry.status === "upcoming"
              ? "Match cards appear here as soon as the draw is made and the first match is scored."
              : "The scoring terminal has no bracket under this event's match code."
          }
        />
      </Panel>
    );
  }

  // A draw is 30 rounds deep on 128 players. The card is useful for the final
  // and the semi-finals; the bracket tab is where the whole tree is read.
  const shown = showAll ? matches : matches.slice(0, ROUND_PREVIEW);
  const hidden = matches.length - shown.length;
  const moreHref = `/schedule/${seq}?all=1`;

  return (
    <>
      {hidden > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-ink-750 bg-ink-900 px-3 py-2.5">
          <p className="text-[12px] text-fog-400">
            Showing the <span className="font-semibold text-fog-200">closing {shown.length} matches</span> of{" "}
            {matches.length}. The full tree lives on the bracket tab.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={moreHref}
              className="rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
            >
              Every round
            </Link>
            <Link
              href={`/schedule/${seq}?tab=bracket`}
              className="rounded-md border border-ink-700 px-2.5 py-1 text-[11.5px] font-medium text-fog-300 transition-colors hover:border-ink-500 hover:text-fog-100"
            >
              Bracket
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
                "flex items-center justify-between gap-2 px-3 py-[7px] text-[12px]",
                isToday && "bg-lime-400/[0.06]",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="tnum w-4 text-right font-display text-[11px] font-bold text-fog-600">
                  {index}
                </span>
                <span className={cn("tnum", isToday ? "text-fog-100" : "text-fog-300")}>{keyLabel(key)}</span>
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
        <p className="px-3 py-3 text-[11.5px] text-fog-500">No other published events on this circuit.</p>
      ) : (
        <ul className="divide-y divide-ink-800/70">
          {nearby.map((sibling) => (
            <li key={sibling.id}>
              <Link href={`/schedule/${sibling.id}`} className="row-hover block px-3 py-2">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-[12px] font-medium leading-snug text-fog-200">
                    {sibling.title}
                  </span>
                  {sibling.status === "live" ? (
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-live-500" aria-label="Live" />
                  ) : null}
                </span>
                <span className="tnum mt-0.5 block text-[10.5px] text-fog-600">
                  {fmtRange(sibling.start, sibling.end)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-ink-800 px-3 py-2">
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
    <Panel title="Event facts">
      <dl className="divide-y divide-ink-800/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6 px-3 py-2">
            <dt className="micro-label shrink-0">{row.label}</dt>
            <dd className="text-right text-[12.5px] leading-snug text-fog-200">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function LiveBlock({ match }: { match: LiveMatch }) {
  return (
    <div className="bg-ink-900 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-live-400">
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
        On table now
      </p>
      <ol className="mt-2 space-y-1">
        {match.sides.map((side, index) => (
          <li key={`${side.name}-${index}`} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] font-semibold text-fog-100">{side.name}</span>
            <span className="tnum shrink-0 text-[13px] font-bold text-live-400">{side.points}</span>
          </li>
        ))}
      </ol>
      <p className="tnum mt-1.5 text-[11px] leading-snug text-fog-500">
        Set {match.latestSet.setNo}
        {match.latestSet.target !== null ? ` · race to ${match.latestSet.target}` : ""} ·{" "}
        {match.sides[0]?.setsWon ?? 0}–{match.sides[1]?.setsWon ?? 0} in sets
      </p>
      {/* A team-league match has no scoring-terminal pstCode, so there is no
          card to open. */}
      {match.competition || !match.pstCode ? null : (
        <Link
          href={`/matches/${match.pstCode}?live=1`}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-fog-300 transition-colors hover:text-lime-300"
        >
          Open live card <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

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

/** The next fixture still to be played, from either feed. */
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

  // A bracket row with no set count on either side is a match drawn but not
  // yet played; the feed sorts the current round first.
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

/** "Today 18:30" / "Tomorrow 18:30" / "Thu 18:30" from a local stamp. */
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
