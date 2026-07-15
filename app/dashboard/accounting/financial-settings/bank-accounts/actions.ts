'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/accounting/financial-settings/bank-accounts'

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit Bank Accounts.'
  if (error.code === '23503') return 'Selected GL account no longer exists.'
  return error.message
}

function readBankAccountFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const bank = (formData.get('bank') as string)?.trim()
  const account_number_masked = (formData.get('account_number_masked') as string)?.trim() || null
  const gl_account_id = (formData.get('gl_account_id') as string)?.trim()
  const currency = (formData.get('currency') as string)?.trim() || 'PHP'
  return { name, bank, account_number_masked, gl_account_id, currency }
}

function validate(fields: ReturnType<typeof readBankAccountFields>): string | null {
  if (!fields.name) return 'Bank account name is required.'
  if (!fields.bank) return 'Bank is required.'
  if (!fields.gl_account_id) return 'GL Account is required.'
  return null
}

export async function createBankAccount(formData: FormData): Promise<ActionResult> {
  const fields = readBankAccountFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.from('bank_accounts').insert(fields)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateBankAccount(id: string, formData: FormData): Promise<ActionResult> {
  const fields = readBankAccountFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.from('bank_accounts').update(fields).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function setBankAccountActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('bank_accounts').update({ is_active: isActive }).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
