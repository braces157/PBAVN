import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { fmtRange } from "@/lib/format";
import type { CalendarEvent } from "@/lib/pba/calendar";

/**
 * What is happening in this event right now, and what happens next.
 *
 * The event page used to open straight into a list of finished matches, which
 * answers a question nobody asked. A sports reader arriving mid-tournament wants
 * the live fixture first and the next fixture second; the archive belongs below
 * them. The strip is built only from what the feeds can support:
 *
 *  - a live block only when the scoring terminal reports a match in play,
 *    otherwise a block that says so honestly and links to the wire;
 *  - the next unplayed fixture from the round/draw feed, with its distance;
 *  - the event window as the third block, so a freshly published event with no
 *    draw yet still reads as a page rather than an empty shell.
 */
export interface NextFixture {
  home: string;
  away: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  /** Already rendered, e.g. the published kickoff stamp. */
  at: string | null;
  /** "In 3 hours" / "Thu 18:30" — the emphasis line. */
  label: string;
  href: string | null;
}

export function NowNextStrip({
  event,
  live,
  next,
}: {
  event: CalendarEvent;
  live: React.ReactNode;
  next: NextFixture | null;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-[10px] border border-ink-750 bg-ink-750 lg:grid-cols-[1.1fr_1fr_0.9fr]">
      {live}

      <div className="bg-ink-900 px-3.5 py-3">
        <p className="micro-label flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-400" aria-hidden="true" />
          Up next
        </p>
        {next ? (
          <>
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[13px] font-semibold leading-tight text-fog-100">
              <SideLogo logo={next.homeLogo} name={next.home} />
              <span className="min-w-0 truncate">{next.home}</span>
              <span className="shrink-0 text-[9.5px] font-normal uppercase tracking-[0.08em] text-fog-600">
                vs
              </span>
              <SideLogo logo={next.awayLogo} name={next.away} />
              <span className="min-w-0 truncate">{next.away}</span>
            </p>
            <p className="tnum mt-1.5 text-[11.5px] leading-snug">
              <span className="font-semibold text-lime-400">{next.label}</span>
              {next.at ? <span className="text-fog-450"> · {next.at}</span> : null}
            </p>
            {next.href ? (
              <Link
                href={next.href}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-fog-300 transition-colors hover:text-lime-300"
              >
                Open fixture <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-[12px] leading-snug text-fog-500">
            {event.status === "completed"
              ? "Every fixture published for this event has been played."
              : "No fixture is published yet. The draw appears here as soon as the association posts it."}
          </p>
        )}
      </div>

      <div className="bg-ink-900 px-3.5 py-3">
        <p className="micro-label">Event window</p>
        <p className="tnum mt-2 text-[13px] font-semibold leading-tight text-fog-100">
          {fmtRange(event.start, event.end)}
        </p>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-fog-500">{event.venue}</p>
        {event.entrants.players || event.entrants.teams ? (
          <p className="tnum mt-1.5 text-[11px] text-fog-600">
            {event.entrants.teams
              ? `${event.entrants.teams} teams${event.entrants.players ? ` · ${event.entrants.players} players` : ""}`
              : `${event.entrants.players} players`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The "no match in play" block, kept honest but still first in the strip. */
export function LiveIdle({ href = "/live" }: { href?: string }) {
  return (
    <div className="bg-ink-900 px-3.5 py-3">
      <p className="micro-label flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-fog-600" aria-hidden="true" />
        On table
      </p>
      <p className="mt-2 text-[12.5px] font-medium leading-snug text-fog-200">
        No match is being scored right now
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-fog-500">
        The association's scoreboard reports an idle table.
      </p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-fog-300 transition-colors hover:text-lime-300"
      >
        Match centre <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function SideLogo({ logo, name }: { logo?: string | null; name: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={logo} alt="" loading="lazy" className="h-4 w-4 shrink-0 rounded-[3px] object-contain" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink-750 text-[7px] font-bold text-fog-500",
      )}
    >
      {name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "–"}
    </span>
  );
}
