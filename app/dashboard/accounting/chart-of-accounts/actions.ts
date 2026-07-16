'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/accounting/chart-of-accounts'
const CATEGORIES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'That account number is already in use.'
  if (error.code === '42501') return 'You do not have permission to edit the Chart of Accounts.'
  if (error.code === '23503') return 'Selected parent account no longer exists.'
  return error.message
}

function readAccountFields(formData: FormData) {
  const account_number = (formData.get('account_number') as string)?.trim() ?? ''
  const name = (formData.get('name') as string)?.trim()
  const category = (formData.get('category') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const parent_account_id = (formData.get('parent_account_id') as string)?.trim() || null
  const is_postable = formData.get('is_postable') === 'on'
  return { account_number, name, category, description, parent_account_id, is_postable }
}

function validate(fields: ReturnType<typeof readAccountFields>): string | null {
  if (!/^\d+$/.test(fields.account_number)) {
    return 'Account number must be a positive whole number.'
  }
  if (!fields.name) return 'Account name is required.'
  if (!CATEGORIES.includes(fields.category as (typeof CATEGORIES)[number])) {
    return 'Category must be one of Asset, Liability, Equity, Revenue, or Expense.'
  }
  return null
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const fields = readAccountFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.from('accounts').insert(fields)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  const fields = readAccountFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.from('accounts').update(fields).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function setAccountActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('accounts').update({ is_active: isActive }).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
