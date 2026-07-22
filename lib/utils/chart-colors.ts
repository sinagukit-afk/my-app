/**
 * Fixed-order categorical hues for dashboard charts (gold/green/blue/red/plum).
 * Validated CVD-safe via the dataviz skill's validate_palette.js — do not
 * reorder or add ad-hoc hues; a 6th+ series folds into the "Other" bucket
 * instead of extending this list. Assign by series identity, not by rank.
 */
export const CHART_CATEGORICAL = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
] as const;

/** Neutral color for "Other"/catch-all buckets — deliberately outside the categorical set. */
export const CHART_OTHER_COLOR = "var(--color-text-subtle)";

/** Assigns fixed categorical colors in order, with any "Other"/"Uncategorized" label pinned to the neutral color. */
export function assignChartColors(labels: string[]): string[] {
  let slot = 0;
  return labels.map((label) => {
    if (/^other$|^uncategorized$/i.test(label.trim())) return CHART_OTHER_COLOR;
    const color = CHART_CATEGORICAL[slot % CHART_CATEGORICAL.length];
    slot += 1;
    return color;
  });
}
