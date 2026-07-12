/** Best-effort conversion of an OCR/AI-extracted date string to the yyyy-mm-dd shape <input type="date"> requires. */
export function toIsoDate(raw: string): string | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
