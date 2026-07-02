'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') {
    return 'You do not have permission to perform this action.'
  }
  return error.message
}

function readExpenseFields(formData: FormData) {
  const date = (formData.get('date') as string) || undefined
  const category = (formData.get('category') as string)?.trim()
  const amountRaw = formData.get('amount') as string
  const amount = amountRaw ? Number(amountRaw) : NaN
  const note = (formData.get('note') as string)?.trim() || null
  return { date, category, amount, note }
}

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const { date, category, amount, note } = readExpenseFields(formData)
  if (!category) return { success: false, error: 'Category is required.' }
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('expenses').insert({
    date,
    category,
    amount,
    note,
    created_by: user?.id ?? null,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath('/dashboard/finance/expenses')
  return { success: true }
}

export async function updateExpense(id: string, formData: FormData): Promise<ActionResult> {
  const { date, category, amount, note } = readExpenseFields(formData)
  if (!category) return { success: false, error: 'Category is required.' }
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update({ date, category, amount, note }).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath('/dashboard/finance/expenses')
  return { success: true }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath('/dashboard/finance/expenses')
  return { success: true }
}
