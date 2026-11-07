import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getPlayerCached, getPlayerMatchHistory, getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import { normalizePlayer, statLeagueCode } from "@/lib/normalize";
import { average } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { EmptyState } from "@/components/ui/primitives";
import { DataStatus } from "@/components/site/data-status";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ memCode: string }>;
  searchParams: Promise<{ season?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { memCode } = await params;
  const raw = await getPlayerCached(memCode);
  if (!raw) return { title: "Match history" };
  const name = raw.PlayerNameEN || raw.PlayerNameKO;
  return {
    title: `${name} — match history`,
    description: `${name} — every recorded individual-tour match, season by season, each linked to its turn-by-turn card.`,
  };
}

export default async function PlayerMatchesPage({ params, searchParams }: PageProps) {
  const { memCode } = await params;
  const { season: seasonParam } = await searchParams;

  const [raw, seasons, currentSeason] = await Promise.all([
    getPlayerCached(memCode),
    getSeasonList(),
    getCurrentSeason(),
  ]);
  if (!raw) notFound();

  const player = normalizePlayer(raw);
  const seasonCode =
    seasonParam && seasons.some((s) => s.SeasonCode === seasonParam)
      ? seasonParam
      : currentSeason.SeasonCode;

  return (
    <>
      <PageHeader
        eyebrow="Match history"
        title={player.name}
        description={`Every recorded individual-tour match of ${player.nameKo} in the selected season, newest first. Each row opens the turn-by-turn card.`}
      >
        <FilterRow
          label="Season"
          basePath={`/players/${memCode}/matches`}
          paramKey="season"
          active={seasonCode}
          params={{}}
          options={seasons.slice(0, 5).map((s) => ({
            value: s.SeasonCode,
            label: s.SeasonTitle || s.SeasonCode,
          }))}
        />
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {/* The history search fans out over every tour of the season and is by
            far the slowest read here, so it streams into a standing table
            frame while the shell renders at once. */}
        <Suspense fallback={<HistorySkeleton />}>
          <HistorySection
            memCode={memCode}
            nameEn={raw.PlayerNameEN}
            nameEnShort={raw.PlayerNameENShort}
            seasonCode={seasonCode}
            pbaType={statLeagueCode(player.league)}
          />
        </Suspense>
      </div>
    </>
  );
}

/** The table frame, so the streamed swap does not jump the page. */
function HistorySkeleton() {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900" aria-hidden="true">
      <div className="space-y-3 p-4">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <span className="h-[10px] w-[52px] rounded bg-ink-800" />
            <span className="h-[10px] w-1/3 rounded bg-ink-800" />
            <span className="h-[10px] w-[70px] rounded bg-ink-800" />
            <span className="h-[10px] w-[80px] rounded bg-ink-800" />
            <span className="h-[10px] w-[30px] rounded bg-ink-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The season's matches. Failures are tracked inside this section: the search
 * runs here, and the partial-data notice belongs to the table it explains.
 */
async function HistorySection({
  memCode,
  nameEn,
  nameEnShort,
  seasonCode,
  pbaType,
}: {
  memCode: string;
  nameEn: string | null | undefined;
  nameEnShort: string | null | undefined;
  seasonCode: string;
  pbaType: string;
}) {
  const { history, failures } = await trackFailures(async () => {
    const history = await getPlayerMatchHistory({ memCode, nameEn, nameEnShort, seasonCode, pbaType });
    return { history, failures: getRequestFailures() };
  });

  // The search streams each tour newest round first; newest tour first on top
  // of that keeps the table strictly newest first without a trustworthy date.
  const matches = history.matches;
  const everyTourFailed = history.toursSearched > 0 && history.toursFailed === history.toursSearched;

  return (
    <>
      <DataStatus failures={failures} className="mt-0 mb-4" />

      {everyTourFailed ? (
        <EmptyState
          title="The scoring terminal did not answer"
          description="None of the season's tours could be searched, so there is nothing to show. This is a transport failure, not an empty record — try again."
        />
      ) : matches.length === 0 && failures.length > 0 ? (
        <EmptyState
          title="This season could not be read completely"
          description="The data service did not answer for every read, so an empty table here is not proof the player has no recorded matches. The notice above names what failed; try again."
        />
      ) : matches.length === 0 ? (
        <EmptyState
          title={
            history.searchTerm
              ? "No recorded individual-tour matches in this season"
              : "No searchable name on file"
          }
          description={
            history.searchTerm
              ? `The scoring terminal holds no match for ${nameEn ?? "this player"} in this season. Try an earlier season above.`
              : "The search terminal matches Latin-script names only, and this player's record carries no English name to search for."
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-750 bg-ink-900 sm:hidden">
            {matches.map((match) => {
              const own = match.sides.find((side) => side.memCode === memCode);
              const opponent = match.sides.find((side) => side.memCode !== memCode);
              if (!own) return null;
              return <li key={`${match.tourCode}-${match.pstCode}`}>
                <Link href={`/matches/${match.pstCode}?tour=${encodeURIComponent(match.tourCode)}&round=${encodeURIComponent(match.round)}`} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded text-xs font-bold ${own.won ? "bg-lime-400/10 text-lime-400" : "bg-ink-800 text-fog-400"}`}>{own.won ? "W" : "L"}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fog-100">vs {opponent?.name ?? "Unknown opponent"}</span><span className="mt-1 block text-xs text-fog-400">{match.tourTitle} · {match.round || "Round unavailable"}</span><span className="mt-1 block text-xs text-fog-500">{match.scheduledAt ?? "Date unavailable"} · AVG {average(own.average)}</span></span>
                  <span className="tnum shrink-0 font-bold text-fog-100">{own.sets}–{opponent?.sets ?? "—"}</span>
                </Link>
              </li>;
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900 sm:block">
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="!text-left">Date</th>
                  <th className="!text-left">Event</th>
                  <th className="!text-left">Round</th>
                  <th className="!text-left">Opponent</th>
                  <th>W/L</th>
                  <th>Sets</th>
                  <th>Avg</th>
                  <th className="hidden sm:table-cell">HR</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const own = match.sides.find((side) => side.memCode === memCode);
                  const opponent = match.sides.find((side) => side.memCode !== memCode);
                  if (!own) return null;
                  return (
                    <tr key={`${match.tourCode}-${match.pstCode}`} className="group relative">
                      <td className="!text-left tnum text-fog-400">
                        {match.scheduledAt ?? "—"}
                      </td>
                      <td className="!text-left">
                        <span className="block max-w-[280px] truncate text-[13px] text-fog-100">
                          {match.tourTitle}
                        </span>
                      </td>
                      <td className="!text-left text-fog-300">{match.round || "—"}</td>
                      <td className="!text-left font-medium text-fog-100 group-hover:text-lime-300">
                        {opponent?.name ?? "—"}
                      </td>
                      <td
                        className={`font-semibold ${own.won ? "text-lime-400" : "text-fog-500"}`}
                      >
                        {own.won ? "W" : "L"}
                      </td>
                      <td className="tnum font-semibold text-fog-100">
                        {own.sets}–{opponent?.sets ?? "—"}
                      </td>
                      <td className="tnum text-fog-300">{average(own.average)}</td>
                      <td className="hidden tnum text-fog-300 sm:table-cell">
                        {own.highRun ?? "—"}
                      </td>
                      <td className="p-0">
                        {/* The whole row opens the card: one overlay link, no client JS. */}
                        <Link
                          href={`/matches/${match.pstCode}?tour=${encodeURIComponent(match.tourCode)}&round=${encodeURIComponent(match.round)}`}
                          className="absolute inset-0"
                          aria-label={`${match.tourTitle}, ${match.round}: ${own.won ? "won" : "lost"} against ${opponent?.name ?? "unknown"}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {history.partial && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-fog-600">
              The search was capped partway through this season, so a busy name may have pushed
              some of these rows past the page limit. The table above shows everything that was
              retrieved.
            </p>
          )}

          <p className="mt-3 text-[11.5px] leading-relaxed text-fog-600">
            Rows are matched on member code, so a shared surname cannot leak another
            player's results in here.
          </p>
        </>
      )}
    </>
  );
}
