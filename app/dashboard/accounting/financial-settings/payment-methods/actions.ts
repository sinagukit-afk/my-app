'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/accounting/financial-settings/payment-methods'

export type PaymentMappingInput = {
  payment_type_id: string
  account_id: string | null
  bank_account_id: string | null
}

export type SaveResult = { success: true } | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit Payment Methods.'
  if (error.code === '23503') return 'One of the selected accounts no longer exists.'
  return error.message
}

export async function savePaymentTypeAccountMappings(rows: PaymentMappingInput[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  // account_id is required by the schema — rows without one aren't sent, same
  // "skip rather than guess" convention as the rest of this workstream's mapping pages.
  const payload = rows
    .filter((r) => r.account_id)
    .map((r) => ({
      payment_type_id: r.payment_type_id,
      account_id: r.account_id,
      bank_account_id: r.bank_account_id || null,
      updated_by: user.id,
    }))

  if (payload.length === 0) return { success: true }

  const { error } = await supabase
    .from('payment_type_accounting_mappings')
    .upsert(payload, { onConflict: 'payment_type_id' })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
