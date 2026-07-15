'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/finance/expense-schedule'

export type ActionResult = { success: true } | { success: false; error: string }
export type GenerateResult = { success: true; processed: number } | { success: false; error: string }
export type TerminateResult =
  | { success: true; draftId: string | null }
  | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to do that.'
  // These RPCs raise plpgsql exceptions (not authorized, invalid type, already
  // terminated, etc.) — surface their message text directly, it's already user-facing.
  return error.message
}

function detailPath(type: string, id: string) {
  return `${LIST_PATH}/${type}/${id}`
}

export async function generateDuePrepaidPostings(): Promise<GenerateResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_due_prepaid_postings')

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/accounting/review')
  return { success: true, processed: (data as number) ?? 0 }
}

export async function pauseSchedule(type: 'prepaid' | 'fixed_asset', id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('pause_expense_schedule', { p_type: type, p_id: id })
  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(type, id))
  return { success: true }
}

export async function resumeSchedule(type: 'prepaid' | 'fixed_asset', id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('resume_expense_schedule', { p_type: type, p_id: id })
  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(type, id))
  return { success: true }
}

export async function extendSchedule(
  type: 'prepaid' | 'fixed_asset',
  id: string,
  additionalMonths: number
): Promise<ActionResult> {
  if (!additionalMonths || additionalMonths <= 0) {
    return { success: false, error: 'Additional months must be greater than zero.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('extend_expense_schedule', {
    p_type: type,
    p_id: id,
    p_additional_months: additionalMonths,
  })
  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(type, id))
  return { success: true }
}

export async function terminateSchedule(
  type: 'prepaid' | 'fixed_asset',
  id: string,
  terminationDate: string
): Promise<TerminateResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('terminate_expense_schedule', {
    p_type: type,
    p_id: id,
    p_termination_date: terminationDate || new Date().toISOString().slice(0, 10),
  })
  if (error) return { success: false, error: friendlyError(error) }

  const result = data as { draft_id: string | null }
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(type, id))
  revalidatePath('/dashboard/accounting/review')
  return { success: true, draftId: result.draft_id }
}
