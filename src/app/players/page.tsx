import type { Metadata } from "next";
import Link from "next/link";
import { getPlayers } from "@/lib/pba/api";
import type { RawPlayer } from "@/lib/pba/types";
import { getCurrentSeason, seasonLabel } from "@/lib/pba/service";
import { normalizePlayer, leagueByCode, PLAYER_LEAGUES, winRate, type Player } from "@/lib/normalize";
import { grouped, wonCompact, percent } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { InitialsPlate, NationPlate } from "@/components/ui/media";
import { SafeImage } from "@/components/ui/safe-image";
import { EmptyState, Pagination, RankBadge, cn } from "@/components/ui/primitives";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Players",
  description:
    "Search every registered PBA and LPBA professional — averages, high runs, win rates, bank-shot accuracy and prize money.",
};

const INITIALS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

interface PageProps {
  searchParams: Promise<{ league?: string; q?: string; initial?: string; page?: string }>;
}

/**
 * Upstream `playerNameStr` is a literal, hyphen-sensitive substring match, so
 * "Ga-young", "Gayoung" and "ga young" all miss the women's prize leader.
 * Search runs over the whole directory instead, comparing a form with every
 * separator removed so all three spellings agree.
 */
function squeeze(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function searchDirectoryList(rows: RawPlayer[], query: string): RawPlayer[] {
  const term = squeeze(query);
  if (term.length < 3) return [];

  return rows.filter((player) => {
    const english = squeeze(player.PlayerNameEN || "");
    const korean = squeeze(player.PlayerNameKO || "");
    if (english.includes(term) || korean.includes(term)) return true;
    // Family name alone: "cho" should find "Keon-hwi CHO".
    const family = squeeze((player.PlayerNameEN || "").split(/\s+/).pop() ?? "");
    return family.startsWith(term);
  });
}

export default async function PlayersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  // A search without an explicit circuit looks everywhere; a browse defaults to the top tier.
  const league = params.league ?? (query ? "" : "PBA1");
  const initial = (params.initial ?? "").toUpperCase();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 24;

  const season = await getCurrentSeason();

  // A search runs across every circuit; a plain browse stays scoped to one.
  let list: Awaited<ReturnType<typeof getPlayers>>["list"];
  let total: number;

  if (query) {
    const directory = await getPlayers({ page: 1, pageSize: 2000 });
    const hits = searchDirectoryList(directory.list, query).filter(
      (player) => !league || player.LeagueCode === league,
    );
    const start = (page - 1) * pageSize;
    list = hits.slice(start, start + pageSize);
    total = hits.length;
  } else {
    const browsed = await getPlayers({
      page,
      pageSize,
      leagueCode: league,
      name: "",
      initial,
    });
    list = browsed.list;
    total = browsed.total;
  }

  const players = list.map(normalizePlayer);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const baseParams = {
    league,
    q: query || undefined,
    initial: initial || undefined,
  };

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="The professionals"
        description={
          query
            ? `${grouped(total)} ${league ? PLAYER_LEAGUES.find((l) => l.code === league)?.name ?? league : "players across every circuit"} match “${query}”. Search ignores hyphens, accents and word order.`
            : `${grouped(total)} players registered on this circuit for ${seasonLabel(season)}. Averages are per-inning carom averages across all recorded matches.`
        }
      >
        <div className="flex flex-col gap-4">
          <FilterRow
            label="Circuit"
            basePath="/players"
            paramKey="league"
            active={league}
            params={{ q: query || undefined, initial: initial || undefined }}
            options={[
              ...(query ? [{ value: "", label: "All circuits" }] : []),
              ...PLAYER_LEAGUES.map((l) => ({ value: l.code, label: l.name })),
            ]}
          />

          <form action="/players" className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by name — English or Korean"
              className="field max-w-xs"
              aria-label="Search players"
            />
            <button
              type="submit"
              className="press rounded-md bg-lime-400 px-3.5 py-2 text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-lime-300"
            >
              Search
            </button>
            {query && (
              <Link
                href={`/players?league=${league}`}
                className="text-[12.5px] text-fog-500 transition-colors hover:text-fog-200"
              >
                Clear
              </Link>
            )}
          </form>

          {!query && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fog-600">
                Initial
              </span>
              <Link
                href={`/players?league=${league}`}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded text-[11.5px] font-medium transition-colors",
                  !initial ? "bg-lime-400/15 text-lime-300" : "text-fog-500 hover:bg-ink-800 hover:text-fog-200",
                )}
              >
                All
              </Link>
              {INITIALS.map((letter) => (
                <Link
                  key={letter}
                  href={`/players?league=${league}&initial=${letter}`}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded text-[11.5px] font-medium transition-colors",
                    initial === letter
                      ? "bg-lime-400/15 text-lime-300"
                      : "text-fog-500 hover:bg-ink-800 hover:text-fog-200",
                  )}
                >
                  {letter}
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        {players.length === 0 ? (
          <EmptyState
            title="No players matched"
            description="Try a different spelling, or clear the filters to browse the full directory."
            action={
              <Link
                href="/players"
                className="mt-1 rounded-md border border-ink-700 px-3 py-1.5 text-[12.5px] text-fog-300 hover:border-ink-500 hover:text-fog-100"
              >
                Reset
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-5 flex items-baseline justify-between">
              <p className="text-[12.5px] text-fog-500">
                Showing{" "}
                <span className="tnum text-fog-200">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                </span>{" "}
                of <span className="tnum text-fog-200">{grouped(total)}</span>
              </p>
              <p className="hidden text-[11.5px] text-fog-600 sm:block">
                Sorted A–Z by family name
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {players.map((player) => (
                <PlayerCard key={player.code} player={player} />
              ))}
            </div>

            <Pagination
              page={page}
              pageCount={pageCount}
              buildHref={(nextPage) => {
                const search = new URLSearchParams();
                if (baseParams.league) search.set("league", baseParams.league);
                if (baseParams.q) search.set("q", baseParams.q);
                if (baseParams.initial) search.set("initial", baseParams.initial);
                if (nextPage > 1) search.set("page", String(nextPage));
                const qs = search.toString();
                return qs ? `/players?${qs}` : "/players";
              }}
            />
          </>
        )}
      </div>
    </>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const league = leagueByCode(player.league);
  const rate = winRate(player);

  return (
    <Link
      href={`/players/${player.code}`}
      className="surface card-hover group overflow-hidden"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ink-800">
        <SafeImage
          path={player.photoPath}
          src={player.photo}
          width={360}
          alt=""
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
          fallback={<InitialsPlate name={player.name} />}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] backdrop-blur-sm",
              league.tone === "lime" && "border-lime-400/40 bg-ink-950/70 text-lime-300",
              league.tone === "rose" && "border-rose-450/40 bg-ink-950/70 text-rose-450",
              league.tone === "cyan" && "border-cyan-450/40 bg-ink-950/70 text-cyan-450",
              league.tone === "amber" && "border-amber-450/40 bg-ink-950/70 text-amber-450",
            )}
          >
            {player.league}
          </span>
        </div>

        {player.prizeRank > 0 && player.prizeRank <= 10 && (
          <div className="absolute right-2.5 top-2.5">
            <RankBadge rank={player.prizeRank} size="sm" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="truncate font-display text-[13.5px] font-bold leading-tight text-fog-100">
            {player.name}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <NationPlate code={player.nation} />
            <span className="tnum text-[10.5px] text-fog-400">AVG {player.average.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {player.wins === 0 && player.losses === 0 && player.draws === 0 && player.prize === 0 ? (
        <div className="border-t border-ink-800 px-3 py-2.5 text-center">
          <p className="text-[10.5px] text-fog-600">No recorded matches yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-ink-800 border-t border-ink-800 text-center">
          <div className="px-1 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fog-600">W–L</p>
            <p className="tnum mt-0.5 text-[11.5px] font-semibold text-fog-200">
              {player.wins}–{player.losses}
            </p>
          </div>
          <div className="px-1 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fog-600">Win%</p>
            <p className="tnum mt-0.5 text-[11.5px] font-semibold text-fog-200">{percent(rate, 0)}</p>
          </div>
          <div className="px-1 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fog-600">Prize</p>
            <p className="tnum mt-0.5 text-[11.5px] font-semibold text-lime-400">
              {wonCompact(player.prize)}
            </p>
          </div>
        </div>
      )}
    </Link>
  );
}
