import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import { fmtRange } from "@/lib/format";
import type { CalendarEvent } from "@/lib/pba/calendar";

export interface NextFixture {
  home: string;
  away: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  at: string | null;
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
    <div className="grid gap-px overflow-hidden rounded-[8px] border border-ink-750 bg-ink-750 lg:grid-cols-[1.1fr_1fr_0.9fr]">
      {live}

      <div className="bg-ink-900 px-4 py-3.5">
        <p className="micro-label flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-carom-400" aria-hidden="true" />
          Up next
        </p>
        {next ? (
          <>
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[13px] font-semibold leading-tight text-fog-100">
              <SideLogo logo={next.homeLogo} name={next.home} />
              <span className="min-w-0 truncate">{next.home}</span>
              <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.08em] text-fog-550">
                vs
              </span>
              <SideLogo logo={next.awayLogo} name={next.away} />
              <span className="min-w-0 truncate">{next.away}</span>
            </p>
            <p className="tnum mt-1.5 text-[11.5px] leading-snug">
              <span className="font-bold text-carom-400">{next.label}</span>
              {next.at ? <span className="text-fog-450"> · {next.at}</span> : null}
            </p>
            {next.href ? (
              <Link
                href={next.href}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-fog-200 transition-colors hover:text-carom-300"
              >
                Open fixture →
              </Link>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-[12px] leading-snug text-fog-450">
            {event.status === "completed"
              ? "Every fixture published for this event has concluded."
              : "No fixture published yet. The draw appears as soon as the association posts it."}
          </p>
        )}
      </div>

      <div className="bg-ink-900 px-4 py-3.5">
        <p className="micro-label">Event window</p>
        <p className="tnum mt-2 text-[13px] font-semibold leading-tight text-fog-100">
          {fmtRange(event.start, event.end)}
        </p>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-fog-450">{event.venue}</p>
        {event.entrants.players || event.entrants.teams ? (
          <p className="tnum mt-1.5 text-[11px] text-fog-550">
            {event.entrants.teams
              ? `${event.entrants.teams} teams${event.entrants.players ? ` · ${event.entrants.players} players` : ""}`
              : `${event.entrants.players} players`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LiveIdle({ href = "/live" }: { href?: string }) {
  return (
    <div className="bg-ink-900 px-4 py-3.5">
      <p className="micro-label flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-fog-550" aria-hidden="true" />
        On table
      </p>
      <p className="mt-2 text-[12.5px] font-semibold leading-snug text-fog-200">
        No match is being scored right now
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-fog-450">
        The association&apos;s scoreboard reports an idle table.
      </p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-carom-400 transition-colors hover:text-carom-300"
      >
        Match centre →
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
        "grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink-800 text-[7px] font-bold text-fog-450",
      )}
    >
      {name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "–"}
    </span>
  );
}
