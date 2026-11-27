import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[1.1fr_1fr_0.9fr]">
      {live}

      <div className="bg-card px-4 py-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Up next
        </p>
        {next ? (
          <>
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm font-medium leading-tight text-foreground">
              <SideLogo logo={next.homeLogo} name={next.home} />
              <span className="min-w-0 truncate">{next.home}</span>
              <span className="shrink-0 font-mono text-[10px] font-medium uppercase text-muted-foreground">
                vs
              </span>
              <SideLogo logo={next.awayLogo} name={next.away} />
              <span className="min-w-0 truncate">{next.away}</span>
            </p>
            <p className="mt-1.5 font-mono text-xs leading-snug tabular-nums">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{next.label}</span>
              {next.at ? <span className="text-muted-foreground"> · {next.at}</span> : null}
            </p>
            {next.href ? (
              <Link
                href={next.href}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-muted-foreground hover:no-underline"
              >
                Open fixture
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {event.status === "completed"
              ? "Every fixture published for this event has concluded."
              : "No fixture published yet. The draw appears as soon as the association posts it."}
          </p>
        )}
      </div>

      <div className="bg-card px-4 py-3.5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Event window
        </p>
        <p className="mt-2 font-mono text-sm font-semibold leading-tight tabular-nums text-foreground">
          {fmtRange(event.start, event.end)}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{event.venue}</p>
        {event.entrants.players || event.entrants.teams ? (
          <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            {event.entrants.teams
              ? `${event.entrants.teams} teams${event.entrants.players ? ` · ${event.entrants.players} players` : ""}`
              : `${event.entrants.players} players`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LiveIdle({
  href = "/live",
  unavailable = false,
  status = "live",
}: {
  href?: string;
  unavailable?: boolean;
  status?: "live" | "upcoming" | "completed";
}) {
  if (status === "completed") {
    return (
      <div className="bg-card px-4 py-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Tournament status
        </p>
        <p className="mt-2 text-sm font-medium leading-snug text-foreground">
          Tournament concluded
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          All published rounds and scorecards for this event are final.
        </p>
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-muted-foreground hover:no-underline"
        >
          Live match centre
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card px-4 py-3.5">
      <p className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", unavailable ? "bg-rose-500" : "bg-muted-foreground/60")}
          aria-hidden="true"
        />
        {unavailable ? "Feed unreachable" : status === "upcoming" ? "Upcoming event" : "On table"}
      </p>
      <p className="mt-2 text-sm font-medium leading-snug text-foreground">
        {unavailable
          ? "Scoring board did not answer"
          : status === "upcoming"
            ? "Play has not started yet"
            : "Between sessions — no table in play"}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        {unavailable
          ? "The live feed could not be reached for this render. Check the match centre directly."
          : status === "upcoming"
            ? "Live tables will appear here once the first session begins."
            : "The association's scoring terminal reports no active table right now."}
      </p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-muted-foreground hover:no-underline"
      >
        Match centre
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function SideLogo({ logo, name }: { logo?: string | null; name: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={logo} alt="" loading="lazy" className="h-4 w-4 shrink-0 rounded object-contain" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-secondary text-[8px] font-semibold text-muted-foreground"
    >
      {name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "–"}
    </span>
  );
}
