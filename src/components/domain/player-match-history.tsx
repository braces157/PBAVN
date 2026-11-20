import Link from "next/link";
import { trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getPlayerMatchHistory } from "@/lib/pba/service";
import type { TourMatch } from "@/lib/pba/match-search";
import { average } from "@/lib/format";
import { DataStatus } from "@/components/site/data-status";
import { EmptyState, Panel, TextLink, cn } from "@/components/ui/primitives";

interface HistoryProps {
  memCode: string;
  playerName: string;
  nameEn: string | null | undefined;
  nameEnShort: string | null | undefined;
  seasonCode: string;
  seasonTitle: string;
  pbaType: string;
}

const COLUMNS = 6;

export function ProfileMatchHistorySkeleton({ seasonTitle }: { seasonTitle: string }) {
  return (
    <Panel title="Match history" meta={`${seasonTitle} · loading…`}>
      <div className="space-y-3 p-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <span className="h-3 w-20 animate-pulse rounded bg-[var(--bar-2)]" />
            <span className="h-3 w-1/3 animate-pulse rounded bg-[var(--bar-2)]" />
            <span className="ml-auto h-3 w-8 animate-pulse rounded bg-[var(--bar-2)]" />
            <span className="h-3 w-12 animate-pulse rounded bg-[var(--bar-2)]" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * The season's individual-tour matches, grouped by event, for the profile page.
 * Streams behind a Suspense boundary: the search fans out once per tour entered.
 */
export async function ProfileMatchHistory({
  memCode,
  playerName,
  nameEn,
  nameEnShort,
  seasonCode,
  seasonTitle,
  pbaType,
}: HistoryProps) {
  const { history, failures } = await trackFailures(async () => {
    const history = await getPlayerMatchHistory({ memCode, nameEn, nameEnShort, seasonCode, pbaType });
    return { history, failures: getRequestFailures() };
  });

  const everyTourFailed = history.toursSearched > 0 && history.toursFailed === history.toursSearched;
  const allHref = `/players/${memCode}/matches?season=${encodeURIComponent(seasonCode)}`;

  // Events arrive newest first; keep that order and group rows per tour.
  const groups: { code: string; title: string; matches: TourMatch[] }[] = [];
  for (const match of history.matches) {
    if (!match.sides.some((side) => side.memCode === memCode)) continue;
    let group = groups.find((entry) => entry.code === match.tourCode);
    if (!group) {
      group = { code: match.tourCode, title: match.tourTitle, matches: [] };
      groups.push(group);
    }
    group.matches.push(match);
  }

  const played = groups.flatMap((group) => group.matches);
  const wins = played.filter((match) => match.sides.find((side) => side.memCode === memCode)?.won).length;
  const losses = played.length - wins;

  return (
    <Panel
      id="matches"
      className="scroll-mt-24"
      title="Match history"
      meta={
        played.length > 0 ? (
          <>
            {seasonTitle} · <span className="text-[var(--win)]">{wins}W</span>{" "}
            <span className="text-[var(--loss)]">{losses}L</span>
          </>
        ) : (
          seasonTitle
        )
      }
      action={<TextLink href={allHref}>Full page</TextLink>}
    >
      {failures.length > 0 && <DataStatus failures={failures} className="m-3" />}

      {everyTourFailed ? (
        <EmptyState
          className="m-3"
          title="The scoring terminal did not answer"
          description="None of the season's tours could be searched. Please retry."
        />
      ) : played.length === 0 ? (
        <EmptyState
          className="m-3"
          title={
            failures.length > 0
              ? "This season could not be read completely"
              : history.partial
                ? "This season could not be searched completely"
                : history.searchTerm
                  ? "No recorded individual-tour matches"
                  : "No searchable name on file"
          }
          description={
            failures.length > 0
              ? "The data service did not answer for every read, so an empty list is not proof of zero matches."
              : history.partial
                ? `The scoring terminal capped the search before finding matches for ${playerName} in ${seasonTitle}, so an empty list does not mean zero matches.`
                : history.searchTerm
                  ? `The scoring terminal holds no match for ${playerName} in ${seasonTitle}.`
                  : "The search terminal matches Latin-script names only, and this player's record carries no English name."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="stat-table">
            <thead>
              <tr>
                <th className="!text-left">Round</th>
                <th className="!text-left">Opponent</th>
                <th className="!text-center">Result</th>
                <th>Sets</th>
                <th>Avg</th>
                <th className="hidden sm:table-cell">HR</th>
              </tr>
            </thead>
            {groups.map((group) => {
              const groupWins = group.matches.filter(
                (match) => match.sides.find((side) => side.memCode === memCode)?.won,
              ).length;
              return (
                <tbody key={group.code}>
                  <tr>
                    <td
                      colSpan={COLUMNS}
                      className="!bg-[var(--bar)] !py-2 !text-left"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[12.5px] font-bold leading-snug text-[var(--text)]">
                          {group.title}
                        </span>
                        <span className="tnum shrink-0 text-[11px] font-semibold text-[var(--muted)]">
                          {groupWins}–{group.matches.length - groupWins}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.matches.map((match) => (
                    <MatchRow key={`${match.tourCode}-${match.pstCode}`} match={match} memCode={memCode} />
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      {!everyTourFailed && history.partial && (
        <p className="border-t border-[var(--line)] px-2.5 py-2 text-[11px] text-[var(--muted)]">
          The search was capped partway through this season, so some rows may be missing.
        </p>
      )}
    </Panel>
  );
}

function MatchRow({ match, memCode }: { match: TourMatch; memCode: string }) {
  const own = match.sides.find((side) => side.memCode === memCode);
  const opponent = match.sides.find((side) => side.memCode !== memCode);
  if (!own) return null;
  const won = own.won;
  return (
    <tr className="group relative">
      <td className="!text-left whitespace-nowrap text-[var(--text-2)]">
        {match.round || "—"}
        <Link
          href={`/matches/${match.pstCode}?tour=${encodeURIComponent(match.tourCode)}&round=${encodeURIComponent(match.round)}`}
          className="absolute inset-0"
          aria-label={`${match.tourTitle}, ${match.round}: ${won ? "won" : "lost"} against ${opponent?.name ?? "unknown"}`}
        />
      </td>
      <td className="!text-left font-semibold text-[var(--link)] group-hover:underline">
        {opponent?.name ?? "—"}
      </td>
      <td className="!text-center">
        <span
          className={cn(
            "inline-grid h-5 w-5 place-items-center rounded-[3px] text-[11px] font-bold",
            won ? "bg-[var(--win)] text-white" : "bg-[var(--loss)]/15 text-[var(--loss)]",
          )}
        >
          {won ? "W" : "L"}
        </span>
      </td>
      <td className="tnum font-bold">
        {own.sets !== null && own.sets === opponent?.sets && (
          <span
            title="Decided by shootout"
            className="mr-1.5 rounded-[2px] bg-[var(--bar-2)] px-1 py-[1px] text-[9.5px] font-bold tracking-[0.04em] text-[var(--muted)]"
          >
            SO
          </span>
        )}
        {own.sets ?? "—"}–{opponent?.sets ?? "—"}
      </td>
      <td className="tnum text-[var(--text-2)]">{average(own.average)}</td>
      <td className="hidden tnum text-[var(--text-2)] sm:table-cell">
        {own.highRun ?? "—"}
      </td>
    </tr>
  );
}
