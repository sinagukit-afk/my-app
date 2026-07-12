const MONEY_DECIMALS = 2;
const QTY_DECIMALS = 3;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Rounds to at most 2 decimal places, matching the numeric(12,2) money columns. */
export function roundMoney(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? roundTo(n, MONEY_DECIMALS) : 0;
}

/** Rounds to at most 3 decimal places, matching the numeric(12,3) quantity columns. */
export function roundQty(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? roundTo(n, QTY_DECIMALS) : 0;
}

/** Formats a peso amount, always showing exactly 2 decimal places. */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `₱${safe.toLocaleString("en-PH", {
    minimumFractionDigits: MONEY_DECIMALS,
    maximumFractionDigits: MONEY_DECIMALS,
  })}`;
}

/** Formats a quantity, showing at most 3 decimal places (no trailing zeros). */
export function formatQty(value: number | string | null | undefined): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en", { maximumFractionDigits: QTY_DECIMALS }).format(safe);
}
