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
import { FollowButton } from "@/components/ui/follow-button";
import { Chip, EmptyState, Pagination, RankBadge, cn } from "@/components/ui/primitives";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Players",
  description:
    "Search every registered PBA and LPBA 3-cushion professional — averages, high runs, win rates, and prize money.",
};

const INITIALS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const VALID_PLAYER_LEAGUES = new Set([...PLAYER_LEAGUES.map((l) => l.code), "PBA9", "LPBA9"]);

type SortOption = "rank" | "prize" | "winRate" | "avg" | "hr" | "name";
const SORT_LABELS: Record<SortOption, string> = {
  rank: "Rank",
  prize: "Prize",
  winRate: "Win %",
  avg: "Average",
  hr: "High run",
  name: "A–Z",
};

interface PageProps {
  searchParams: Promise<{ league?: string; q?: string; initial?: string; nation?: string; sort?: string; page?: string }>;
}

function squeeze(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
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
    if (sort === "prize") {
      return (Number(b.Prize) || 0) - (Number(a.Prize) || 0) || (Number(b.Average) || 0) - (Number(a.Average) || 0);
    }
    if (sort === "winRate") {
      const wa = Number(a.Win) || 0;
      const ta = wa + (Number(a.Lose) || 0);
      const wb = Number(b.Win) || 0;
      const tb = wb + (Number(b.Lose) || 0);
      const ra = ta >= 5 ? wa / ta : -1;
      const rb = tb >= 5 ? wb / tb : -1;
      return rb - ra || wb - wa;
    }
    if (sort === "avg") {
      return (Number(b.Average) || 0) - (Number(a.Average) || 0) || (Number(b.Win) || 0) - (Number(a.Win) || 0);
    }
    if (sort === "hr") {
      return (Number(b.HR) || 0) - (Number(a.HR) || 0) || (Number(b.Average) || 0) - (Number(a.Average) || 0);
    }
    if (sort === "name") {
      return (a.PlayerNameEN || a.PlayerNameKO || "").localeCompare(b.PlayerNameEN || b.PlayerNameKO || "");
    }
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
    params.league && VALID_PLAYER_LEAGUES.has(params.league) ? params.league : undefined;
  const league = explicitLeague ?? (query ? "" : "PBA1");
  const rawInitial = (params.initial ?? "").toUpperCase();
  const initial = INITIALS.includes(rawInitial) ? rawInitial : "";
  const nation = (params.nation ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
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
    const [season, directory] = await Promise.all([
      getCurrentSeason(),
      getPlayers({ page: 1, pageSize: 2000 }),
    ]);

    const leagueFiltered = directory.list.filter((player) => !league || player.LeagueCode === league);
    const nationCounts = new Map<string, number>();
    for (const p of leagueFiltered) {
      const code = (p.NationCode || "").trim().toUpperCase();
      if (!code) continue;
      nationCounts.set(code, (nationCounts.get(code) ?? 0) + 1);
    }
    const nations = [...nationCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8);

    const matched = query
      ? searchDirectoryList(leagueFiltered, query)
      : leagueFiltered.filter(
          (player) => !initial || (player.PlayerNameEN || "").trim().toUpperCase().startsWith(initial),
        );
    const nationScoped = nation
      ? matched.filter((player) => (player.NationCode || "").trim().toUpperCase() === nation)
      : matched;
    const sorted = sortPlayers(nationScoped, sort);
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const start = (page - 1) * pageSize;

    return {
      season,
      nations,
      list: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageCount,
      failures: getRequestFailures(),
    };
  });

  const { season, nations, list, total, page, pageCount, failures } = result;
  const players = list.map(normalizePlayer);

  const baseParams = {
    league: explicitLeague ?? (query ? undefined : league),
    q: query || undefined,
    initial: initial || undefined,
    nation: nation || undefined,
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
              params={{ q: query || undefined, initial: initial || undefined, nation: nation || undefined, sort: baseParams.sort }}
              options={[
                ...(query ? [{ value: "", label: "All circuits" }] : []),
                ...PLAYER_LEAGUES.map((l) => ({ value: l.code, label: l.name })),
                ...(explicitLeague === "PBA9" || explicitLeague === "LPBA9"
                  ? [{ value: explicitLeague, label: explicitLeague === "LPBA9" ? "LPBA Sponsor" : "PBA Sponsor" }]
                  : []),
              ]}
            />

            <form action="/players" className="flex items-center gap-1.5">
              {explicitLeague && <input type="hidden" name="league" value={explicitLeague} />}
              {nation && <input type="hidden" name="nation" value={nation} />}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search name (EN / KO)…"
                className="h-8 w-52 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
                aria-label="Search players"
              />
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Search
              </button>
              {query && (
                <Link
                  href={explicitLeague ? `/players?league=${explicitLeague}` : "/players"}
                  className="px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {nations.length > 1 && (
            <FilterRow
              label="Nation"
              basePath="/players"
              paramKey="nation"
              active={nation}
              params={{ league, q: query || undefined, initial: initial || undefined, sort: baseParams.sort }}
              options={[
                { value: "", label: "All nations" },
                ...nations.map(([code, count]) => ({ value: code, label: `${code} (${count})` })),
              ]}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterRow
              label="Sort"
              basePath="/players"
              paramKey="sort"
              active={sort}
              params={{ league, q: query || undefined, initial: initial || undefined, nation: nation || undefined }}
              options={(Object.keys(SORT_LABELS) as SortOption[]).map((key) => ({
                value: key,
                label: SORT_LABELS[key],
              }))}
            />

            {!query && (
              <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto py-0.5">
                <span className="mr-1.5 shrink-0 text-xs font-medium text-muted-foreground">Index</span>
                <Link
                  href={`/players?league=${league}${nation ? `&nation=${nation}` : ""}`}
                  className={cn(
                    "grid h-7 min-w-7 shrink-0 place-items-center rounded-md px-2 text-[11px] font-medium transition-colors hover:no-underline",
                    !initial
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  All
                </Link>
                {INITIALS.map((letter) => (
                  <Link
                    key={letter}
                    href={`/players?league=${league}${nation ? `&nation=${nation}` : ""}&initial=${letter}&sort=name`}
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-md font-mono text-[11px] font-medium transition-colors hover:no-underline",
                      initial === letter
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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

      <div className="wrap py-6">
        {players.length === 0 ? (
          <EmptyState
            title="No players matched"
            description="Try at least 2 Latin characters (or 1 Korean character), or reset the filters."
            action={
              <Link
                href="/players"
                className="mt-1 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:no-underline"
              >
                Reset
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                </span>{" "}
                of <span className="font-mono font-semibold tabular-nums text-foreground">{grouped(total)}</span>
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Career stats shown on cards · Sorted by {SORT_LABELS[sort]}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                if (baseParams.nation) search.set("nation", baseParams.nation);
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
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-3 p-4">
        <Link href={`/players/${player.code}`} className="flex min-w-0 flex-1 items-center gap-3 hover:no-underline">
          <PlayerAvatar path={player.photoPath} src={player.photo} name={player.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Chip tone={league.tone} className="!px-1.5 !py-0 !text-[9.5px]">
                {leagueShort(player.league)}
              </Chip>
              <NationPlate code={player.nation} />
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold text-foreground group-hover:underline">
              {player.name}
            </p>
            {player.nameKo && player.nameKo !== player.name && (
              <p className="truncate text-xs text-muted-foreground">{player.nameKo}</p>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {player.prizeRank > 0 && <RankBadge rank={player.prizeRank} size="sm" />}
          <FollowButton
            player={{
              code: player.code,
              name: player.name,
              circuit: league.name,
              nation: player.nation,
            }}
            compact
          />
        </div>
      </div>

      <Link
        href={`/players/${player.code}`}
        title="Career totals"
        className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60 bg-secondary/40 text-center transition-colors hover:bg-secondary/70 hover:no-underline"
      >
        <div className="px-1.5 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Career AVG</p>
          <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground">
            {average(player.average)}
          </p>
        </div>
        <div className="px-1.5 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">HR</p>
          <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-foreground">
            {player.highRun || "—"}
          </p>
        </div>
        <div className="px-1.5 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Career W–L</p>
          <p
            title={player.wins || player.losses ? `${percent(rate, 0)} career win rate` : undefined}
            className="mt-0.5 whitespace-nowrap font-mono text-xs font-medium tabular-nums text-foreground"
          >
            {player.wins || player.losses ? `${player.wins}–${player.losses}` : "—"}
          </p>
        </div>
        <div className="px-1.5 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Career Prize</p>
          <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground">
            {wonCompact(player.prize)}
          </p>
        </div>
      </Link>
    </div>
  );
}
