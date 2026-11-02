import { cn } from "@/components/ui/primitives";

const WIDTH = 640;
const HEIGHT = 180;
const PAD = { left: 30, right: 10, top: 12, bottom: 24 };

export interface ProgressionSeries {
  name: string;
  /** Running score after each inning. */
  values: number[];
  /** Tailwind text colour class, so the stroke follows currentColor. */
  tone: string;
}

/**
 * Cumulative score after every inning, as a step chart.
 *
 * A step, not a line: the score only changes when an inning ends, and a
 * diagonal would imply points arriving mid-inning. The racing line is drawn to
 * the set's target so the gap to winning is legible at a glance.
 */
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
    // Start on the baseline, then step after each inning.
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
    <figure className="mt-3">
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
            className="text-ink-700"
            strokeWidth={1}
            strokeDasharray={fraction === 0 ? undefined : "3 5"}
          />
        ))}

        <text
          x={PAD.left - 6}
          y={y(ceiling) + 3}
          textAnchor="end"
          className="fill-fog-600 text-[9px]"
        >
          {ceiling}
        </text>
        <text x={PAD.left - 6} y={y(0) + 3} textAnchor="end" className="fill-fog-600 text-[9px]">
          0
        </text>

        {ticks.map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={HEIGHT - 6}
            textAnchor="middle"
            className="fill-fog-600 text-[9px]"
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
            strokeWidth={1.75}
            strokeLinejoin="round"
            className={line.tone}
          />
        ))}

        {series.map((line) => (
          <circle
            key={`${line.name}-end`}
            cx={x(innings)}
            cy={y(line.values.at(-1) ?? 0)}
            r={2.5}
            fill="currentColor"
            className={line.tone}
          />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-fog-600">
        <span>Innings along the bottom</span>
        {series.map((line) => (
          <span key={line.name} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block h-[2px] w-4 rounded", "bg-current", line.tone)} />
            {line.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
