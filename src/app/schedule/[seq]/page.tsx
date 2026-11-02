import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentDetail, getTournaments } from "@/lib/pba/api";
import { normalizeEvent, leagueByCode } from "@/lib/normalize";
import { fmtRange, dayCount, daysUntil, isPlaceholder } from "@/lib/format";
import { EventLogo } from "@/components/ui/media";
import { Chip, EmptyState, KeyValue, StatusPill, TextLink } from "@/components/ui/primitives";
import { EventRow } from "@/components/domain/event-card";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ seq: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seq } = await params;
  const detail = await getTournamentDetail(seq);
  if (!detail) return { title: "Event not found" };
  return {
    title: detail.TITLE_EN || detail.TITLE,
    description: `${detail.TITLE_EN || detail.TITLE} — ${detail.PLACE_EN || detail.PLACE}. Dates, venue, prize money and broadcast details.`,
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const { seq } = await params;
  const detail = await getTournamentDetail(seq);
  if (!detail) notFound();

  const event = normalizeEvent(detail);
  const league = leagueByCode(event.league);
  const days = dayCount(event.start, event.end);
  const until = daysUntil(event.start);

  // Neighbouring events on the same circuit, to keep people moving.
  const siblings = (await getTournaments({ season: event.season, leagueCode: event.league }))
    .map(normalizeEvent)
    .filter((item) => item.id !== event.id)
    .sort((a, b) => {
      const at = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const target = event.start?.getTime() ?? 0;
      return Math.abs(at - target) - Math.abs(bt - target);
    })
    .slice(0, 4);

  const facts: { label: string; value: string }[] = [
    { label: "Circuit", value: league.name },
    { label: "Season", value: event.season },
    { label: "Venue", value: event.venue },
    { label: "Prize pool", value: event.prizePool },
    { label: "Champion prize", value: event.championPrize },
    { label: "Defending champion", value: event.defendingChampion },
    { label: "Broadcast", value: event.broadcast },
    { label: "Table", value: event.table },
    { label: "Ball", value: event.ball },
    { label: "Cloth", value: event.cloth },
  ].filter((fact) => !isPlaceholder(fact.value));

  return (
    <>
      <section className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-50" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full opacity-[0.12] blur-[110px]"
          style={{ background: "var(--color-lime-400)" }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-8 sm:px-6 lg:px-10 lg:pb-12">
          <nav className="flex items-center gap-2 text-[11.5px] text-fog-600" aria-label="Breadcrumb">
            <Link href="/schedule" className="transition-colors hover:text-fog-300">
              Schedule
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href={`/schedule?season=${event.season}&league=${event.league}`}
              className="transition-colors hover:text-fog-300"
            >
              {league.name}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="truncate text-fog-400">{event.season}</span>
          </nav>

          <div className="mt-7 grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={event.status} />
                <Chip tone={league.tone}>{league.name}</Chip>
                {event.start && event.status === "upcoming" && (
                  <Chip tone="neutral">{until !== null && until > 0 ? `In ${until} days` : "Imminent"}</Chip>
                )}
              </div>

              <h1 className="display-lg mt-5 max-w-3xl text-fog-100">{event.title}</h1>

              <p className="tnum mt-4 text-[14px] text-fog-300">{fmtRange(event.start, event.end)}</p>
              <p className="mt-1 text-[13px] text-fog-500">
                {event.venue}
                {days ? ` · ${days}-day event` : ""}
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {event.guideUrl && (
                  <a
                    href={event.guideUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
                  >
                    Event guide ↗
                  </a>
                )}
                <Link
                  href="/live"
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2 text-[13px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
                >
                  Match centre
                </Link>
                <a
                  href={`https://www.pbatour.org/en/tournament/schedule/index`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2 text-[13px] font-semibold text-fog-200 transition-colors hover:border-ink-500 hover:text-fog-100"
                >
                  On pbatour.org ↗
                </a>
              </div>
            </div>

            <aside className="surface-raised relative overflow-hidden p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Presented by</p>
                  <p className="mt-1.5 font-display text-[17px] font-bold leading-tight text-fog-100">
                    {event.sponsor}
                  </p>
                </div>
                {event.logo && <EventLogo src={event.logo} name={event.sponsor} className="h-12 max-w-[110px]" />}
              </div>

              <dl className="mt-5">
                {facts.slice(0, 6).map((fact) => (
                  <KeyValue key={fact.label} label={fact.label}>
                    <span className="line-clamp-2">{fact.value}</span>
                  </KeyValue>
                ))}
              </dl>

              {(event.entrants.players || event.entrants.teams) && (
                <div className="mt-4 flex gap-6 border-t border-ink-800 pt-4">
                  {event.entrants.players ? (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">
                        Players
                      </p>
                      <p className="tnum mt-1 font-display text-xl font-bold text-fog-100">
                        {event.entrants.players}
                      </p>
                    </div>
                  ) : null}
                  {event.entrants.teams ? (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">
                        Teams
                      </p>
                      <p className="tnum mt-1 font-display text-xl font-bold text-fog-100">
                        {event.entrants.teams}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <div>
            <h2 className="display-md text-fog-100">Event facts</h2>
            <dl className="mt-5 grid gap-x-10 sm:grid-cols-2">
              {facts.map((fact) => (
                <KeyValue key={fact.label} label={fact.label}>
                  <span className="line-clamp-3">{fact.value}</span>
                </KeyValue>
              ))}
            </dl>

            {event.broadcast && !isPlaceholder(event.broadcast) && (
              <div className="mt-8 rounded-[14px] border border-ink-750 bg-ink-900 p-5">
                <p className="eyebrow">Where to watch</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-fog-300">{event.broadcast}</p>
              </div>
            )}
          </div>

          <aside>
            <h2 className="font-display text-lg font-bold text-fog-100">Around this event</h2>
            {siblings.length > 0 ? (
              <div className="mt-3 surface px-4 py-1">
                {siblings.map((sibling) => (
                  <EventRow key={sibling.id} event={sibling} />
                ))}
              </div>
            ) : (
              <EmptyState
                className="mt-3"
                title="No neighbouring events"
                description="This circuit has no other published events in this season."
              />
            )}
            <div className="mt-4">
              <TextLink href={`/schedule?season=${event.season}&league=${event.league}`}>
                All {league.name} events
              </TextLink>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
