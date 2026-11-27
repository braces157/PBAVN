import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTournamentDetail } from "@/lib/pba/api";
import { getEventMatches, type BracketMatch } from "@/lib/pba/bracket";
import { getEventTeamFixtures, getPlayerNameIndex, resolveKoreanName } from "@/lib/pba/service";
import type { TeamFixture } from "@/lib/pba/team-matches";
import { calendarEvent, calendarEvents, type CalendarEvent } from "@/lib/pba/calendar";
import { getLiveFeed, type LiveMatch } from "@/lib/pba/live";
import { leagueByCode, normalizeEvent, type EventStatus } from "@/lib/normalize";
import type { RawTournamentDetail } from "@/lib/pba/types";
import {
  cleanDisplayText,
  clockLabel,
  dayCount,
  dayKeys,
  dayOfEvent,
  fmtRange,
  hasHangul,
  isPlaceholder,
  kstDay,
  romanizeKoreanName,
  stampDay,
} from "@/lib/format";
import { ArrowRight, ExternalLink, Radio } from "lucide-react";
import { EventCrest } from "@/components/ui/media";
import { Chip, EmptyState, LiveChip, Panel, TabStrip, TextLink, cn } from "@/components/ui/primitives";
import { BracketTree } from "@/components/domain/bracket-tree";
import { FixtureBoard, type FixtureClub } from "@/components/domain/fixture-board";
import { NowNextStrip, LiveIdle, type NextFixture } from "@/components/domain/now-next";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ seq: string }>;
  searchParams: Promise<{ all?: string; tab?: string }>;
}

const TABS = ["fixtures", "bracket", "overview"] as const;
type Tab = (typeof TABS)[number];

const loadDetail = cache((seq: string) => getTournamentDetail(seq));

function detailCalendarEntry(detail: RawTournamentDetail, seq: string): CalendarEvent {
  const { raw: _raw, ...event } = normalizeEvent(detail);
  return { ...event, id: seq, top: detail.TOP_YN === 1 };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seq } = await params;
  const entry = calendarEvent(seq);
  if (!entry) {
    const detail = await loadDetail(seq);
    if (!detail) return { title: "Event not found" };
    const normalized = detailCalendarEntry(detail, seq);
    const title = normalized.title || seq;
    const description = `${title}${normalized.venue !== "—" ? ` — ${normalized.venue}` : ""}. Dates, results, bracket and match cards for the event.`;
    return {
      title,
      description,
      alternates: { canonical: `/schedule/${encodeURIComponent(seq)}` },
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary_large_image", title, description },
    };
  }
  const description = `${entry.title} — ${entry.venue}. Dates, results, bracket and match cards for the event.`;
  return {
    title: entry.title,
    description,
    alternates: { canonical: `/schedule/${encodeURIComponent(seq)}` },
    openGraph: { title: entry.title, description, type: "website" },
    twitter: { card: "summary_large_image", title: entry.title, description },
  };
}

export default async function EventPage({ params, searchParams }: PageProps) {
  const [{ seq }, search] = await Promise.all([params, searchParams]);

  const calendarMatch = calendarEvent(seq);
  const [detail, liveFeedMaybe] = await Promise.all([
    loadDetail(seq),
    calendarMatch?.status === "live" ? getLiveFeed() : Promise.resolve(null),
  ]);
  const entry = calendarMatch ?? (detail ? detailCalendarEntry(detail, seq) : null);
  if (!entry) notFound();

  const showAll = search.all === "1";
  const isTeamLeague = entry.league === "TLG";
  const defaultTab: Tab = isTeamLeague ? "fixtures" : "bracket";
  const tab: Tab =
    search.tab === "overview"
      ? "overview"
      : isTeamLeague && (search.tab === "fixtures" || search.tab === "results")
        ? "fixtures"
        : defaultTab;

  const matchCode = detail && /^\d+$/.test(detail.MATCH_CODE ?? "") ? detail.MATCH_CODE : "";

  const [teamEvent, matches, feed] = await Promise.all([
    isTeamLeague && matchCode
      ? getEventTeamFixtures({ matchCode, seasonCode: entry.season })
      : Promise.resolve(null),
    !isTeamLeague && matchCode
      ? getEventMatches(matchCode, { settled: entry.status === "completed" })
      : Promise.resolve([] as BracketMatch[]),
    liveFeedMaybe
      ? Promise.resolve(liveFeedMaybe)
      : entry.status === "live"
        ? getLiveFeed()
        : Promise.resolve(null),
  ]);

  const liveMatch =
    feed?.matches.find((match) =>
      isTeamLeague
        ? Boolean(match.competition)
        : !match.competition && (!match.circuit || match.circuit === entry.league),
    ) ?? null;

  const sisterLeague = entry.league === "PBA1" ? "LPBA1" : entry.league === "LPBA1" ? "PBA1" : null;
  const sisterEvent =
    sisterLeague && entry.start && entry.end
      ? calendarEvents().find(
          (candidate) =>
            candidate.league === sisterLeague &&
            candidate.season === entry.season &&
            candidate.start &&
            candidate.end &&
            candidate.start <= entry.end! &&
            candidate.end >= entry.start!,
        ) ?? null
      : null;

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
        sisterEvent={sisterEvent}
      />

      <div className="wrap py-5">
        <NowNextStrip
          event={entry}
          live={
            liveMatch ? (
              <LiveBlock match={liveMatch} />
            ) : (
              <LiveIdle
                status={entry.status}
                unavailable={entry.status === "live" && (!feed || !feed.reachable)}
              />
            )
          }
          next={next}
        />

        {!isTeamLeague && tab === "bracket" && matches.length > 0 ? (
          <div className="mt-5">
            <BracketTree
              matches={matches}
              tourCode={matchCode}
              eventSeq={seq}
              league={entry.league}
              entrants={entry.entrants.players}
              livePstCodes={(feed?.matches ?? []).map((m) => m.pstCode).filter(Boolean)}
              initialShowAll={showAll}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_308px]">
            <div className="min-w-0">
              {tab === "overview" ? (
                <OverviewPanel event={entry} facts={facts} days={days} />
              ) : isTeamLeague ? (
                <TeamFixturesPanel
                  seq={seq}
                  showAll={showAll}
                  teamEvent={teamEvent}
                  matchCode={matchCode}
                  today={today}
                />
              ) : (
                <Panel title="Bracket">
                  <EmptyState
                    className="border-0"
                    title={entry.status === "upcoming" ? "Draw not published yet" : "No bracket published"}
                    description={
                      entry.status === "upcoming"
                        ? "Match brackets appear here as soon as the draw opens and scoring begins."
                        : "No bracket records were found under this event code."
                    }
                  />
                </Panel>
              )}
            </div>

            <aside className="space-y-4">
              <EventQuickFacts event={entry} days={days} />
              <DaysPanel entry={entry} keys={keys} today={today} />
              <SiblingsPanel entry={entry} />
            </aside>
          </div>
        )}
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
  sisterEvent,
}: {
  entry: CalendarEvent;
  seq: string;
  tab: Tab;
  matchCount: number;
  bracketCount: number;
  today: string;
  keys: string[];
  sisterEvent: CalendarEvent | null;
}) {
  const league = leagueByCode(entry.league);
  const days = dayCount(entry.start, entry.end);
  const dayNumber = keys.includes(today) ? keys.indexOf(today) + 1 : null;

  return (
    <header className="border-b border-border bg-card">
      <div className="wrap">
        <nav className="flex flex-wrap items-center gap-1.5 py-3 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/schedule" className="transition-colors hover:text-foreground">
            Schedule
          </Link>
          <Separator />
          <Link
            href={`/schedule?league=${entry.league}`}
            className="transition-colors hover:text-foreground"
          >
            {league.name}
          </Link>
          <Separator />
          <Link
            href={`/schedule?season=${entry.season}&league=${entry.league}`}
            className="transition-colors hover:text-foreground"
          >
            {entry.season}–{Number(entry.season) + 1}
          </Link>
          <Separator />
          <span className="max-w-[260px] truncate text-foreground">{entry.title}</span>
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
              {days && <span className="text-xs text-muted-foreground">{days}-day event</span>}
            </div>
            <h1 className="mt-1.5 max-w-3xl text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {entry.title}
            </h1>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {fmtRange(entry.start, entry.end)}
              <span className="mx-1.5 text-border">·</span>
              <span className="font-sans">{entry.venue}</span>
              {entry.sponsor !== "—" && (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  <span className="font-sans">Presented by {entry.sponsor}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
            {sisterEvent && (
              <Link
                href={`/schedule/${sisterEvent.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
              >
                {sisterEvent.league === "LPBA1" ? "LPBA sister event" : "PBA sister event"}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </Link>
            )}
            {entry.guideUrl && (
              <a
                href={entry.guideUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:no-underline"
              >
                Event guide
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
            <a
              href="https://www.pbatour.org/en/tournament/schedule/index"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
            >
              pbatour.org
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </a>
          </div>
        </div>

        <TabStrip
          items={[
            entry.league === "TLG"
              ? {
                  href: `/schedule/${seq}`,
                  label: "Fixtures",
                  active: tab === "fixtures",
                  count: matchCount || undefined,
                }
              : {
                  href: `/schedule/${seq}`,
                  label: "Bracket",
                  active: tab === "bracket",
                  count: bracketCount || undefined,
                },
            { href: `/schedule/${seq}?tab=overview`, label: "Overview", active: tab === "overview" },
          ]}
        />
      </div>
    </header>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-border">
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

function TeamFixturesPanel({
  seq,
  showAll,
  teamEvent,
  matchCode,
  today,
}: {
  seq: string;
  showAll: boolean;
  teamEvent: Awaited<ReturnType<typeof getEventTeamFixtures>>;
  matchCode: string;
  today: string;
}) {
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

function EventQuickFacts({ event, days }: { event: CalendarEvent; days: number | null }) {
  const rows = [
    { label: "Prize pool", value: event.prizePool },
    { label: "Defending champ", value: event.defendingChampion },
    { label: "Duration", value: days ? `${days} days` : "—" },
    { label: "Season", value: `${event.season}–${Number(event.season) + 1}` },
  ].filter((row) => row.value && row.value !== "—");

  if (rows.length === 0) return null;

  return (
    <Panel title="Event info">
      <dl className="divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-mono text-xs font-medium tabular-nums text-foreground">{row.value}</dd>
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
      <ul className="divide-y divide-border/60">
        {keys.map((key) => {
          const index = dayOfEvent(key, entry.start, entry.end) ?? 0;
          const isToday = key === today;
          return (
            <li
              key={key}
              className={cn(
                "flex items-center justify-between gap-2 px-4 py-2 text-xs",
                isToday && "bg-secondary/70",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className="w-4 text-right font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {index}
                </span>
                <span className={cn("font-mono tabular-nums", isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {keyLabel(key)}
                </span>
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
        <p className="px-4 py-3 text-xs text-muted-foreground">No other published events on this circuit.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {nearby.map((sibling) => (
            <li key={sibling.id}>
              <Link
                href={`/schedule/${sibling.id}`}
                className="block px-4 py-2.5 transition-colors hover:bg-accent/50 hover:no-underline"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-[13px] font-medium leading-snug text-foreground">
                    {sibling.title}
                  </span>
                  {sibling.status === "live" ? (
                    <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" aria-label="Live" />
                  ) : null}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground">
                  {fmtRange(sibling.start, sibling.end)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border px-4 py-2.5">
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
    { label: "Season", value: `${event.season}–${Number(event.season) + 1}` },
    { label: "Venue", value: event.venue },
    { label: "Dates", value: fmtRange(event.start, event.end) },
    { label: "Duration", value: days ? `${days} days` : "—" },
    { label: "Presenter", value: event.sponsor },
    { label: "Prize pool", value: event.prizePool },
    ...facts,
  ].filter((row) => row.value && row.value !== "—");

  return (
    <Panel title="Event specifications">
      <dl className="divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6 px-4 py-3">
            <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-right text-sm font-medium leading-snug text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function LiveBlock({ match }: { match: LiveMatch }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-rose-500">
        <Radio className="h-3.5 w-3.5" aria-hidden="true" />
        On table now
      </p>
      <ol className="mt-2 space-y-1">
        {match.sides.map((side, index) => (
          <li key={`${side.name}-${index}`} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">{side.name}</span>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-rose-500">{side.points}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
        Set {match.latestSet.setNo}
        {match.latestSet.target !== null ? ` · race to ${match.latestSet.target}` : ""} ·{" "}
        {match.sides[0]?.setsWon ?? 0}–{match.sides[1]?.setsWon ?? 0} in sets
      </p>
      {match.competition || !match.pstCode ? null : (
        <Link
          href={`/matches/${match.pstCode}?live=1`}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-muted-foreground hover:no-underline"
        >
          Open live card
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function buildFacts(detail: Awaited<ReturnType<typeof getTournamentDetail>>) {
  if (!detail) return [];
  const nameIndex = getPlayerNameIndex();
  const rawWinner = cleanDisplayText(detail.PREV_WINNER_NAME_EN || detail.PREV_WINNER_NAME);
  const winner =
    rawWinner && !isPlaceholder(rawWinner)
      ? hasHangul(rawWinner)
        ? resolveKoreanName(rawWinner, nameIndex) || romanizeKoreanName(rawWinner)
        : rawWinner
      : "";
  return [
    { label: "Table", value: cleanDisplayText(detail.TABLE_MODEL) },
    { label: "Ball", value: cleanDisplayText(detail.BALL_MODEL) },
    { label: "Cloth", value: cleanDisplayText(detail.CLOTH_MODEL) },
    { label: "Broadcast", value: cleanDisplayText(detail.BROADCAST_EN || detail.BROADCAST) },
    { label: "Champion prize", value: cleanDisplayText(detail.WINNING_PRIZE_EN || detail.WINNING_PRIZE) },
    { label: "Defending champion", value: winner },
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
