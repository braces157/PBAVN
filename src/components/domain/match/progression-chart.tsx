import { cn } from "@/components/ui/primitives";

const WIDTH = 640;
const HEIGHT = 188;
const PAD = { left: 32, right: 12, top: 14, bottom: 26 };

export interface ProgressionSeries {
  name: string;
  values: number[];
  tone: string;
}

export function ProgressionChart({
  series,
  target,
  innings,
}: {
  series: ProgressionSeries[];
  target: number | null;
  innings: number;
}) {
  const values = series.flatMap((line) => line.values);
  if (innings < 2 || values.length === 0) return null;

  const ceiling = Math.max(target ?? 0, ...values, 1);
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const x = (inning: number) => PAD.left + (inning / innings) * innerWidth;
  const y = (score: number) => PAD.top + innerHeight - (score / ceiling) * innerHeight;

  const path = (line: number[]): string => {
    let d = `M ${x(0)} ${y(0)} L ${x(1)} ${y(0)}`;
    for (let index = 0; index < line.length; index += 1) {
      d += ` L ${x(index + 1)} ${y(line[index])}`;
      const next = line[index + 1];
      if (next === undefined) break;
      d += ` L ${x(index + 1)} ${y(next)}`;
    }
    return d;
  };

  const ticks = [...new Set([1, Math.round(innings / 3), Math.round((innings * 2) / 3), innings])]
    .filter((tick) => tick >= 1 && tick <= innings)
    .sort((a, b) => a - b);

  const summary = series
    .map((line) => `${line.name} ${line.values.at(-1) ?? 0}`)
    .join(", ");

  return (
    <figure className="mt-1 rounded-[6px] border border-ink-800 bg-ink-950/70 p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Score by inning. ${summary}.`}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(ceiling * fraction)}
            y2={y(ceiling * fraction)}
            stroke="currentColor"
            className="text-ink-750"
            strokeWidth={1}
            strokeDasharray={fraction === 0 ? undefined : "3 5"}
          />
        ))}

        <text
          x={PAD.left - 7}
          y={y(ceiling) + 3}
          textAnchor="end"
          className="fill-fog-550 text-[9.5px]"
        >
          {ceiling}
        </text>
        <text x={PAD.left - 7} y={y(0) + 3} textAnchor="end" className="fill-fog-550 text-[9.5px]">
          0
        </text>

        {ticks.map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={HEIGHT - 7}
            textAnchor="middle"
            className="fill-fog-550 text-[9.5px]"
          >
            {tick}
          </text>
        ))}

        {series.map((line) => (
          <path
            key={line.name}
            d={path(line.values)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            className={line.tone}
          />
        ))}

        {series.map((line) => (
          <circle
            key={`${line.name}-end`}
            cx={x(innings)}
            cy={y(line.values.at(-1) ?? 0)}
            r={3}
            fill="currentColor"
            className={line.tone}
          />
        ))}
      </svg>
      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-fog-450">
        <span className="text-fog-550">Innings (x-axis)</span>
        {series.map((line) => (
          <span key={line.name} className="inline-flex items-center gap-1.5 font-medium text-fog-200">
            <span className={cn("inline-block h-[2.5px] w-4 rounded bg-current", line.tone)} />
            {line.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
