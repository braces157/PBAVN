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
    <div className="space-y-7">
      {rounds.map((group) => (
        <section key={group.round}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[15px] font-bold text-fog-100">{group.round}</h3>
            <span className="tnum text-[11px] text-fog-600">{group.rows.length} matches</span>
          </div>

          <ul className="mt-2 divide-y divide-ink-800 rounded-[14px] border border-ink-750 bg-ink-900">
            {group.rows.map((match) => (
              <li key={match.pstCode}>
                <Link
                  href={`/matches/${match.pstCode}?tour=${encodeURIComponent(tourCode)}&seq=${encodeURIComponent(eventSeq)}&round=${encodeURIComponent(match.round)}`}
                  className="flex items-start gap-3 px-3.5 py-2.5 transition-colors hover:bg-ink-850"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {match.sides.map((side, index) => (
                      <p
                        key={`${side.name}-${index}`}
                        className={cn(
                          "flex items-baseline gap-2 text-[12.5px]",
                          side.won ? "font-semibold text-fog-100" : "text-fog-300",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{side.name}</span>
                        <span className="tnum shrink-0 text-right">{side.sets ?? "—"}</span>
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

                  <span aria-hidden="true" className="shrink-0 pt-1 text-[11px] text-fog-600">
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
