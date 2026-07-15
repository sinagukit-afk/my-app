'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/accounting/financial-settings/expense-categories'

export type SaveResult = { success: true } | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit category mappings.'
  return error.message
}

export type ExpenseCategoryMapping = {
  id: string
  default_expense_account_id: string | null
  accounting_treatment: 'immediate' | 'prepaid' | 'fixed_asset'
  default_prepaid_account_id: string | null
  default_amortization_months: number | null
  default_asset_category_id: string | null
}

export async function saveExpenseCategoryMappings(rows: ExpenseCategoryMapping[]): Promise<SaveResult> {
  const supabase = await createClient()

  for (const row of rows) {
    const { error } = await supabase
      .from('expense_categories')
      .update({
        default_expense_account_id: row.default_expense_account_id || null,
        accounting_treatment: row.accounting_treatment,
        default_prepaid_account_id: row.default_prepaid_account_id || null,
        default_amortization_months: row.default_amortization_months || null,
        default_asset_category_id: row.default_asset_category_id || null,
      })
      .eq('id', row.id)
    if (error) return { success: false, error: friendlyError(error) }
  }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/finance/expenses')
  return { success: true }
}

export async function createExpenseCategory(name: string): Promise<SaveResult> {
  if (!name.trim()) return { success: false, error: 'Enter a category name.' }
  const supabase = await createClient()
  const { error } = await supabase.from('expense_categories').insert({ name: name.trim() })
  if (error) return { success: false, error: friendlyError(error) }
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/finance/expenses')
  return { success: true }
}

export async function createAssetCategory(name: string): Promise<SaveResult> {
  if (!name.trim()) return { success: false, error: 'Enter a category name.' }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_categories').insert({ name: name.trim() })
  if (error) return { success: false, error: friendlyError(error) }
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/finance/fixed-assets')
  return { success: true }
}

export type AssetCategoryMapping = {
  id: string
  default_asset_account_id: string | null
  default_accum_depreciation_account_id: string | null
  default_depreciation_expense_account_id: string | null
  default_useful_life_months: number | null
}

export async function saveAssetCategoryMappings(rows: AssetCategoryMapping[]): Promise<SaveResult> {
  const supabase = await createClient()

  for (const row of rows) {
    const { error } = await supabase
      .from('asset_categories')
      .update({
        default_asset_account_id: row.default_asset_account_id || null,
        default_accum_depreciation_account_id: row.default_accum_depreciation_account_id || null,
        default_depreciation_expense_account_id: row.default_depreciation_expense_account_id || null,
        default_useful_life_months: row.default_useful_life_months || null,
      })
      .eq('id', row.id)
    if (error) return { success: false, error: friendlyError(error) }
  }

  revalidatePath(LIST_PATH)
  return { success: true }
}
