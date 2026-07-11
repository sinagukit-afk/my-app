'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true; id: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/accounting/journal'

// One line of a journal entry as assembled by the posting form. Amounts are
// plain numbers here; post_journal_entry() enforces the one-side + balance rules.
export type JournalLineInput = {
  account_number: string
  debit: number
  credit: number
  memo: string | null
}

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') {
    return 'You do not have permission to post journal entries.'
  }
  // post_journal_entry() raises plpgsql exceptions (unbalanced, unknown account,
  // not authorized) — surface their message text directly, it's already user-facing.
  return error.message
}

export async function postJournalEntry(formData: FormData): Promise<ActionResult> {
  const entry_date = (formData.get('entry_date') as string) || new Date().toISOString().slice(0, 10)
  const description = (formData.get('description') as string)?.trim()

  if (!description) return { success: false, error: 'Description is required.' }

  let lines: JournalLineInput[] = []
  try {
    lines = JSON.parse((formData.get('lines_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line data.' }
  }

  // Keep only lines that name an account and carry a positive amount on exactly
  // one side. The RPC re-validates all of this server-side; this is just so we
  // don't send obviously-empty rows the user left blank.
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
  const { data, error } = await supabase.rpc('post_journal_entry', {
    p_entry_date: entry_date,
    p_description: description,
    p_lines: validLines,
    p_source_type: 'manual',
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true, id: (data as { id: string }).id }
}

export async function reverseJournalEntry(entryId: string, reason: string): Promise<ActionResult> {
  const trimmed = reason.trim()
  if (!trimmed) return { success: false, error: 'A reason is required to reverse a journal entry.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reverse_journal_entry', {
    p_entry_id: entryId,
    p_reason: trimmed,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${entryId}`)
  return { success: true, id: (data as { id: string }).id }
}
