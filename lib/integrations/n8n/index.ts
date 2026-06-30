// TODO: n8n workflow integration
//
// Wiring plan:
//   1. Deploy n8n alongside this app (Docker Compose service or separate VPS).
//   2. Add N8N_WEBHOOK_BASE_URL to .env.local (e.g. https://n8n.yourdomain.com/webhook).
//   3. Implement triggerWorkflow() below to POST to the appropriate webhook URL.
//   4. Call triggerWorkflow() from server actions when business events occur
//      (e.g. new order created, low stock detected, invoice generated).
//
// Example shape (do not implement until step 1-2 are done):
//
//   export async function triggerWorkflow(
//     workflowId: string,
//     payload: Record<string, unknown>,
//   ): Promise<void> {
//     const base = process.env.N8N_WEBHOOK_BASE_URL;
//     if (!base) return; // silently skip when not configured
//     await fetch(`${base}/${workflowId}`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//     });
//   }
//
// No secrets or webhook URLs belong in this file.

export {};
