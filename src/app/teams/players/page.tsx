import type { Metadata } from "next";
import Link from "next/link";
import { getTeamLeagueRounds, getTeamLeagueSeasons, getTeamPlayerStats } from "@/lib/pba/api";
import { getPlayerNameIndex, resolveOfficialTeamPlayer, teamLeagueTitle } from "@/lib/pba/service";
import { normalizeTeamPlayer, type TeamPlayer } from "@/lib/normalize";
import { percent, average, hasHangul } from "@/lib/format";
import { photoUrl } from "@/lib/photo";
import { FilterRow, PageHeader } from "@/components/domain/filter-bar";
import { DataTable, type CellValue, type TableColumn, type TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/primitives";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Team league player stats",
  description:
    "Every PBA Team League player ranked by average, win rate, high run and set record for the selected round.",
};

const SORT_ACCESSORS: Record<SortKey, (player: TeamPlayer) => number> = {
  average: (p) => p.average,
  winRate: (p) => p.winRate,
  highRun: (p) => p.highRun,
  points: (p) => p.pointsFor,
  matches: (p) => p.sets,
  bank: (p) => p.bankShotRate,
};

const SORT_LABELS: Record<SortKey, string> = {
  average: "Average",
  winRate: "Win rate",
  highRun: "High run",
  points: "Points",
  matches: "Sets played",
  bank: "Bank shot",
};

type SortKey = "average" | "winRate" | "highRun" | "points" | "matches" | "bank";

function columnsFor(): TableColumn[] {
  return [
    { id: "player", label: "Player", align: "left" },
    { id: "team", label: "Team", align: "left", shortLabel: "Team" },
    { id: "average", label: "Avg", numeric: true, defaultDirection: "desc" },
    { id: "winRate", label: "Win%", numeric: true, defaultDirection: "desc" },
    { id: "highRun", label: "HR", numeric: true, hideBelow: "sm", defaultDirection: "desc" },
    { id: "matches", label: "Sets", shortLabel: "Sets", numeric: true, hideBelow: "md", defaultDirection: "desc" },
    { id: "sets", label: "W–L", align: "right", hideBelow: "md" },
    { id: "singles", label: "Singles", align: "right", hideBelow: "lg" },
    { id: "bank", label: "Bank%", shortLabel: "Bank%", numeric: true, hideBelow: "xl", defaultDirection: "desc" },
  ];
}

function rowsFor(players: TeamPlayer[], seasonCode: string, roundCode: string): TableRow[] {
  return players.map((player) => {
    const teamHref = player.teamCode
      ? `/teams/${encodeURIComponent(player.teamCode)}?season=${encodeURIComponent(seasonCode)}&round=${encodeURIComponent(roundCode)}`
      : null;
    const cells: Record<string, CellValue> = {
      player: {
        kind: "person",
        href: `/players/${player.code}`,
        name: player.name,
        sub: `${player.nation}${player.isCaptain ? " · captain" : ""}`,
        photo: photoUrl(player.photoPath, 96) ?? player.photo,
      },
      team: teamHref ? { kind: "link", href: teamHref, text: player.team } : player.team,
      average: average(player.average),
      winRate: percent(player.winRate),
      highRun: player.highRun,
      matches: player.sets,
      sets: `${player.setWins}–${player.setLosses}`,
      singles: `${player.singlesWins}–${player.singlesLosses}`,
      bank: percent(player.bankShotRate),
    };
    return {
      key: player.code || `${player.name}-${player.team}`,
      href: player.code ? `/players/${player.code}` : undefined,
      linkLabel: `Open ${player.name}`,
      cells,
      sortValues: {
        average: player.average,
        winRate: player.winRate,
        highRun: player.highRun,
        matches: player.sets,
        bank: player.bankShotRate,
      },
    };
  });
}

interface PageProps {
  searchParams: Promise<{ season?: string; round?: string; sort?: string; team?: string }>;
}

export default async function TeamPlayersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const seasons = await getTeamLeagueSeasons();
  const season = seasons.find((s) => s.시즌코드 === params.season) ?? seasons[0] ?? null;

  if (!season) {
    return (
      <>
        <PageHeader eyebrow="Team league" title="Player Statistics" />
        <div className="mx-auto max-w-[1300px] px-3 py-10">
          <EmptyState title="No team league season published" />
        </div>
      </>
    );
  }

  const rounds = await getTeamLeagueRounds(season.리그코드);
  const round =
    rounds.find((r) => String(r.라운드코드) === params.round) ??
    rounds.find((r) => r.진행상황 === "진행중") ??
    rounds[0] ??
    null;
  const roundCode = round ? String(round.라운드코드) : "0";

  const raw = await getTeamPlayerStats({
    seasonCode: season.시즌코드,
    leagueCode: String(season.리그코드),
    roundCode,
  });

  const nameIndex = getPlayerNameIndex();
  const allPlayers = raw.map(normalizeTeamPlayer).map((p) => resolveOfficialTeamPlayer(p, nameIndex));
  const teams = [...new Set(allPlayers.map((p) => p.team))].sort();
  const teamFilter = params.team ?? "";
  const filtered = teamFilter ? allPlayers.filter((p) => p.team === teamFilter) : allPlayers;

  const sortKey: SortKey = params.sort && params.sort in SORT_ACCESSORS ? (params.sort as SortKey) : "average";
  const accessor = SORT_ACCESSORS[sortKey];
  const players = [...filtered].sort((a, b) => accessor(b) - accessor(a));

  const buildSortHref = (key: SortKey) => {
    const search = new URLSearchParams();
    search.set("season", season.시즌코드);
    search.set("round", roundCode);
    if (teamFilter) search.set("team", teamFilter);
    search.set("sort", key);
    return `/teams/players?${search.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Team league"
        title="Player Statistics"
        description={`${teamLeagueTitle(season.시즌명)}${round ? ` · Round ${round.라운드}` : ""} · ${allPlayers.length} players across ${teams.length} clubs`}
      >
        <div className="flex flex-col gap-2">
          <FilterRow
            label="Season"
            basePath="/teams/players"
            paramKey="season"
            active={season.시즌코드}
            params={{ round: roundCode, sort: sortKey, team: teamFilter || undefined }}
            options={seasons.map((s) => ({ value: s.시즌코드, label: s.시즌명 }))}
          />
          {rounds.length > 0 && (
            <FilterRow
              label="Round"
              basePath="/teams/players"
              paramKey="round"
              active={roundCode}
              params={{ season: season.시즌코드, sort: sortKey, team: teamFilter || undefined }}
              options={[...rounds]
                .sort((a, b) => a.라운드 - b.라운드)
                .map((r) => ({ value: String(r.라운드코드), label: `R${r.라운드}` }))}
            />
          )}
          {teams.length > 0 && (
            <FilterRow
              label="Team"
              basePath="/teams/players"
              paramKey="team"
              active={teamFilter}
              params={{ season: season.시즌코드, round: roundCode, sort: sortKey }}
              options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t, label: t }))]}
            />
          )}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1300px] px-3 py-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-fog-500">
            Rank by
          </span>
          {(Object.keys(SORT_ACCESSORS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={buildSortHref(key)}
              className={
                sortKey === key
                  ? "rounded-[6px] border border-carom-400/50 bg-carom-400/14 px-2.5 py-1 text-[11.5px] font-semibold text-carom-300"
                  : "rounded-[6px] border border-ink-750 bg-ink-900 px-2.5 py-1 text-[11.5px] font-semibold text-fog-400 transition-colors hover:border-ink-600 hover:text-fog-100"
              }
            >
              {SORT_LABELS[key]}
            </Link>
          ))}
          <span className="ml-auto hidden text-[11.5px] text-fog-500 sm:block">
            {players.length} of {allPlayers.length} players
          </span>
        </div>

        <DataTable
          payload={{
            columns: columnsFor(),
            rows: rowsFor(players, season.시즌코드, roundCode),
            initialSort: { id: sortKey, direction: "desc" },
            maxHeight: "76vh",
          }}
          empty="No players match these filters."
        />

        <p className="mt-2.5 text-[11px] text-fog-550">
          Averages combine singles, doubles and mixed-doubles sets for the selected round.
        </p>
      </div>
    </>
  );
}
