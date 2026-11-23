import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { trackFailures } from "@/lib/pba/api";
import { getRequestFailures } from "@/lib/pba/failures";
import { getPlayerCached, getPlayerMatchHistory, getCurrentSeason, getSeasonList } from "@/lib/pba/service";
import { normalizePlayer, statLeagueCode } from "@/lib/normalize";
import { average } from "@/lib/format";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { DataStatus } from "@/components/site/data-status";
import { EmptyState } from "@/components/ui/primitives";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ memCode: string }>;
  searchParams: Promise<{ season?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { memCode } = await params;
  const raw = await getPlayerCached(memCode);
  if (!raw) return { title: "Match history" };
  const player = normalizePlayer(raw);
  const title = `${player.name} — Match history`;
  const description = `${player.name} — every recorded individual-tour match, season by season, each linked to its turn-by-turn card.`;
  return {
    title,
    description,
    alternates: { canonical: `/players/${encodeURIComponent(player.code)}/matches` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function HistorySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4" aria-hidden="true">
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <span className="h-3 w-14 rounded bg-secondary" />
            <span className="h-3 w-1/3 rounded bg-secondary" />
            <span className="h-3 w-16 rounded bg-secondary" />
            <span className="h-3 w-20 rounded bg-secondary" />
            <span className="h-3 w-8 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function HistorySection({
  memCode,
  playerName,
  nameEn,
  nameEnShort,
  seasonCode,
  pbaType,
}: {
  memCode: string;
  playerName: string;
  nameEn: string | null | undefined;
  nameEnShort: string | null | undefined;
  seasonCode: string;
  pbaType: string;
}) {
  const { history, failures } = await trackFailures(async () => {
    const history = await getPlayerMatchHistory({
      memCode,
      nameEn,
      nameEnShort,
      seasonCode,
      pbaType,
    });
    return { history, failures: getRequestFailures() };
  });

  const matches = history.matches;
  const everyTourFailed = history.toursSearched > 0 && history.toursFailed === history.toursSearched;

  return (
    <>
      <DataStatus failures={failures} className="mb-4" />
      {everyTourFailed ? (
        <EmptyState
          title="The scoring terminal did not answer"
          description="None of the season's tours could be searched. Please retry."
        />
      ) : matches.length === 0 && failures.length > 0 ? (
        <EmptyState
          title="This season could not be read completely"
          description="The data service did not answer for every read, so an empty table here is not proof of zero matches."
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
              ? `The scoring terminal holds no match for ${playerName} in this season. Try an earlier season above.`
              : "The search terminal matches Latin-script names only, and this player's record carries no English name."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="stat-table">
              <thead>
                <tr>
                  <th scope="col" className="!text-left">Date</th>
                  <th scope="col" className="!text-left">Event</th>
                  <th scope="col" className="!text-left">Round</th>
                  <th scope="col" className="!text-left">Opponent</th>
                  <th scope="col">W/L</th>
                  <th scope="col">Sets</th>
                  <th scope="col">Avg</th>
                  <th scope="col" className="hidden sm:table-cell">HR</th>
                  <th scope="col" className="!text-right">Card</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const own = match.sides.find((side) => side.memCode === memCode);
                  const opponent = match.sides.find((side) => side.memCode !== memCode);
                  if (!own) return null;
                  const href = `/matches/${match.pstCode}?tour=${encodeURIComponent(match.tourCode)}&round=${encodeURIComponent(match.round)}`;
                  return (
                    <tr key={`${match.tourCode}-${match.pstCode}`} className="group">
                      <td className="!text-left font-mono text-xs tabular-nums text-muted-foreground">
                        {match.scheduledAt ?? "—"}
                      </td>
                      <td className="!text-left">
                        <Link
                          href={href}
                          className="block max-w-[280px] truncate text-[13px] font-medium text-foreground hover:underline"
                        >
                          {match.tourTitle}
                        </Link>
                      </td>
                      <td className="!text-left text-xs text-muted-foreground">{match.round || "—"}</td>
                      <td className="!text-left text-[13px] font-medium text-foreground">
                        <Link href={href} className="hover:underline">
                          {opponent?.name ?? "—"}
                        </Link>
                      </td>
                      <td
                        className={`font-mono font-semibold ${own.won ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                      >
                        {own.won ? "W" : "L"}
                      </td>
                      <td className="font-mono font-semibold tabular-nums text-foreground">
                        {own.sets}–{opponent?.sets ?? "—"}
                      </td>
                      <td className="font-mono tabular-nums text-muted-foreground">{average(own.average)}</td>
                      <td className="hidden font-mono tabular-nums text-muted-foreground sm:table-cell">
                        {own.highRun ?? "—"}
                      </td>
                      <td className="!text-right">
                        <Link
                          href={href}
                          aria-label={`${match.tourTitle}, ${match.round}: ${own.won ? "won" : "lost"} against ${opponent?.name ?? "unknown"}`}
                          className="inline-flex items-center justify-end text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {history.partial && (
            <p className="mt-3 text-xs text-muted-foreground">
              The search was capped partway through this season, so a common surname may have pushed some rows past the page limit.
            </p>
          )}
        </>
      )}
    </>
  );
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
        description={
          player.nameKo && player.nameKo !== player.name
            ? `${player.nameKo} · Individual-tour matches in the selected season`
            : "Individual-tour matches in the selected season"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <Link
            href={`/players/${memCode}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:no-underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to profile
          </Link>
        </div>
      </PageHeader>

      <div className="wrap py-5">
        <Suspense key={`${memCode}-${seasonCode}`} fallback={<HistorySkeleton />}>
          <HistorySection
            memCode={memCode}
            playerName={player.name}
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
