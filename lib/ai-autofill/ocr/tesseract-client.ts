export interface LocalOcrResult {
  text: string;
  /** Mean word confidence, 0-100. */
  confidence: number;
}

/**
 * Runs Tesseract.js entirely in the browser (Web Worker + WASM). Dynamically
 * imported so the ~2-3MB OCR bundle is never sent unless the user actually
 * picks "Upload / Capture Image".
 */
export async function runLocalOcr(image: File | Blob): Promise<LocalOcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(image);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
