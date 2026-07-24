'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canManageMarketing, MARKETING_DENIED } from '../access'
import { SETTABLE_STATUSES, type SettableStatus } from './statuses'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/marketing/quote-requests'

export async function setQuoteRequestStatus(
  id: string,
  status: SettableStatus
): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  if (!SETTABLE_STATUSES.includes(status)) {
    return { success: false, error: 'Unsupported status.' }
  }

  const supabase = await createClient()

  // A request already linked to a real quote shouldn't be walked back to a lead status.
  const { data: existing, error: readError } = await supabase
    .from('web_quote_requests')
    .select('status, converted_quote_id')
    .eq('id', id)
    .single()

  if (readError) return { success: false, error: readError.message }
  if (existing.converted_quote_id) {
    return {
      success: false,
      error: 'This request is already linked to a quote. Its status is managed by that quote.',
    }
  }

  const { error } = await supabase
    .from('web_quote_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${id}`)
  return { success: true }
}
