/**
 * Renders a date-only value (Postgres `date` columns, or the date portion of
 * a timestamp) as MM/DD/YYYY. Pure "YYYY-MM-DD" strings are parsed from the
 * string directly rather than via `Date`, since `new Date("YYYY-MM-DD")`
 * parses as UTC midnight and can shift a day backward in negative-offset
 * timezones once local getters are applied.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      return `${m}/${d}/${y}`;
    }
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Renders a timestamp as "MM/DD/YYYY, h:mm AM/PM" — for activity/history logs only. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${formatDate(d)}, ${time}`;
}
