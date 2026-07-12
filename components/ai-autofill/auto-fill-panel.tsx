"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { useAutoFill } from "./use-auto-fill";
import type { DocumentSchema, DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";

export interface AutoFillPanelProps {
  schema: DocumentSchema;
  dropdownOptions: DropdownOptionsByField;
  onExtracted: (result: ExtractionResult) => void;
  className?: string;
}

const STAGE_LABEL: Record<string, string> = {
  "reading-locally": "Reading document…",
  "asking-ai": "Improving accuracy with AI…",
};

export function AutoFillPanel({ schema, dropdownOptions, onExtracted, className }: AutoFillPanelProps) {
  const [mode, setMode] = React.useState<"manual" | "upload">("manual");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { stage, error, warnings, imagePreviewUrl, processImage, reset } = useAutoFill({
    schema,
    dropdownOptions,
    onExtracted,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processImage(file);
    e.target.value = "";
  };

  const handleModeChange = (next: "manual" | "upload") => {
    if (next === "manual") reset();
    setMode(next);
  };

  const busy = stage === "reading-locally" || stage === "asking-ai";

  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="inline-flex w-fit rounded-md border border-(--color-border) p-0.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "manual" ? "primary" : "ghost"}
            onClick={() => handleModeChange("manual")}
          >
            Manual Entry
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "upload" ? "primary" : "ghost"}
            onClick={() => handleModeChange("upload")}
          >
            Upload / Capture Image
          </Button>
        </div>

        {mode === "upload" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-(--color-text-muted)">
              Upload or take a photo of the {schema.label.toLowerCase()}. Every field it fills in stays fully
              editable, and nothing is saved until you submit the form yourself.
            </p>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                data-testid="ai-autofill-file-input"
              />
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                {imagePreviewUrl ? "Use a different image" : "Choose image"}
              </Button>
              {imagePreviewUrl && !busy && stage !== "idle" && (
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  Clear
                </Button>
              )}
            </div>

            {imagePreviewUrl && (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Uploaded document preview"
                  className="h-24 w-24 rounded-md border border-(--color-border) object-cover"
                />
                <div className="flex flex-col gap-1 text-sm">
                  {busy && (
                    <span className="inline-flex items-center gap-2 text-(--color-text-muted)">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)" />
                      {STAGE_LABEL[stage]}
                    </span>
                  )}
                  {stage === "done" && (
                    <span className="text-(--color-success)">
                      Done — review the highlighted fields below before submitting.
                    </span>
                  )}
                  {stage === "error" && error && <span className="text-(--color-danger)">{error}</span>}
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-md border border-(--color-warning) bg-(--color-warning-light) p-2 text-xs text-(--color-warning)">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
