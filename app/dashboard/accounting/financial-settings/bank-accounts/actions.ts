'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { findNonPostableAccounts } from '@/lib/accounting/assert-postable-accounts'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/accounting/financial-settings/bank-accounts'

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit Bank Accounts.'
  if (error.code === '23503') return 'Selected GL account no longer exists.'
  return error.message
}

const VALID_TYPES = ['saving', 'online_wallet', 'credit_card'] as const

// credit_card links to the card's payable (liability); saving/online_wallet
// link to a real cash/asset account. Mirrors bank-account-form.tsx's
// categoryForType() — keep the two in sync.
const CATEGORY_FOR_TYPE: Record<string, string> = {
  saving: 'asset',
  online_wallet: 'asset',
  credit_card: 'liability',
}

function readBankAccountFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const bank = (formData.get('bank') as string)?.trim()
  const type = (formData.get('type') as string)?.trim()
  const account_number_masked = (formData.get('account_number_masked') as string)?.trim() || null
  const gl_account_id = (formData.get('gl_account_id') as string)?.trim()
  const currency = (formData.get('currency') as string)?.trim() || 'PHP'
  return { name, bank, type, account_number_masked, gl_account_id, currency }
}

function validate(fields: ReturnType<typeof readBankAccountFields>): string | null {
  if (!fields.name) return 'Bank account name is required.'
  if (!fields.bank) return 'Bank is required.'
  if (!VALID_TYPES.includes(fields.type as (typeof VALID_TYPES)[number])) return 'Select a valid type.'
  if (!fields.gl_account_id) return 'GL Account is required.'
  return null
}

// Defense-in-depth for the Type ↔ GL Account category pairing: the UI
// already filters the picker by type, but this re-checks server-side
// (stale tab, second admin session) before any write.
async function findCategoryMismatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: string,
  glAccountId: string
): Promise<string | null> {
  const { data, error } = await supabase.from('accounts').select('account_number, name, category').eq('id', glAccountId).single()
  if (error) return error.message

  const expected = CATEGORY_FOR_TYPE[type]
  if (data.category !== expected) {
    return `${data.account_number} — ${data.name} is a ${data.category} account, but "${type.replace('_', ' ')}" requires a ${expected} account.`
  }
  return null
}

export async function createBankAccount(formData: FormData): Promise<ActionResult> {
  const fields = readBankAccountFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()

  const postableError = await findNonPostableAccounts(supabase, [fields.gl_account_id])
  if (postableError) return { success: false, error: postableError }

  const categoryError = await findCategoryMismatch(supabase, fields.type, fields.gl_account_id)
  if (categoryError) return { success: false, error: categoryError }

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

  const postableError = await findNonPostableAccounts(supabase, [fields.gl_account_id])
  if (postableError) return { success: false, error: postableError }

  const categoryError = await findCategoryMismatch(supabase, fields.type, fields.gl_account_id)
  if (categoryError) return { success: false, error: categoryError }

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
