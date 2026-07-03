// N8N_WEBHOOK_BASE_URL points at the n8n instance's webhook path, e.g.
// https://n8n.example.com/webhook — set in .env.local.
//
// Missing env var is a soft-skip, not a thrown error: the Supabase row is the
// source of truth (sync_status stays 'pending'), so a push can be retried later
// without failing the caller's own save.

export async function triggerWorkflow(
  webhookPath: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) {
    console.warn(`N8N_WEBHOOK_BASE_URL not set — skipped triggering "${webhookPath}"`);
    return;
  }
  try {
    await fetch(`${base}/${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Failed to trigger n8n workflow "${webhookPath}":`, err);
  }
}
