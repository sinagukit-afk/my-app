import type { DocumentSchema, FieldValue } from "../types";

const OCR_CONFIDENCE_FLOOR = 65;

export interface ConfidenceCheckInput {
  ocrConfidence: number;
  schema: DocumentSchema;
  header: Record<string, FieldValue>;
}

/** True when the local (free) pass is good enough to skip the paid AI fallback. */
export function needsAiFallback({ ocrConfidence, schema, header }: ConfidenceCheckInput): boolean {
  if (ocrConfidence < OCR_CONFIDENCE_FLOOR) return true;

  const missingRequired = schema.headerFields.some(
    (field) => field.required && (header[field.key] === null || header[field.key] === undefined)
  );
  if (missingRequired) return true;

  // Line items need table/layout understanding the local text-only pass can't do.
  if (schema.lineItemFields && schema.lineItemFields.length > 0) return true;

  return false;
}
