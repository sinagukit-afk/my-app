export type DocumentType =
  | "receipt"
  | "supplier_invoice"
  | "delivery_receipt"
  | "shipping_label"
  | "official_receipt";

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
