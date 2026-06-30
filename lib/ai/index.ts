// TODO: AI Assistant integration
//
// Wiring plan:
//   1. Install an AI SDK (e.g. @anthropic-ai/sdk or the Vercel AI SDK).
//   2. Add ANTHROPIC_API_KEY (or equivalent) to .env.local and the VPS environment.
//   3. Create an API route: app/api/ai/chat/route.ts  (POST, streaming).
//   4. Replace this file with a typed client that calls that route, e.g.:
//        export async function askAssistant(prompt: string): Promise<ReadableStream> { ... }
//   5. Mount a floating <AIAssistantPanel /> in AppShell; wire it via AIProvider
//      (components/providers/ai-provider.tsx already has the placeholder context).
//
// No secrets or API keys belong in this file.

export {};
