"use client";

import { useCallback, useRef, useState } from "react";
import { runLocalOcr } from "@/lib/ai-autofill/ocr/tesseract-client";
import { extractLocally } from "@/lib/ai-autofill/ocr/local-extract";
import { needsAiFallback } from "@/lib/ai-autofill/ocr/confidence";
import type { DocumentSchema, DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";

export type AutoFillStage = "idle" | "reading-locally" | "asking-ai" | "done" | "error";

interface UseAutoFillOptions {
  schema: DocumentSchema;
  dropdownOptions: DropdownOptionsByField;
  onExtracted: (result: ExtractionResult) => void;
}

export function useAutoFill({ schema, dropdownOptions, onExtracted }: UseAutoFillOptions) {
  const [stage, setStage] = useState<AutoFillStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setImagePreviewUrl(null);
    setStage("idle");
    setError(null);
    setWarnings([]);
  }, []);

  const processImage = useCallback(
    async (file: File) => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setImagePreviewUrl(previewUrl);
      setError(null);
      setWarnings([]);

      try {
        setStage("reading-locally");
        const ocr = await runLocalOcr(file);
        const localHeader = extractLocally(ocr.text, schema, dropdownOptions);

        if (!needsAiFallback({ ocrConfidence: ocr.confidence, schema, header: localHeader })) {
          const filledKeys = Object.entries(localHeader)
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key]) => key);
          onExtracted({
            documentType: schema.id,
            header: localHeader,
            filledKeys,
            source: "local",
            warnings: [],
          });
          setStage("done");
          return;
        }

        setStage("asking-ai");
        const body = new FormData();
        body.set("image", file);
        body.set("documentType", schema.id);
        body.set("dropdownOptions", JSON.stringify(dropdownOptions));

        const response = await fetch("/api/ai-autofill/extract", { method: "POST", body });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "AI extraction failed");
        }

        const result = payload as ExtractionResult;
        setWarnings(result.warnings ?? []);
        onExtracted(result);
        setStage("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong reading this image.");
        setStage("error");
      }
    },
    [schema, dropdownOptions, onExtracted]
  );

  return { stage, error, warnings, imagePreviewUrl, processImage, reset };
}
