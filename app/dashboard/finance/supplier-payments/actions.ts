'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/finance/supplier-payments'

function friendlyError(error: { message: string }): string {
  return error.message
}

export async function logInventoryPayment(
  incomingItemId: string,
  paymentTypeId: string | null,
  amount: number,
  paidDate: string,
  notes: string | null
): Promise<ActionResult> {
  if (!amount || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('log_payable_payment', {
    p_payable_type: 'inventory',
    p_payable_id: incomingItemId,
    p_payment_type_id: paymentTypeId,
    p_amount: amount,
    p_paid_date: paidDate,
    p_notes: notes,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(`${LIST_PATH}/incoming/${incomingItemId}`)
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/purchasing/receiving')
  return { success: true }
}

export async function logInventoryPOPayment(
  purchaseOrderId: string,
  reference: string,
  paymentTypeId: string | null,
  amount: number,
  paidDate: string,
  notes: string | null
): Promise<ActionResult> {
  if (!amount || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('log_payable_payment', {
    p_payable_type: 'purchase_order',
    p_payable_id: purchaseOrderId,
    p_payment_type_id: paymentTypeId,
    p_amount: amount,
    p_paid_date: paidDate,
    p_notes: notes,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(`${LIST_PATH}/inventory-po/${reference}`)
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/purchasing/receiving')
  return { success: true }
}

export async function voidSupplierPayment(
  paymentId: string,
  reason: string,
  detailPath: string
): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: 'A reason is required to void a payment.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('void_payable_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(detailPath)
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/purchasing/receiving')
  return { success: true }
}
