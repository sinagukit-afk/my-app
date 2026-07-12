export type DocumentType =
  | "receipt"
  | "supplier_invoice"
  | "delivery_receipt"
  | "shipping_label"
  | "official_receipt"
  | "inventory_purchase";

export type FieldValueType = "string" | "number" | "date" | "currency" | "dropdown";

export type FieldValue = string | number | null;

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldValueType;
  /** Hint words the local regex extractor looks near (e.g. "Total", "Invoice Date"). Not used by the AI provider. */
  localHints?: string[];
  /** If true and this field is still empty after the local pass, the AI fallback is triggered. */
  required?: boolean;
  /**
   * For a "currency" field: instead of asking the AI to read a per-unit rate
   * directly (which it may confuse with a printed lump/pack price, e.g.
   * "50 pcs ... ₱650" is a total, not a ₱650-per-piece rate), ask it for the
   * TOTAL price for that line and divide by the same item's field named here
   * (usually the quantity field's key) to compute the final per-unit value.
   * The division happens in code, not by the model, since a JSON-schema
   * -constrained response has no room for the model to show its arithmetic.
   */
  totalDividedBy?: string;
}

export interface DocumentSchema {
  id: DocumentType;
  label: string;
  headerFields: FieldSchema[];
  /** Present when this document type supports a repeating line-items table. */
  lineItemFields?: FieldSchema[];
}

export interface DropdownOption {
  value: string;
  label: string;
  /** Extra alternate names/keywords to match against, in addition to the label (e.g. item aliases so a supplier document naming an item differently still matches). */
  keywords?: string;
}

/** Options for each dropdown-typed field key, supplied by the host form at call time. */
export type DropdownOptionsByField = Record<string, DropdownOption[]>;

export interface ExtractionInput {
  schema: DocumentSchema;
  dropdownOptions: DropdownOptionsByField;
}

export interface ExtractionResult {
  documentType: DocumentType;
  header: Record<string, FieldValue>;
  items?: Record<string, FieldValue>[];
  /** Header keys the extractor actually populated — drives the "AI-filled" highlight. */
  filledKeys: string[];
  source: "local" | "ai";
  warnings: string[];
}
