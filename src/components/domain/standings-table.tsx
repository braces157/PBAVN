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
            <th scope="col" className="!w-10">#</th>
            <th scope="col" className="!text-left">Club</th>
            <th scope="col">Pts</th>
            <th scope="col">W</th>
            {!compact && <th scope="col" className="hidden sm:table-cell">D</th>}
            <th scope="col">L</th>
            {!compact && <th scope="col" className="hidden md:table-cell">Sets</th>}
            {!compact && <th scope="col" className="hidden lg:table-cell">Set ratio</th>}
            {!compact && <th scope="col" className="hidden lg:table-cell">Point ratio</th>}
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
                  className="flex items-center gap-2.5 transition-colors hover:text-carom-300"
                >
                  <TeamLogo src={team.logo} name={team.name} size="xs" />
                  <span className="block min-w-0 max-w-[150px] truncate text-[13px] font-semibold text-fog-100 group-hover:text-carom-300 sm:max-w-none">
                    {team.name}
                  </span>
                </Link>
              </td>
              <td className="font-display font-bold text-carom-400">{team.points}</td>
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
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-ink-750 bg-ink-750 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-ink-900 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-fog-500">{item.label}</p>
          <p className="tnum mt-1 font-display text-base font-bold text-fog-100">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
