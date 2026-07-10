'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }
export type PostActionResult = { success: true; entryId: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/accounting/review'

export type DraftLineInput = {
  account_number: string
  debit: number
  credit: number
  memo: string | null
}

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') {
    return 'You do not have permission to do that.'
  }
  // These RPCs raise plpgsql exceptions (unbalanced, unknown account, wrong
  // status, not authorized) — surface their message text directly.
  return error.message
}

export async function saveDraft(
  draftId: string,
  description: string,
  lines: DraftLineInput[]
): Promise<ActionResult> {
  const trimmed = description.trim()
  if (!trimmed) return { success: false, error: 'Description is required.' }

  const validLines = lines.filter(
    (l) =>
      Boolean(l.account_number) &&
      ((l.debit > 0 && l.credit === 0) || (l.credit > 0 && l.debit === 0))
  )

  if (validLines.length < 2) {
    return { success: false, error: 'A journal entry needs at least 2 lines, each with a debit or a credit.' }
  }

  const totalDebit = validLines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = validLines.reduce((s, l) => s + l.credit, 0)
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    return { success: false, error: 'Entry does not balance — total debits must equal total credits.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_journal_entry_draft', {
    p_draft_id: draftId,
    p_description: trimmed,
    p_lines: validLines,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(`${LIST_PATH}/${draftId}`)
  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function approveDraft(draftId: string): Promise<PostActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('approve_and_post_journal_entry_draft', {
    p_draft_id: draftId,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(`${LIST_PATH}/${draftId}`)
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/accounting/journal')
  return { success: true, entryId: (data as { id: string }).id }
}

export async function rejectDraft(draftId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_journal_entry_draft', {
    p_draft_id: draftId,
    p_reason: reason.trim() || null,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(`${LIST_PATH}/${draftId}`)
  revalidatePath(LIST_PATH)
  return { success: true }
}
