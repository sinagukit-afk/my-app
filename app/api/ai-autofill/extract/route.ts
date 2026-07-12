import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { documentSchemas } from "@/lib/ai-autofill/schemas";
import { OpenAIVisionProvider } from "@/lib/ai-autofill/providers/openai-vision";
import type { DocumentType, DropdownOptionsByField } from "@/lib/ai-autofill/types";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // Any authenticated user may call this — it never touches Supabase data,
  // only proxies to OpenAI. Without this check it would be an open proxy
  // anyone could hit to spend the project's OpenAI credits.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Auto-Fill is not configured (missing OPENAI_API_KEY)." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");
  const documentType = formData.get("documentType");
  const dropdownOptionsRaw = formData.get("dropdownOptions");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 10MB)" }, { status: 400 });
  }
  if (typeof documentType !== "string" || !(documentType in documentSchemas)) {
    return NextResponse.json({ error: "Unknown or missing documentType" }, { status: 400 });
  }

  let dropdownOptions: DropdownOptionsByField = {};
  if (typeof dropdownOptionsRaw === "string" && dropdownOptionsRaw.length > 0) {
    try {
      dropdownOptions = JSON.parse(dropdownOptionsRaw);
    } catch {
      return NextResponse.json({ error: "dropdownOptions must be valid JSON" }, { status: 400 });
    }
  }

  const schema = documentSchemas[documentType as DocumentType];
  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  try {
    const provider = new OpenAIVisionProvider(apiKey);
    const result = await provider.extract({
      imageBase64,
      mimeType: image.type || "image/jpeg",
      schema,
      dropdownOptions,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ai-autofill/extract] OpenAI Vision call failed:", error);
    return NextResponse.json({ error: "AI extraction failed. Please try again or enter the form manually." }, { status: 502 });
  }
}
