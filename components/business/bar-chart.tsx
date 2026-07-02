export type BarChartDatum = { label: string; value: number };

/** Simple presentational bar chart. No client state — pure render from props. */
export function BarChart({
  data,
  height = 160,
  valueFormatter = (v: number) => v.toLocaleString("en-PH"),
  maxLabels = 12,
}: {
  data: BarChartDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
  maxLabels?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-(--color-text-subtle)" style={{ height }}>
        No data in range
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const labelEvery = Math.ceil(data.length / maxLabels);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
          <div
            title={`${d.label}: ${valueFormatter(d.value)}`}
            className="w-full min-w-[3px] rounded-t-sm bg-(--color-primary) transition-[height]"
            style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%` }}
          />
          {i % labelEvery === 0 && (
            <span className="w-full truncate text-center text-[10px] text-(--color-text-subtle)">{d.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
