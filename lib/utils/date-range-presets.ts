export type DateRange = { from: string; to: string };

function toISODate(d: Date) {
  // Build from local date parts — toISOString() converts to UTC first, which
  // rolls the date back a day in any UTC+ timezone (e.g. Manila).
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export const DATE_RANGE_PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return { from: toISODate(startOfMonth(now)), to: toISODate(endOfMonth(now)) };
    },
  },
  {
    label: "Last Month",
    getRange: () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: toISODate(startOfMonth(lastMonth)), to: toISODate(endOfMonth(lastMonth)) };
    },
  },
  {
    label: "This Year",
    getRange: () => {
      const now = new Date();
      return { from: `${now.getFullYear()}-01-01`, to: toISODate(now) };
    },
  },
  { label: "All Time", getRange: () => ({ from: "", to: "" }) },
];
