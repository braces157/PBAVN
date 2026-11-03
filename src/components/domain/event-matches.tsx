import Link from "next/link";
import { cn } from "@/components/ui/primitives";
import type { BracketMatch } from "@/lib/pba/bracket";

/**
 * Every drawn match of an event, newest round first, each one a link into its
 * card.
 *
 * This is the join the site was missing: the schedule feed knows the event but
 * not the matches, and the scoring terminal knows the matches but not the
 * event. The match code is carried through so the card can show its context,
 * and the event's own sequence number so the card can link back.
 *
 * On wide screens the rounds flow down two balanced columns, the way a printed
 * bracket sheet reads; on a phone it is a single stack.
 */
export function EventMatches({
  matches,
  tourCode,
  eventSeq,
}: {
  matches: BracketMatch[];
  tourCode: string;
  eventSeq: string;
}) {
  const rounds: { round: string; rows: BracketMatch[] }[] = [];
  for (const match of matches) {
    const bucket = rounds.find((entry) => entry.round === match.round);
    if (bucket) bucket.rows.push(match);
    else rounds.push({ round: match.round, rows: [match] });
  }

  return (
    <div className="md:columns-2 md:gap-8 lg:columns-1 xl:columns-2 [&>section]:mb-7 [&>section]:break-inside-avoid md:[&>section:last-child]:mb-0">
      {rounds.map((group) => (
        <section key={group.round}>
          <div className="flex items-baseline justify-between gap-3 border-b border-ink-750 pb-2">
            <h3 className="font-display text-[14px] font-bold uppercase tracking-[0.04em] text-fog-100">
              {group.round}
            </h3>
            <span className="tnum text-[11px] text-fog-600">{group.rows.length} matches</span>
          </div>

          <ul className="divide-y divide-ink-800">
            {group.rows.map((match) => (
              <li key={match.pstCode}>
                <Link
                  href={`/matches/${match.pstCode}?tour=${encodeURIComponent(tourCode)}&seq=${encodeURIComponent(eventSeq)}&round=${encodeURIComponent(match.round)}`}
                  className="group flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-ink-850 sm:px-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    {match.sides.map((side, index) => (
                      <p
                        key={`${side.name}-${index}`}
                        className={cn(
                          "flex items-center gap-2.5 text-[13px] leading-tight",
                          side.won ? "font-semibold text-fog-100" : "text-fog-500",
                        )}
                      >
                        {/* A winner gets a short lime tick; the loser keeps an
                            empty slot so both name lines start aligned. */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-3.5 w-[3px] shrink-0 rounded-full",
                            side.won ? "bg-lime-400" : "bg-transparent",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{side.name}</span>
                        <span
                          className={cn(
                            "tnum w-6 shrink-0 text-right font-display text-[14px] font-bold",
                            side.won ? "text-lime-400" : "text-fog-600",
                          )}
                        >
                          {side.sets ?? "—"}
                        </span>
                      </p>
                    ))}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tnum text-[10.5px] text-fog-500">
                      No {match.matchNo}
                      {match.table ? ` · ${match.table}` : ""}
                    </p>
                    {match.scheduledAt && (
                      <p className="tnum text-[10px] text-fog-600">{match.scheduledAt}</p>
                    )}
                  </div>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-[11px] text-ink-500 transition-colors group-hover:text-fog-300"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
