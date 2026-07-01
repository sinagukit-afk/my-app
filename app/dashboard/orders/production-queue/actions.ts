'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const QUEUE_PATH = '/dashboard/orders/production-queue'
const COMPLETED_PATH = '/dashboard/orders/completed'

export async function completeOrder(orderId: string, loyverseReceiptNumber: string): Promise<ActionResult> {
  const receipt = loyverseReceiptNumber.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update(
      receipt
        ? {
            status: 'completed',
            loyverse_receipt_number: receipt,
            sync_status: 'synced',
            synced_at: new Date().toISOString(),
          }
        : { status: 'completed' }
    )
    .eq('id', orderId)
    .eq('status', 'in_production')

  if (error) return { success: false, error: error.message }

  revalidatePath(QUEUE_PATH)
  revalidatePath(COMPLETED_PATH)
  return { success: true }
}
