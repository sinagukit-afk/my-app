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
  const same_as_customer = formData.get('same_as_customer') !== 'false'
  const receiver_name = (formData.get('receiver_name') as string)?.trim() || null

  if (!same_as_customer && !receiver_name) {
    return { success: false, error: 'Receiver name is required when shipping to someone other than the customer.' }
  }

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
    p_same_as_customer: same_as_customer,
    p_receiver_name: same_as_customer ? null : receiver_name,
    p_receiver_phone: same_as_customer ? null : (formData.get('receiver_phone') as string)?.trim() || null,
    p_receiver_address_line1: same_as_customer
      ? null
      : (formData.get('receiver_address_line1') as string)?.trim() || null,
    p_receiver_barangay: same_as_customer ? null : (formData.get('receiver_barangay') as string)?.trim() || null,
    p_receiver_city: same_as_customer ? null : (formData.get('receiver_city') as string)?.trim() || null,
    p_receiver_province: same_as_customer ? null : (formData.get('receiver_province') as string)?.trim() || null,
    p_receiver_postal_code: same_as_customer
      ? null
      : (formData.get('receiver_postal_code') as string)?.trim() || null,
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
