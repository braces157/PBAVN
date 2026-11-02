import Link from "next/link";
import { fmtRange, dayCount, daysUntil, isPlaceholder } from "@/lib/format";
import { leagueByCode, type Event } from "@/lib/normalize";
import { EventLogo } from "@/components/ui/media";
import { Chip, StatusPill, cn } from "@/components/ui/primitives";

const TONE_BORDER: Record<string, string> = {
  lime: "hover:border-lime-400/40",
  rose: "hover:border-rose-450/40",
  cyan: "hover:border-cyan-450/40",
  amber: "hover:border-amber-450/40",
  violet: "hover:border-violet-450/40",
};

const TONE_TEXT: Record<string, string> = {
  lime: "text-lime-400",
  rose: "text-rose-450",
  cyan: "text-cyan-450",
  amber: "text-amber-450",
  violet: "text-violet-450",
};

/** Large hero treatment for the event that is on now (or next). */
export function FeaturedEvent({ event, className }: { event: Event; className?: string }) {
  const league = leagueByCode(event.league);
  const days = dayCount(event.start, event.end);
  const until = daysUntil(event.start);

  return (
    <article
      className={cn(
        "surface-raised relative overflow-hidden p-5 sm:p-6",
        TONE_BORDER[league.tone],
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "var(--color-lime-400)" }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={event.status} />
            <Chip tone={league.tone}>{league.name}</Chip>
          </div>
          {event.logo && <EventLogo src={event.logo} name={event.sponsor} className="h-8 max-w-[92px]" />}
        </div>

        <h3 className="mt-4 font-display text-[26px] font-bold leading-[1.08] tracking-tight text-fog-100">
          {event.title}
        </h3>

        <p className="tnum mt-2 text-[13px] text-fog-400">{fmtRange(event.start, event.end)}</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-800 pt-4 text-[12.5px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">Venue</dt>
            <dd className="mt-1 leading-snug text-fog-200">{event.venue}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">
              {event.status === "completed" ? "Champion" : "Prize pool"}
            </dt>
            <dd className="mt-1 leading-snug text-fog-200">
              {event.status === "completed" && !isPlaceholder(event.defendingChampion)
                ? event.defendingChampion
                : event.prizePool}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink-800 pt-4">
          <p className="tnum text-[11.5px] text-fog-500">
            {event.status === "live" && days
              ? `Day ${Math.min(days, Math.max(1, 1 - (until ?? 0)))} of ${days}`
              : days
                ? `${days}-day event`
                : "Schedule pending"}
          </p>
          <Link
            href={`/schedule/${event.id}`}
            className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-lime-400 transition-colors hover:text-lime-300"
          >
            Event detail
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <path
                d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Compact list row used on the schedule and home pages. */
export function EventRow({ event }: { event: Event }) {
  const league = leagueByCode(event.league);
  return (
    <Link
      href={`/schedule/${event.id}`}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-ink-800 px-1 py-3.5 transition-colors last:border-0 hover:bg-ink-850/60 sm:px-2",
      )}
    >
      <div className="w-[62px] shrink-0">
        <p className="tnum font-display text-[15px] font-bold leading-none text-fog-100">
          {event.start ? event.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "TBA"}
        </p>
        <p className="tnum mt-1 text-[10.5px] uppercase tracking-[0.1em] text-fog-600">
          {event.start ? event.start.getFullYear() : ""}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-fog-100 transition-colors group-hover:text-lime-300">
          {event.title}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-fog-500">
          <span className={cn("font-semibold", TONE_TEXT[league.tone])}>{league.name}</span>
          {!isPlaceholder(event.venue) && (
            <>
              <span className="mx-1.5 text-ink-500">·</span>
              {event.venue}
            </>
          )}
        </p>
      </div>

      <div className="shrink-0">
        <StatusPill status={event.status} />
      </div>
    </Link>
  );
}
