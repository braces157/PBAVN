import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { cn, CountTag } from "@/components/ui/primitives";
import type { BracketMatch } from "@/lib/pba/bracket";

/**
 * Every drawn match of an event, round by round, in the order a draw sheet
 * reads: the final first, then back through the bracket.
 *
 * Two links are nested inside each row, and a link cannot live inside a link, so
 * the row is not anchor-wrapped. Instead the row carries a stretched anchor that
 * covers it — the `after:absolute inset-0` overlay — and the two player names
 * sit above that overlay with their own anchors. One click target for the card,
 * two for the players, and the tab order stays row → name → name.
 */
export function BracketView({
  matches,
  tourCode,
  eventSeq,
  maxRounds,
}: {
  matches: BracketMatch[];
  tourCode: string;
  eventSeq: string;
  /** Show only the deepest N rounds; null shows the lot. */
  maxRounds?: number | null;
}) {
  const rounds: { round: string; rows: BracketMatch[] }[] = [];
  for (const match of matches) {
    const bucket = rounds.find((entry) => entry.round === match.round);
    if (bucket) bucket.rows.push(match);
    else rounds.push({ round: match.round, rows: [match] });
  }

  const shown = typeof maxRounds === "number" ? rounds.slice(0, maxRounds) : rounds;

  return (
    <div className="divide-y divide-ink-800">
      {shown.map((group) => (
        <section key={group.round}>
          <header className="flex items-center justify-between gap-3 bg-ink-850/70 px-3 py-1.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog-300">
              {group.round}
            </h3>
            <CountTag>{group.rows.length}</CountTag>
          </header>
          <ul className="divide-y divide-ink-800/70">
            {group.rows.map((match) => (
              <li key={match.pstCode}>
                <MatchRow
                  match={match}
                  href={`/matches/${match.pstCode}?tour=${encodeURIComponent(tourCode)}&seq=${encodeURIComponent(eventSeq)}&round=${encodeURIComponent(match.round)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MatchRow({ match, href }: { match: BracketMatch; href: string }) {
  const decided = match.sides.some((side) => side.won);
  const stamp = match.scheduledAt;

  return (
    <div className="row-hover relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5">
        <div className="row-span-2 flex flex-col gap-[2px]">
          <SideAvatar side={match.sides[0]} dim={decided && !match.sides[0]?.won} />
          <SideAvatar side={match.sides[1]} dim={decided && !match.sides[1]?.won} />
        </div>
        {match.sides.map((side, index) => {
          const won = decided && side.won;
          const label = (
            <span
              className={cn(
                "flex h-[21px] min-w-0 max-w-full items-center gap-2 text-[12.5px] leading-none",
                decided && !side.won ? "text-fog-550" : "text-fog-100",
                side.won && decided && "font-semibold",
              )}
            >
              <span className="min-w-0 truncate">{side.name}</span>
            </span>
          );
          return side.memCode ? (
            <Link
              key={`${side.name}-${index}`}
              href={`/players/${encodeURIComponent(side.memCode)}`}
              className="relative z-[2] w-fit max-w-full rounded-sm transition-colors hover:text-lime-300 hover:[&>span]:text-lime-300"
            >
              {label}
            </Link>
          ) : (
            <span key={`${side.name}-${index}`}>{label}</span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden w-[96px] flex-col items-end sm:flex">
          {match.sides.map((side, index) => (
            <span
              key={`meta-${index}`}
              className="tnum flex h-[21px] items-center gap-2 text-[10px] leading-none text-fog-550"
            >
              <span className="w-[52px] text-right">
                AVG {side.average !== null ? side.average.toFixed(3) : "—"}
              </span>
              <span className="w-[38px] text-right text-fog-600">HR {side.highRun ?? "—"}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-col items-end">
          {match.sides.map((side, index) => (
            <span
              key={`score-${index}`}
              className={cn(
                "score-cell flex h-[21px] w-[20px] items-center justify-end text-[14px]",
                side.won ? "text-lime-400" : "text-fog-500",
              )}
            >
              {side.sets ?? "–"}
            </span>
          ))}
        </div>

        <div className="w-[76px] shrink-0 text-right">
          <p className="tnum text-[10.5px] leading-tight text-fog-500">No {match.matchNo}</p>
          {stamp && <p className="tnum text-[9.5px] leading-tight text-fog-600">{stamp}</p>}
          {match.table && <p className="text-[9.5px] leading-tight text-fog-600">{match.table}</p>}
        </div>
      </div>

      {/* The whole row opens the card; names and scores sit above this overlay. */}
      <Link
        href={href}
        aria-label={`Match ${match.matchNo}, ${match.sides.map((side) => side.name).join(" against ")}`}
        className="absolute inset-0 z-[1] rounded-sm focus-visible:z-[3]"
      />
    </div>
  );
}

/**
 * A 21 px portrait. The photo proxy answers 404 for members who never uploaded
 * one, so the plate falls back to initials rather than a broken frame.
 */
function SideAvatar({ side, dim }: { side?: BracketMatch["sides"][number]; dim: boolean }) {
  return (
    <span
      className={cn(
        "grid h-[21px] w-[26px] shrink-0 place-items-center overflow-hidden rounded-[3px] bg-ink-800",
        dim && "opacity-50",
      )}
      aria-hidden="true"
    >
      <SafeImage
        path={side?.memCode ? `/players/PBA/small/${side.memCode}.jpg` : null}
        width={44}
        alt=""
        className="h-full w-full object-cover object-top"
        fallback={<span className="text-[8px] font-bold text-fog-600">{initialsOf(side?.name ?? "")}</span>}
      />
    </span>
  );
}

function initialsOf(name: string): string {
  const letters = name
    .replace(/\./g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "");
  return letters.join("").toUpperCase() || "–";
}
