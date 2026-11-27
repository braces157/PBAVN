import Link from "next/link";
import { grouped, percent } from "@/lib/format";
import type { TeamStanding } from "@/lib/normalize";
import { TeamLogo } from "@/components/ui/media";
import { RankBadge, cn } from "@/components/ui/primitives";

export function StandingsTable({
  rows,
  limit,
  className,
  compact = false,
}: {
  rows: TeamStanding[];
  limit?: number;
  className?: string;
  compact?: boolean;
}) {
  const visible = typeof limit === "number" ? rows.slice(0, limit) : rows;
  const hasDraws = visible.some((team) => team.draws > 0);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="stat-table">
        <thead>
          <tr>
            <th scope="col" className="!w-10">#</th>
            <th scope="col" className="!text-left">Club</th>
            <th scope="col" title="Match points: 4–0/1/2 win = 3 pts, 4–3 win = 2 pts, 3–4 loss = 1 pt">Pts</th>
            <th scope="col" title="Matches won">W</th>
            {!compact && hasDraws && <th scope="col" className="hidden sm:table-cell" title="Matches drawn (legacy 6-set format)">D</th>}
            <th scope="col" title="Matches lost">L</th>
            {!compact && <th scope="col" title="Sets won – lost">Sets</th>}
            {!compact && <th scope="col" className="hidden md:table-cell" title="Set win/loss ratio (tiebreaker)">Set ratio</th>}
            {!compact && <th scope="col" className="hidden lg:table-cell" title="Point win/loss ratio (tiebreaker)">Point ratio</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map((team, index) => (
            <tr key={team.code || index} className="group">
              <td>
                <RankBadge rank={team.rank || index + 1} size="sm" />
              </td>
              <td className="!text-left">
                <Link
                  href={`/teams/${encodeURIComponent(team.code)}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-[var(--pba)]"
                >
                  <TeamLogo src={team.logo} name={team.name} size="xs" />
                  <span className="block min-w-0 max-w-[165px] truncate text-sm font-medium text-foreground group-hover:text-[var(--pba)] sm:max-w-none">
                    <span className="sm:hidden">{team.shortName || team.name}</span>
                    <span className="hidden sm:inline">{team.name}</span>
                  </span>
                </Link>
              </td>
              <td className="mono font-semibold text-foreground">{team.points}</td>
              <td className="mono text-muted-foreground">{team.wins}</td>
              {!compact && hasDraws && <td className="mono hidden text-muted-foreground sm:table-cell">{team.draws}</td>}
              <td className="mono text-muted-foreground">{team.losses}</td>
              {!compact && (
                <td className="mono text-muted-foreground">
                  {team.setWins}–{team.setLosses}
                </td>
              )}
              {!compact && (
                <td className="mono hidden text-muted-foreground md:table-cell">
                  {team.setRatio ? team.setRatio.toFixed(3) : "—"}
                </td>
              )}
              {!compact && (
                <td className="mono hidden text-muted-foreground lg:table-cell">
                  {team.pointRatio ? team.pointRatio.toFixed(3) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!compact && !hasDraws && visible.length > 0 && (
        <p className="border-t border-border/60 bg-secondary/20 px-4 py-2 text-[11px] text-muted-foreground">
          Scoring: 4–0/4–1/4–2 win = 3 pts · 4–3 win = 2 pts · 3–4 loss = 1 pt · Tiebreakers: Set ratio → Point ratio.
        </p>
      )}
    </div>
  );
}

export function TeamStatGrid({ team }: { team: TeamStanding }) {
  const items = [
    { label: "Win rate", value: team.matches > 0 && team.winRate === 0 ? "0.0%" : percent(team.winRate) },
    { label: "Sets won", value: grouped(team.setWins) },
    { label: "Sets lost", value: grouped(team.setLosses) },
    { label: "Points for", value: grouped(team.pointsFor) },
    { label: "Points against", value: grouped(team.pointsAgainst) },
    { label: "Team average", value: team.average ? team.average.toFixed(3) : "—" },
    { label: "High run", value: grouped(team.highRun) },
    { label: "Matches", value: grouped(team.matches) },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <p className="mono mt-1 text-lg font-semibold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
