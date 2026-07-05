'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

function revalidateInventoryPaths() {
  revalidatePath('/dashboard/inventory')
  revalidatePath('/dashboard/inventory/stock-movement')
}

export async function transferStockStatus(formData: FormData): Promise<ActionResult> {
  const variantId = formData.get('variant_id') as string
  const storeId = formData.get('store_id') as string
  const fromStatus = formData.get('from_status') as string
  const toStatus = formData.get('to_status') as string
  const quantity = Number(formData.get('quantity'))
  const note = (formData.get('note') as string)?.trim() || null

  if (!variantId || !storeId) return { success: false, error: 'Missing variant or store.' }
  if (!fromStatus || !toStatus) return { success: false, error: 'Select both a from and to status.' }
  if (fromStatus === toStatus) return { success: false, error: 'From and to status must differ.' }
  if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
    return { success: false, error: 'Enter a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('transfer_stock_status', {
    p_variant_id: variantId,
    p_store_id: storeId,
    p_from_status: fromStatus,
    p_to_status: toStatus,
    p_quantity: quantity,
    p_note: note,
  })

  if (error) return { success: false, error: error.message }

  revalidateInventoryPaths()
  return { success: true }
}

export async function adjustIncomingQty(formData: FormData): Promise<ActionResult> {
  const variantId = formData.get('variant_id') as string
  const storeId = formData.get('store_id') as string
  const quantityChange = Number(formData.get('quantity_change'))
  const note = (formData.get('note') as string)?.trim() || null

  if (!variantId || !storeId) return { success: false, error: 'Missing variant or store.' }
  if (!quantityChange || Number.isNaN(quantityChange)) {
    return { success: false, error: 'Enter a non-zero quantity.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('adjust_incoming_qty', {
    p_variant_id: variantId,
    p_store_id: storeId,
    p_quantity_change: quantityChange,
    p_note: note,
  })

  if (error) return { success: false, error: error.message }

  revalidateInventoryPaths()
  return { success: true }
}
