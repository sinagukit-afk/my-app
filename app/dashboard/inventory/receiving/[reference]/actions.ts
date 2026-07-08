'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function receivePurchaseOrder(
  purchaseOrderId: string,
  reference: string,
  lines: { po_item_id: string; quantity: number }[]
): Promise<ActionResult> {
  const validLines = lines.filter((l) => l.quantity > 0)
  if (validLines.length === 0) {
    return { success: false, error: 'Enter a received quantity for at least one item.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('receive_purchase_order', {
    p_purchase_order_id: purchaseOrderId,
    p_lines: validLines,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/inventory/receiving/${reference}`)
  revalidatePath('/dashboard/inventory/receiving')
  revalidatePath(`/dashboard/inventory/purchase-orders/${reference}`)
  revalidatePath('/dashboard/inventory/purchase-orders')
  revalidatePath('/dashboard/inventory/stock-movement')
  return { success: true }
}
