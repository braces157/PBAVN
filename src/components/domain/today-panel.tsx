import Link from "next/link";
import { getDayBoard } from "@/lib/pba/matches-on-day";
import { relativeDay } from "@/lib/format";
import { boardSummary, TodayMatches } from "./today-matches";

export async function TodayBoard({ day, title }: { day: string; title?: string }) {
  const board = await getDayBoard(day);
  return <TodayPanelBody day={day} title={title} board={board} />;
}

export function TodayPanelFrame({
  day,
  title,
  meta,
  children,
}: {
  day: string;
  title?: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-ink-750 bg-ink-900">
      <header className="flex min-h-[38px] flex-wrap items-center justify-between gap-2 border-b border-ink-750 bg-ink-850 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-display text-[11.5px] font-bold uppercase tracking-[0.08em] text-fog-100">
            {title ?? `${relativeDay(day)} Matches`}
          </h2>
          <span className="tnum text-[11px] text-fog-500">{meta}</span>
        </div>
        <Link
          href={`/schedule?day=${day}`}
          className="text-[11.5px] font-semibold text-carom-300 transition-colors hover:text-carom-400"
        >
          Full schedule →
        </Link>
      </header>
      {children}
    </section>
  );
}

export function TodayPanelSkeleton({ day, title }: { day: string; title?: string }) {
  return (
    <TodayPanelFrame day={day} title={title} meta="loading fixtures…">
      <div className="space-y-px py-1.5" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-2.5 px-3.5 py-2.5">
            <span className="h-[10px] w-[42px] rounded bg-ink-800" />
            <span className="h-[10px] flex-1 rounded bg-ink-800" />
            <span className="h-[10px] w-[20px] rounded bg-ink-800" />
          </div>
        ))}
      </div>
    </TodayPanelFrame>
  );
}

function TodayPanelBody({
  day,
  title,
  board,
}: {
  day: string;
  title?: string;
  board: Awaited<ReturnType<typeof getDayBoard>>;
}) {
  const live = board.matches.filter((match) => match.state === "live").length;
  return (
    <TodayPanelFrame
      day={day}
      title={title}
      meta={`${boardSummary(board)}${board.events.length > 0 ? ` · ${board.events.length} event${board.events.length === 1 ? "" : "s"}` : ""}`}
    >
      <TodayMatches board={board} />
      {board.partial && board.matches.length > 0 && (
        <p className="border-t border-ink-800 px-3.5 py-2 text-[11.5px] text-gold-300">
          Part of this day could not be read; the list may be incomplete.
        </p>
      )}
      {live > 0 && (
        <p className="border-t border-ink-800 px-3.5 py-2 text-[11px] text-fog-500">
          Matches marked live have started; final scores update once completed.
        </p>
      )}
    </TodayPanelFrame>
  );
}
