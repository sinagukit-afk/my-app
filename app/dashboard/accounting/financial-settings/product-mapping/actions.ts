'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/accounting/financial-settings/product-mapping'

export type MappingInput = {
  item_id: string
  revenue_account_id: string | null
  inventory_account_id: string | null
  expense_account_id: string | null
}

export type SaveResult = { success: true } | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit account mappings.'
  return error.message
}

export async function saveItemAccountMappings(rows: MappingInput[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  const payload = rows.map((r) => ({
    item_id: r.item_id,
    revenue_account_id: r.revenue_account_id || null,
    inventory_account_id: r.inventory_account_id || null,
    expense_account_id: r.expense_account_id || null,
    updated_by: user.id,
  }))

  const { error } = await supabase.from('item_accounting_mappings').upsert(payload, { onConflict: 'item_id' })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export type CategoryDefaultInput = {
  category_id: string
  default_revenue_account_id: string | null
  default_inventory_account_id: string | null
  default_expense_account_id: string | null
}

export async function saveCategoryDefaultMappings(rows: CategoryDefaultInput[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  const results = await Promise.all(
    rows.map((r) =>
      supabase
        .from('categories')
        .update({
          default_revenue_account_id: r.default_revenue_account_id,
          default_inventory_account_id: r.default_inventory_account_id,
          default_expense_account_id: r.default_expense_account_id,
        })
        .eq('id', r.category_id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: friendlyError(failed.error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
