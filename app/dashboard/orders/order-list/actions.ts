'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/orders/order-list'

export type OrderItemInput = {
  variant_id: string
  item_name_snapshot: string
  sku_snapshot: string | null
  quantity: number
  unit_price: number
  line_discount: number
}

export async function adjustOrderItems(orderId: string, formData: FormData): Promise<ActionResult> {
  const customer_id = (formData.get('customer_id') as string) || null
  const note = (formData.get('note') as string)?.trim() || null

  let items: OrderItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.variant_id && i.quantity > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('adjust_order_items', {
    p_order_id: orderId,
    p_lines: validItems,
    p_customer_id: customer_id,
    p_note: note,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/inventory/stock-movement')
  return { success: true }
}

export async function startProduction(orderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ status: 'in_production' })
    .eq('id', orderId)
    .eq('status', 'confirmed')

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/orders/production-queue')
  return { success: true }
}
