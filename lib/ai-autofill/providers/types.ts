import type { DocumentSchema, DropdownOptionsByField, ExtractionResult } from "../types";

export interface VisionExtractionRequest {
  /** Raw base64 image bytes (no "data:" prefix). */
  imageBase64: string;
  mimeType: string;
  schema: DocumentSchema;
  dropdownOptions: DropdownOptionsByField;
}

/**
 * Implement this to add a new AI vision backend (Anthropic, Google, ...)
 * without touching the route handler, the hook, or any consuming form.
 */
export interface AIVisionProvider {
  extract(request: VisionExtractionRequest): Promise<ExtractionResult>;
}
