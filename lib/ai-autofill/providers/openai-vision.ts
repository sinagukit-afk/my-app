import OpenAI from "openai";
import type { DocumentSchema, DropdownOptionsByField, ExtractionResult, FieldSchema } from "../types";
import type { AIVisionProvider, VisionExtractionRequest } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";

function fieldJsonSchema(field: FieldSchema, dropdownOptions: DropdownOptionsByField) {
  if (field.type === "dropdown") {
    const values = (dropdownOptions[field.key] ?? []).map((o) => o.value);
    return { type: ["string", "null"], enum: [...values, null] };
  }
  if (field.type === "number" || field.type === "currency") {
    return { type: ["number", "null"] };
  }
  return { type: ["string", "null"] };
}

function buildResponseSchema(schema: DocumentSchema, dropdownOptions: DropdownOptionsByField) {
  const headerProperties: Record<string, unknown> = {};
  for (const field of schema.headerFields) {
    headerProperties[field.key] = fieldJsonSchema(field, dropdownOptions);
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
      itemProperties[field.key] = fieldJsonSchema(field, dropdownOptions);
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
      const labels = options.map((o) => `"${o.label}"`).join(", ") || "no options available";
      return `- "${field.key}": [${labels}]`;
    })
    .join("\n");

  return [
    `You are extracting structured data from a photo of a "${schema.label}" document for a business management system.`,
    `Set documentTypeMatch to false and add a warning if the image clearly does not look like a ${schema.label}.`,
    `For every dropdown field you MUST choose one of the listed option values, or return null if none of the options are a reasonable match. NEVER invent a value that is not in the list below.`,
    `Dropdown fields and their only valid options (matched by label, but you must return the option's value):\n${optionLines || "(none)"}`,
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
          schema: buildResponseSchema(schema, dropdownOptions),
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

    const filledKeys = Object.entries(parsed.header)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key]) => key);

    return {
      documentType: schema.id,
      header: parsed.header,
      items: parsed.items,
      filledKeys,
      source: "ai",
      warnings,
    };
  }
}
