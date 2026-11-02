import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { trackFailures } from "@/lib/pba/api";
import { getPlayerMatchHistory, getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import { normalizePlayer, statLeagueCode } from "@/lib/normalize";
import { average } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { EmptyState } from "@/components/ui/primitives";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ memCode: string }>;
  searchParams: Promise<{ season?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { memCode } = await params;
  const raw = await getPlayer(memCode);
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

  const loaded = await trackFailures(async () => {
    const [raw, seasons, currentSeason] = await Promise.all([
      getPlayer(memCode),
      getSeasonList(),
      getCurrentSeason(),
    ]);
    if (!raw) return null;

    const player = normalizePlayer(raw);
    const seasonCode =
      seasonParam && seasons.some((s) => s.SeasonCode === seasonParam)
        ? seasonParam
        : currentSeason.SeasonCode;

    const history = await getPlayerMatchHistory({
      memCode,
      nameEn: raw.PlayerNameEN,
      nameEnShort: raw.PlayerNameENShort,
      seasonCode,
      pbaType: statLeagueCode(player.league),
    });

    return { player, seasons, seasonCode, history, failures: getRequestFailures() };
  });

  if (!loaded) notFound();
  const { player, seasons, seasonCode, history, failures } = loaded;

  // The search streams each tour newest round first; newest tour first on top
  // of that keeps the table strictly newest first without a trustworthy date.
  const matches = [...history.matches].sort(
    (a, b) => (Number(b.tourCode) || 0) - (Number(a.tourCode) || 0),
  );
  const everyTourFailed = history.toursSearched > 0 && history.toursFailed === history.toursSearched;

  return (
    <>
      <PageHeader
        failures={failures}
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
                ? `The scoring terminal holds no match for ${player.name} in this season. Try an earlier season above.`
                : "The search terminal matches Latin-script names only, and this player's record carries no English name to search for."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[14px] border border-ink-750 bg-ink-900">
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
              player&apos;s results in here.
            </p>
          </>
        )}
      </div>
    </>
  );
}
