import { CHART_CATEGORICAL } from "@/lib/utils/chart-colors";

export type GroupedBarSeries = { name: string; value: number };
export type GroupedBarDatum = { label: string; series: GroupedBarSeries[] };

/**
 * Grouped bar chart — multiple same-unit series per category, one shared axis.
 * Used for Monthly Sales vs. Gross Profit (both ₱); never mix units on one chart.
 */
export function GroupedBarChart({
  data,
  seriesNames,
  height = 200,
  valueFormatter = (v: number) => v.toLocaleString("en-PH"),
}: {
  data: GroupedBarDatum[];
  seriesNames: string[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-(--color-text-subtle)" style={{ height }}>
        No data in range
      </div>
    );
  }

  const max = Math.max(...data.flatMap((d) => d.series.map((s) => s.value)), 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {seriesNames.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: CHART_CATEGORICAL[i % CHART_CATEGORICAL.length] }}
              aria-hidden="true"
            />
            {name}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
            <div className="flex h-full w-full items-end justify-center gap-[2px]">
              {d.series.map((s, si) => (
                <div
                  key={s.name}
                  title={`${d.label} — ${s.name}: ${valueFormatter(s.value)}`}
                  className="min-w-[3px] flex-1 rounded-t-[4px] transition-[height]"
                  style={{
                    height: `${Math.max((s.value / max) * 100, s.value > 0 ? 2 : 0)}%`,
                    backgroundColor: CHART_CATEGORICAL[si % CHART_CATEGORICAL.length],
                  }}
                />
              ))}
            </div>
            <span className="w-full truncate text-center text-[10px] text-(--color-text-subtle)">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
