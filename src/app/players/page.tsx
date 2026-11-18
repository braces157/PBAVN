import type { Metadata } from "next";
import Link from "next/link";
import { getPlayers } from "@/lib/pba/api";
import { getRequestFailures, trackFailures } from "@/lib/pba/failures";
import type { RawPlayer } from "@/lib/pba/types";
import { getCurrentSeason, seasonLabel } from "@/lib/pba/service";
import { normalizePlayer, leagueByCode, leagueShort, PLAYER_LEAGUES, winRate, type Player } from "@/lib/normalize";
import { average, grouped, wonCompact, percent } from "@/lib/format";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { NationPlate, PlayerAvatar } from "@/components/ui/media";
import { Chip, EmptyState, Pagination, RankBadge, cn } from "@/components/ui/primitives";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Players",
  description:
    "Search every registered PBA and LPBA 3-cushion professional — averages, high runs, win rates, and prize money.",
};

const INITIALS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

type SortOption = "rank" | "avg" | "hr" | "name";
const SORT_LABELS: Record<SortOption, string> = {
  rank: "Rank",
  avg: "Average",
  hr: "High run",
  name: "A–Z",
};

interface PageProps {
  searchParams: Promise<{ league?: string; q?: string; initial?: string; sort?: string; page?: string }>;
}

function squeeze(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function searchDirectoryList(rows: RawPlayer[], query: string): RawPlayer[] {
  const term = squeeze(query);
  const hasHangul = /[가-힣]/.test(term);
  if (!term || (!hasHangul && term.length < 2)) return [];

  return rows.filter((player) => {
    const english = squeeze(player.PlayerNameEN || "");
    const korean = squeeze(player.PlayerNameKO || "");
    if (english.includes(term) || korean.includes(term)) return true;
    const family = squeeze((player.PlayerNameEN || "").split(/\s+/).pop() ?? "");
    return family.startsWith(term);
  });
}

function sortPlayers(rows: RawPlayer[], sort: SortOption): RawPlayer[] {
  return [...rows].sort((a, b) => {
    if (sort === "avg") {
      return (Number(b.Average) || 0) - (Number(a.Average) || 0) || (Number(b.Win) || 0) - (Number(a.Win) || 0);
    }
    if (sort === "hr") {
      return (Number(b.HR) || 0) - (Number(a.HR) || 0) || (Number(b.Average) || 0) - (Number(a.Average) || 0);
    }
    if (sort === "name") {
      return (a.PlayerNameEN || a.PlayerNameKO || "").localeCompare(b.PlayerNameEN || b.PlayerNameKO || "");
    }
    // Default "rank" order: ranked players first, then highest prize / average
    const ra = Number(a.PrizeRank) > 0 ? Number(a.PrizeRank) : 999_999;
    const rb = Number(b.PrizeRank) > 0 ? Number(b.PrizeRank) : 999_999;
    if (ra !== rb) return ra - rb;
    const pa = Number(a.Prize) || 0;
    const pb = Number(b.Prize) || 0;
    if (pa !== pb) return pb - pa;
    return (Number(b.Average) || 0) - (Number(a.Average) || 0);
  });
}

export default async function PlayersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const explicitLeague =
    params.league && PLAYER_LEAGUES.some((l) => l.code === params.league) ? params.league : undefined;
  const league = explicitLeague ?? (query ? "" : "PBA1");
  const rawInitial = (params.initial ?? "").toUpperCase();
  const initial = INITIALS.includes(rawInitial) ? rawInitial : "";
  const requestedSort = params.sort;
  const sort: SortOption =
    requestedSort && Object.prototype.hasOwnProperty.call(SORT_LABELS, requestedSort)
      ? (requestedSort as SortOption)
      : initial
        ? "name"
        : "rank";
  const rawPage = Number(params.page ?? 1);
  const requestedPage = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = 24;

  const result = await trackFailures(async () => {
    const [season, data] = await Promise.all([
      getCurrentSeason(),
      query
        ? getPlayers({ page: 1, pageSize: 2000 }).then((directory) => {
            const hits = sortPlayers(
              searchDirectoryList(directory.list, query).filter(
                (player) => !league || player.LeagueCode === league,
              ),
              sort,
            );
            const pageCount = Math.max(1, Math.ceil(hits.length / pageSize));
            const page = Math.min(requestedPage, pageCount);
            const start = (page - 1) * pageSize;
            return { list: hits.slice(start, start + pageSize), total: hits.length, page, pageCount };
          })
        : sort === "name"
          ? getPlayers({
              page: requestedPage,
              pageSize,
              leagueCode: league,
              name: "",
              initial,
            }).then(async (browsed) => {
              const pageCount = Math.max(1, Math.ceil(browsed.total / pageSize));
              const page = Math.min(requestedPage, pageCount);
              if (page !== requestedPage) {
                const clamped = await getPlayers({
                  page,
                  pageSize,
                  leagueCode: league,
                  name: "",
                  initial,
                });
                return { list: clamped.list, total: clamped.total, page, pageCount };
              }
              return { list: browsed.list, total: browsed.total, page, pageCount };
            })
          : getPlayers({ page: 1, pageSize: 2000 }).then((directory) => {
              const scoped = sortPlayers(
                directory.list.filter(
                  (player) =>
                    (!league || player.LeagueCode === league) &&
                    (!initial || (player.PlayerNameEN || "").trim().toUpperCase().startsWith(initial)),
                ),
                sort,
              );
              const pageCount = Math.max(1, Math.ceil(scoped.length / pageSize));
              const page = Math.min(requestedPage, pageCount);
              const start = (page - 1) * pageSize;
              return { list: scoped.slice(start, start + pageSize), total: scoped.length, page, pageCount };
            }),
    ]);
    return { season, ...data, failures: getRequestFailures() };
  });

  const { season, list, total, page, pageCount, failures } = result;
  const players = list.map(normalizePlayer);

  const baseParams = {
    league: explicitLeague ?? (query ? undefined : league),
    q: query || undefined,
    initial: initial || undefined,
    sort: sort !== "rank" ? sort : undefined,
  };

  return (
    <>
      <PageHeader
        failures={failures}
        eyebrow="Directory"
        title="Players"
        description={
          query
            ? `${grouped(total)} matches for “${query}”`
            : `${grouped(total)} professionals registered for ${seasonLabel(season)}`
        }
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterRow
              label="Circuit"
              basePath="/players"
              paramKey="league"
              active={league}
              params={{ q: query || undefined, initial: initial || undefined, sort: baseParams.sort }}
              options={[
                ...(query ? [{ value: "", label: "All circuits" }] : []),
                ...PLAYER_LEAGUES.map((l) => ({ value: l.code, label: l.name })),
              ]}
            />

            <form action="/players" className="flex items-center gap-1.5">
              {explicitLeague && <input type="hidden" name="league" value={explicitLeague} />}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search name (EN / KO)…"
                className="field w-52 sm:w-64"
                aria-label="Search players"
              />
              <button
                type="submit"
                className="press rounded-[3px] bg-[var(--nav)] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--link)]"
              >
                Search
              </button>
              {query && (
                <Link
                  href={explicitLeague ? `/players?league=${explicitLeague}` : "/players"}
                  className="px-1.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--link)]"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterRow
              label="Sort"
              basePath="/players"
              paramKey="sort"
              active={sort}
              params={{ league, q: query || undefined, initial: initial || undefined }}
              options={(Object.keys(SORT_LABELS) as SortOption[]).map((key) => ({
                value: key,
                label: SORT_LABELS[key],
              }))}
            />

            {!query && (
              <div className="flex flex-wrap items-center gap-0.5">
                <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.08em] text-fog-500">
                  Index
                </span>
                <Link
                  href={`/players?league=${league}`}
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded px-1.5 text-[11px] font-semibold transition-colors",
                    !initial ? "bg-carom-400/15 text-carom-300" : "text-fog-450 hover:bg-ink-850 hover:text-fog-100",
                  )}
                >
                  All
                </Link>
                {INITIALS.map((letter) => (
                  <Link
                    key={letter}
                    href={`/players?league=${league}&initial=${letter}&sort=name`}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded text-[11px] font-semibold transition-colors",
                      initial === letter
                        ? "bg-carom-400/15 text-carom-300"
                        : "text-fog-450 hover:bg-ink-850 hover:text-fog-100",
                    )}
                  >
                    {letter}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        {players.length === 0 ? (
          <EmptyState
            title="No players matched"
            description="Try at least 2 Latin characters (or 1 Korean character), or reset the filters."
            action={
              <Link
                href="/players"
                className="mt-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-[12px] font-semibold text-fog-200 hover:border-carom-400/50 hover:text-carom-300"
              >
                Reset
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-[12px] text-fog-450">
                Showing{" "}
                <span className="tnum font-semibold text-fog-100">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                </span>{" "}
                of <span className="tnum font-semibold text-fog-100">{grouped(total)}</span>
              </p>
              <p className="hidden text-[11px] text-fog-550 sm:block">
                Sorted by {SORT_LABELS[sort]}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                if (baseParams.sort) search.set("sort", baseParams.sort);
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
      className="surface card-hover group flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3.5">
        <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Chip tone={league.tone} className="!px-1.5 !py-0 !text-[9px]">
                {leagueShort(player.league)}
              </Chip>
              <NationPlate code={player.nation} />
            </div>
            {player.prizeRank > 0 && <RankBadge rank={player.prizeRank} size="sm" />}
          </div>
          <p className="mt-1.5 truncate font-display text-[14px] font-bold text-fog-100 group-hover:text-carom-300">
            {player.name}
          </p>
          {player.nameKo && player.nameKo !== player.name && (
            <p className="truncate text-[11px] text-fog-500">{player.nameKo}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-ink-800 border-t border-ink-800 bg-ink-850/40 text-center">
        <div className="px-1.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-fog-550">AVG</p>
          <p className="tnum mt-0.5 text-[11.5px] font-bold text-fog-100">{average(player.average)}</p>
        </div>
        <div className="px-1.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-fog-550">HR</p>
          <p className="tnum mt-0.5 text-[11.5px] font-semibold text-fog-200">{player.highRun || "—"}</p>
        </div>
        <div className="px-1.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-fog-550">W–L</p>
          <p
            title={player.wins || player.losses ? `${percent(rate, 0)} win rate` : undefined}
            className="tnum mt-0.5 whitespace-nowrap text-[11px] font-semibold text-fog-200"
          >
            {player.wins || player.losses ? `${player.wins}–${player.losses}` : "—"}
          </p>
        </div>
        <div className="px-1.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-fog-550">Prize</p>
          <p className="tnum mt-0.5 text-[11.5px] font-bold text-carom-300">
            {wonCompact(player.prize)}
          </p>
        </div>
      </div>
    </Link>
  );
}
