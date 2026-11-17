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

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="stat-table">
        <thead>
          <tr>
            <th className="!w-10">#</th>
            <th className="!text-left">Team</th>
            <th>Pts</th>
            <th>W</th>
            {!compact && <th className="hidden sm:table-cell">D</th>}
            <th>L</th>
            {!compact && <th className="hidden md:table-cell">Sets</th>}
            {!compact && <th className="hidden lg:table-cell">Set ratio</th>}
            {!compact && <th className="hidden lg:table-cell">Point ratio</th>}
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
                  className="flex items-center gap-2.5 transition-colors hover:text-lime-300"
                >
                  <TeamLogo src={team.logo} name={team.name} size="xs" />
                  <span className="block min-w-0 max-w-[150px] truncate text-[13px] font-medium text-fog-100 group-hover:text-lime-300 sm:max-w-none">
                    {team.name}
                  </span>
                </Link>
              </td>
              <td className="font-display font-bold text-lime-400">{team.points}</td>
              <td className="text-fog-200">{team.wins}</td>
              {!compact && <td className="hidden text-fog-400 sm:table-cell">{team.draws}</td>}
              <td className="text-fog-200">{team.losses}</td>
              {!compact && (
                <td className="hidden text-fog-400 md:table-cell">
                  {team.setWins}–{team.setLosses}
                </td>
              )}
              {!compact && (
                <td className="hidden text-fog-400 lg:table-cell">
                  {team.setRatio ? team.setRatio.toFixed(3) : "—"}
                </td>
              )}
              {!compact && (
                <td className="hidden text-fog-400 lg:table-cell">
                  {team.pointRatio ? team.pointRatio.toFixed(3) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Team-level stat block for a single club page. */
export function TeamStatGrid({ team }: { team: TeamStanding }) {
  const items = [
    { label: "Win rate", value: team.wins + team.losses + team.draws > 0 ? percent(100 * team.wins / (team.wins + team.losses + team.draws)) : "—" },
    { label: "Sets won", value: grouped(team.setWins) },
    { label: "Sets lost", value: grouped(team.setLosses) },
    { label: "Points for", value: grouped(team.pointsFor) },
    { label: "Points against", value: grouped(team.pointsAgainst) },
    { label: "Team average", value: team.average ? team.average.toFixed(3) : "—" },
    { label: "High run", value: grouped(team.highRun) },
    { label: "Matches", value: grouped(team.matches) },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-ink-900 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-600">{item.label}</p>
          <p className="tnum mt-1.5 font-display text-lg font-bold text-fog-100">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
