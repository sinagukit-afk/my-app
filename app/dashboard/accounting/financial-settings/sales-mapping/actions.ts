'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { findNonPostableAccounts } from '@/lib/accounting/assert-postable-accounts'

const LIST_PATH = '/dashboard/accounting/financial-settings/sales-mapping'

export type MappingInput = { mapping_key: string; account_id: string | null }
export type SaveResult = { success: true } | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit Sales Mapping.'
  if (error.code === '23503') return 'One of the selected accounts no longer exists.'
  return error.message
}

export async function saveSalesMappings(rows: MappingInput[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  const postableError = await findNonPostableAccounts(supabase, rows.map((r) => r.account_id))
  if (postableError) return { success: false, error: postableError }

  const results = await Promise.all(
    rows.map((r) =>
      supabase
        .from('system_account_mappings')
        .update({ account_id: r.account_id, updated_by: user.id })
        .eq('mapping_key', r.mapping_key)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: friendlyError(failed.error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
