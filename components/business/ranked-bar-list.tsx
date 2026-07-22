import { assignChartColors } from "@/lib/utils/chart-colors";

export type RankedBarDatum = { label: string; value: number; sublabel?: string };

/** Ranked, proportional horizontal bar list — for "top N by value" breakdowns (products, categories). */
export function RankedBarList({
  data,
  valueFormatter = (v: number) => v.toLocaleString("en-PH"),
}: {
  data: RankedBarDatum[];
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-(--color-text-subtle)">No data in range</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const colors = assignChartColors(data.map((d) => d.label));

  return (
    <ol className="space-y-3">
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-right text-xs font-semibold text-(--color-text-subtle)">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm text-(--color-text)">
                {d.label}
                {d.sublabel && <span className="ml-1.5 text-xs text-(--color-text-subtle)">{d.sublabel}</span>}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-(--color-text)">
                {valueFormatter(d.value)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-border)">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: colors[i] }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
