'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/accounting/credit-card-payable'

export type ActionResult = { success: true } | { success: false; error: string }

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') {
    return 'You do not have permission to do that.'
  }
  // log_credit_card_installment_payment() raises plpgsql exceptions (not
  // authorized, invalid amount, exceeds outstanding balance) — surface
  // their message text directly, it's already user-facing.
  return error.message
}

export async function logInstallmentPayment(
  paymentTypeId: string,
  principalAmount: number,
  interestAmount: number,
  paidDate: string,
  notes: string
): Promise<ActionResult> {
  if (!paymentTypeId) return { success: false, error: 'Select a payment method.' }
  if (!(principalAmount > 0)) return { success: false, error: 'Principal amount must be greater than zero.' }
  if (interestAmount < 0) return { success: false, error: 'Interest amount cannot be negative.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('log_credit_card_installment_payment', {
    p_payment_type_id: paymentTypeId,
    p_principal_amount: principalAmount,
    p_interest_amount: interestAmount,
    p_paid_date: paidDate || new Date().toISOString().slice(0, 10),
    p_notes: notes.trim() || null,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/accounting/review')
  return { success: true }
}
