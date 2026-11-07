/**
 * The "Today" panel of the console home, from match records.
 *
 * Renders its own section rather than borrowing the page's `Panel`, so the same
 * markup can be produced twice: once by the page's fallback while the day is
 * being read, once by the read itself. Keeping the two identical is what stops
 * the list from arriving as an unannounced block under a "reading…" header.
 *
 * The day read fans out over every event running right now, so it is the slowest
 * thing on the home page; everything else must not wait on it.
 */
import Link from "next/link";
import { getDayBoard } from "@/lib/pba/matches-on-day";
import { TodayMatches } from "./today-matches";
import type { DayBoard, MatchState } from "@/lib/pba/matches-on-day";

export function boardSummary(board: DayBoard): string {
  if (!board.matches.length) return "no matches";
  const count = (state: MatchState) => board.matches.filter((match) => match.state === state).length;
  const finals = count("final"), live = count("live"), next = count("next");
  return [finals ? `${finals} final${finals === 1 ? "" : "s"}` : "", live ? `${live} live` : "", next ? `${next} to come` : ""].filter(Boolean).join(" · ");
}

export async function TodayBoard({ day }: { day: string }) {
  const board = await getDayBoard(day);
  return <TodayPanelBody day={day} board={board} />;
}

/** The panel frame, shared by the streamed content and its fallback. */
export function TodayPanelFrame({
  day,
  meta,
  children,
}: {
  day: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-ink-750 bg-ink-900">
      <header className="flex min-h-[38px] flex-wrap items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="font-display text-[12.5px] font-bold uppercase tracking-[0.09em] text-fog-100">
            Today
          </h2>
          <span className="tnum text-[11px] text-fog-600">{meta}</span>
        </div>
        <Link
          href={`/schedule?day=${day}`}
          className="text-[11.5px] font-medium text-fog-400 transition-colors hover:text-lime-300"
        >
          Calendar →
        </Link>
      </header>
      {children}
    </section>
  );
}

/** What the frame shows before the day has been read. */
export function TodayPanelSkeleton({ day }: { day: string }) {
  return (
    <TodayPanelFrame day={day} meta="reading the day's fixtures…">
      <div className="space-y-px py-1" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-2.5 px-3 py-2">
            <span className="h-[10px] w-[34px] rounded bg-ink-800" />
            <span className="h-[10px] flex-1 rounded bg-ink-800" />
            <span className="h-[10px] w-[14px] rounded bg-ink-800" />
          </div>
        ))}
      </div>
    </TodayPanelFrame>
  );
}

function TodayPanelBody({ day, board }: { day: string; board: Awaited<ReturnType<typeof getDayBoard>> }) {
  const live = board.matches.filter((match) => match.state === "live").length;
  return (
    <TodayPanelFrame
      day={day}
      meta={`${boardSummary(board)}${board.events.length > 0 ? ` · ${board.events.length} event${board.events.length === 1 ? "" : "s"} on` : ""}`}
    >
      <TodayMatches board={board} />
      {board.partial && (
        <p className="border-t border-ink-800 px-3 py-1.5 text-[10px] text-amber-450">
          Part of this day could not be read; the list may be missing matches.
        </p>
      )}
      {live > 0 && (
        <p className="border-t border-ink-800 px-3 py-1.5 text-[10px] text-fog-600">
          A match marked live has kicked off; its score appears when the scoring terminal closes it.
        </p>
      )}
    </TodayPanelFrame>
  );
}
