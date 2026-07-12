import OpenAI from "openai";
import type { DocumentSchema, DropdownOptionsByField, ExtractionResult, FieldSchema, FieldValue } from "../types";
import type { AIVisionProvider, VisionExtractionRequest } from "./types";
import { matchDropdownOption } from "../match-dropdown";

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Dropdown fields are asked for as free-text label strings, not constrained
 * to an enum of option values. Constraining the JSON schema to an enum of
 * raw ids works for short lists (a handful of suppliers/categories), but
 * breaks down for longer ones (e.g. dozens of inventory items): the model
 * reasons about the right item correctly but then emits the wrong id string
 * from the enum. Resolving the label text back to an id via the same fuzzy
 * matcher the local OCR pass uses (see match-dropdown.ts) is both more
 * reliable and keeps the "never invent a value" guarantee — it's enforced
 * at the app layer instead of relying on the model's enum recall.
 */
function fieldJsonSchema(field: FieldSchema) {
  if (field.type === "number" || field.type === "currency") {
    return { type: ["number", "null"] };
  }
  return { type: ["string", "null"] };
}

function buildResponseSchema(schema: DocumentSchema) {
  const headerProperties: Record<string, unknown> = {};
  for (const field of schema.headerFields) {
    headerProperties[field.key] = fieldJsonSchema(field);
  }

  const properties: Record<string, unknown> = {
    documentTypeMatch: { type: "boolean" },
    header: {
      type: "object",
      properties: headerProperties,
      required: schema.headerFields.map((f) => f.key),
      additionalProperties: false,
    },
    warnings: { type: "array", items: { type: "string" } },
  };
  const required = ["documentTypeMatch", "header", "warnings"];

  if (schema.lineItemFields && schema.lineItemFields.length > 0) {
    const itemProperties: Record<string, unknown> = {};
    for (const field of schema.lineItemFields) {
      itemProperties[field.key] = fieldJsonSchema(field);
    }
    properties.items = {
      type: "array",
      items: {
        type: "object",
        properties: itemProperties,
        required: schema.lineItemFields.map((f) => f.key),
        additionalProperties: false,
      },
    };
    required.push("items");
  }

  return { type: "object" as const, properties, required, additionalProperties: false };
}

function buildPrompt(schema: DocumentSchema, dropdownOptions: DropdownOptionsByField): string {
  const dropdownFields = [...schema.headerFields, ...(schema.lineItemFields ?? [])].filter(
    (f) => f.type === "dropdown"
  );
  const optionLines = dropdownFields
    .map((field) => {
      const options = dropdownOptions[field.key] ?? [];
      const labels =
        options.map((o) => (o.keywords ? `"${o.label}" (also known as: ${o.keywords})` : `"${o.label}"`)).join(", ") ||
        "no options available";
      return `- "${field.key}": [${labels}]`;
    })
    .join("\n");

  const totalFields = [...schema.headerFields, ...(schema.lineItemFields ?? [])].filter((f) => f.totalDividedBy);
  const totalFieldsNote =
    totalFields.length > 0
      ? `For ${totalFields.map((f) => `"${f.key}"`).join(", ")}, return the TOTAL price printed for that whole line — NOT a per-unit/per-piece rate. Source documents (especially marketplace/cart screenshots) often show one lump price covering a multi-piece pack (e.g. a line reading "50 pcs ... ₱650" means ₱650 is the total for all 50 pieces, not ₱650 per piece). We compute the per-unit cost ourselves afterward by dividing this total by the matching quantity field, so do not do that division yourself and do not guess a per-unit rate — just report the total exactly as printed.`
      : "";

  return [
    `You are extracting structured data from a photo of a "${schema.label}" document for a business management system.`,
    `Set documentTypeMatch to false and add a warning if the image clearly does not look like a ${schema.label}.`,
    `For every dropdown field, return the exact label text (copied verbatim from the list below) of whichever option it best matches, or null if none of the options are a reasonable match. NEVER return a label that is not in the list below.`,
    `Dropdown fields and their only valid options:\n${optionLines || "(none)"}\nSome options list "also known as" alternate names/keywords — the document may describe the item using different wording than the registered name, so match against those aliases too, not just the label, but still return the option's exact label text.`,
    totalFieldsNote,
    `Leave any field null if it is not clearly present in the image. Do not guess.`,
    schema.lineItemFields ? `Extract every line item you can find as a separate entry in "items".` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export class OpenAIVisionProvider implements AIVisionProvider {
  private readonly model: string;

  constructor(private readonly apiKey: string, model?: string) {
    this.model = model ?? process.env.OPENAI_VISION_MODEL ?? DEFAULT_MODEL;
  }

  async extract(request: VisionExtractionRequest): Promise<ExtractionResult> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const { schema, dropdownOptions, imageBase64, mimeType } = request;

    const completion = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: buildPrompt(schema, dropdownOptions) },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract the fields for this ${schema.label}.` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_extraction",
          strict: true,
          schema: buildResponseSchema(schema),
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("OpenAI Vision returned an empty response");

    const parsed = JSON.parse(raw) as {
      documentTypeMatch: boolean;
      header: Record<string, string | number | null>;
      items?: Record<string, string | number | null>[];
      warnings: string[];
    };

    const warnings = [...parsed.warnings];
    if (!parsed.documentTypeMatch) {
      warnings.unshift(`The image may not be a ${schema.label} — please review every field carefully.`);
    }

    const header = resolveTotals(resolveDropdowns(parsed.header, schema.headerFields, dropdownOptions), schema.headerFields);
    const items = parsed.items?.map((item) =>
      resolveTotals(resolveDropdowns(item, schema.lineItemFields ?? [], dropdownOptions), schema.lineItemFields ?? [])
    );

    const filledKeys = Object.entries(header)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key]) => key);

    return {
      documentType: schema.id,
      header,
      items,
      filledKeys,
      source: "ai",
      warnings,
    };
  }
}

/** Replaces dropdown-field label text from the model with the matching option's value (or null). Leaves every other field as-is. */
function resolveDropdowns(
  raw: Record<string, string | number | null>,
  fields: FieldSchema[],
  dropdownOptions: DropdownOptionsByField
): Record<string, FieldValue> {
  const resolved: Record<string, FieldValue> = { ...raw };
  for (const field of fields) {
    if (field.type !== "dropdown") continue;
    const value = raw[field.key];
    resolved[field.key] = typeof value === "string" ? matchDropdownOption(value, dropdownOptions[field.key] ?? []) : null;
  }
  return resolved;
}

/** Divides a `totalDividedBy`-marked field's raw (line-total) value by the referenced field's value to get the true per-unit number. Leaves it as-is if either side is missing/zero — better to show the raw total for the user to fix than to silently drop it. */
function resolveTotals(record: Record<string, FieldValue>, fields: FieldSchema[]): Record<string, FieldValue> {
  const resolved = { ...record };
  for (const field of fields) {
    if (!field.totalDividedBy) continue;
    const total = resolved[field.key];
    const divisor = resolved[field.totalDividedBy];
    if (typeof total === "number" && typeof divisor === "number" && divisor > 0) {
      resolved[field.key] = total / divisor;
    }
  }
  return resolved;
}
