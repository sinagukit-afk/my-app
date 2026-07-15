'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }
export type CreateResult =
  | { success: true; id: string; kind: 'expense' | 'fixed_asset' }
  | { success: false; error: string }

const LIST_PATH = '/dashboard/finance/expenses'

function detailPath(id: string) {
  return `${LIST_PATH}/${id}`
}

function friendlyError(error: { message: string }): string {
  return error.message
}

export async function recordDirectExpense(formData: FormData): Promise<CreateResult> {
  const category_id = formData.get('category_id') as string
  const description = (formData.get('description') as string)?.trim()
  const amount = Number(formData.get('amount'))
  const expense_date = (formData.get('expense_date') as string) || new Date().toISOString().slice(0, 10)
  const supplier_id = (formData.get('supplier_id') as string) || null
  const payment_status = (formData.get('payment_status') as string) || 'unpaid'
  const treatment_override = (formData.get('treatment_override') as string) || null
  const term_override = Number(formData.get('term_override')) || null
  const useful_life_override = Number(formData.get('useful_life_override')) || null
  const salvage_override = formData.get('salvage_override') ? Number(formData.get('salvage_override')) : null

  if (!category_id) return { success: false, error: 'Select an expense category.' }
  if (!description) return { success: false, error: 'Enter a description.' }
  if (!amount || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_direct_expense', {
    p_category_id: category_id,
    p_description: description,
    p_amount: amount,
    p_expense_date: expense_date,
    p_supplier_id: supplier_id,
    p_payment_status: payment_status,
    p_treatment_override: treatment_override,
    p_term_override: term_override,
    p_useful_life_override: useful_life_override,
    p_salvage_override: salvage_override,
  })

  if (error) return { success: false, error: friendlyError(error) }

  const result = data as { id: string; kind: 'expense' | 'fixed_asset' }
  revalidatePath(LIST_PATH)
  if (result.kind === 'fixed_asset') revalidatePath('/dashboard/finance/fixed-assets')
  return { success: true, id: result.id, kind: result.kind }
}

export async function updateDirectExpense(id: string, formData: FormData): Promise<ActionResult> {
  const category_id = formData.get('category_id') as string
  const description = (formData.get('description') as string)?.trim()
  const amount = Number(formData.get('amount'))
  const expense_date = formData.get('expense_date') as string
  const supplier_id = (formData.get('supplier_id') as string) || null

  if (!category_id) return { success: false, error: 'Select an expense category.' }
  if (!description) return { success: false, error: 'Enter a description.' }
  if (!amount || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_direct_expense', {
    p_id: id,
    p_category_id: category_id,
    p_description: description,
    p_amount: amount,
    p_expense_date: expense_date,
    p_supplier_id: supplier_id,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(detailPath(id))
  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_expense', { p_id: id })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function logExpensePayment(
  expenseId: string,
  paymentTypeId: string | null,
  amount: number,
  paidDate: string,
  notes: string | null
): Promise<ActionResult> {
  if (!amount || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('log_payable_payment', {
    p_payable_type: 'expense',
    p_payable_id: expenseId,
    p_payment_type_id: paymentTypeId,
    p_amount: amount,
    p_paid_date: paidDate,
    p_notes: notes,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(detailPath(expenseId))
  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function uploadExpenseAttachment(expenseId: string, formData: FormData): Promise<ActionResult> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Choose a file to upload.' }

  const supabase = await createClient()
  const path = `${expenseId}/${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage.from('expense-attachments').upload(path, file)
  if (uploadError) return { success: false, error: uploadError.message }

  const { error: rpcError } = await supabase.rpc('add_expense_attachment', {
    p_expense_id: expenseId,
    p_file_path: path,
    p_file_name: file.name,
  })
  if (rpcError) return { success: false, error: friendlyError(rpcError) }

  revalidatePath(detailPath(expenseId))
  return { success: true }
}

export async function getAttachmentUrl(filePath: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('expense-attachments').createSignedUrl(filePath, 60 * 10)
  if (error) return null
  return data.signedUrl
}

export async function createExpenseCategory(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string)?.trim()
  const default_expense_account_id = (formData.get('default_expense_account_id') as string) || null
  const accounting_treatment = (formData.get('accounting_treatment') as string) || 'immediate'

  if (!name) return { success: false, error: 'Enter a category name.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('expense_categories')
    .insert({ name, default_expense_account_id, accounting_treatment })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}
