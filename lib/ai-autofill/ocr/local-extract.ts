import type { DocumentSchema, DropdownOptionsByField, FieldSchema, FieldValue } from "../types";
import { matchDropdownOption } from "../match-dropdown";

const DATE_PATTERN = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/;
const NUMBER_PATTERN = /-?\d[\d,]*\.?\d*/;

function findHintLine(lines: string[], hints: string[]): string | null {
  const lower = hints.map((h) => h.toLowerCase());
  return lines.find((line) => lower.some((hint) => line.toLowerCase().includes(hint))) ?? null;
}

function valueAfterHint(line: string, hints: string[]): string {
  const lower = line.toLowerCase();
  for (const hint of hints) {
    const idx = lower.indexOf(hint.toLowerCase());
    if (idx >= 0) {
      const rest = line.slice(idx + hint.length).replace(/^[:\s-]+/, "").trim();
      if (rest) return rest;
    }
  }
  return line.trim();
}

function extractField(field: FieldSchema, lines: string[], dropdownOptions: DropdownOptionsByField): FieldValue {
  const hints = field.localHints ?? [];
  const line = hints.length > 0 ? findHintLine(lines, hints) : null;
  if (!line) return null;

  switch (field.type) {
    case "date": {
      const match = line.match(DATE_PATTERN);
      return match ? match[0] : null;
    }
    case "number":
    case "currency": {
      const match = line.match(NUMBER_PATTERN);
      return match ? Number(match[0].replace(/,/g, "")) : null;
    }
    case "dropdown": {
      const candidate = valueAfterHint(line, hints);
      return matchDropdownOption(candidate, dropdownOptions[field.key] ?? []);
    }
    case "string":
    default:
      return valueAfterHint(line, hints) || null;
  }
}

/**
 * Cheap, free, best-effort extraction from raw OCR text using label keywords —
 * no AI call involved. Only fills header fields; line items need real layout
 * understanding and are left for the AI fallback (see confidence.ts).
 */
export function extractLocally(
  rawText: string,
  schema: DocumentSchema,
  dropdownOptions: DropdownOptionsByField
): Record<string, FieldValue> {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const header: Record<string, FieldValue> = {};
  for (const field of schema.headerFields) {
    header[field.key] = extractField(field, lines, dropdownOptions);
  }
  return header;
}
