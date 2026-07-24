/**
 * Lives outside `actions.ts` because a `"use server"` module may only export async
 * functions — exporting this array from there fails at module evaluation, not typecheck.
 *
 * `converted` is deliberately absent. It belongs to the (not yet built) flow that creates
 * a real `public.quotes` row and fills `converted_quote_id` — setting it by hand would
 * claim a link that doesn't exist. Matches the `quote_requests_status_check` constraint
 * minus that one value.
 */
export const SETTABLE_STATUSES = ["new", "contacted", "closed"] as const;

export type SettableStatus = (typeof SETTABLE_STATUSES)[number];
