import { assignChartColors } from "@/lib/utils/chart-colors";

export type DonutDatum = { label: string; value: number };

/** Simple presentational donut chart with an always-visible legend (doubles as the table view). */
export function DonutChart({
  data,
  size = 160,
  thickness = 20,
  valueFormatter = (v: number) => v.toLocaleString("en-PH"),
  centerLabel,
}: {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  valueFormatter?: (value: number) => string;
  centerLabel?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0 || total <= 0) {
    return (
      <div className="flex items-center justify-center text-sm text-(--color-text-subtle)" style={{ height: size }}>
        No data in range
      </div>
    );
  }

  const colors = assignChartColors(data.map((d) => d.label));
  const r = 40;
  const circumference = 2 * Math.PI * r;

  const segments = data.reduce<{ pct: number; segLen: number; dashoffset: number }[]>((acc, d) => {
    const pct = d.value / total;
    const segLen = Math.max(pct * circumference, 0);
    const cumulative = acc.length > 0 ? acc[acc.length - 1].dashoffset + acc[acc.length - 1].segLen : 0;
    acc.push({ pct, segLen, dashoffset: cumulative });
    return acc;
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <g transform="rotate(-90 50 50)">
            {data.map((d, i) => {
              const { pct, segLen, dashoffset } = segments[i];
              return (
                <circle
                  key={`${d.label}-${i}`}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={colors[i]}
                  strokeWidth={thickness}
                  strokeDasharray={`${segLen} ${circumference - segLen}`}
                  strokeDashoffset={-dashoffset}
                >
                  <title>
                    {d.label}: {valueFormatter(d.value)} ({(pct * 100).toFixed(1)}%)
                  </title>
                </circle>
              );
            })}
          </g>
        </svg>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-(--color-text-subtle)">{centerLabel}</span>
            <span className="text-sm font-semibold text-(--color-text)">{valueFormatter(total)}</span>
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={`${d.label}-legend-${i}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[i] }}
                aria-hidden="true"
              />
              <span className="truncate text-(--color-text)">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-(--color-text-muted)">
              {valueFormatter(d.value)} · {((d.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
