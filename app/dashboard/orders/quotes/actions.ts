'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }
export type CreateResult = { success: true; id: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/orders/quotes'
const ORDER_LIST_PATH = '/dashboard/orders/order-list'

export type NewOrderItemInput = {
  variant_id: string
  item_name_snapshot: string
  sku_snapshot: string | null
  quantity: number
  unit_price: number
  line_discount: number
}

function readReceiverFields(formData: FormData) {
  const same_as_customer = formData.get('same_as_customer') !== 'false'
  if (same_as_customer) {
    return {
      same_as_customer: true,
      receiver_name: null,
      receiver_phone: null,
      receiver_address_line1: null,
      receiver_barangay: null,
      receiver_city: null,
      receiver_province: null,
      receiver_postal_code: null,
    }
  }
  return {
    same_as_customer: false,
    receiver_name: (formData.get('receiver_name') as string)?.trim() || null,
    receiver_phone: (formData.get('receiver_phone') as string)?.trim() || null,
    receiver_address_line1: (formData.get('receiver_address_line1') as string)?.trim() || null,
    receiver_barangay: (formData.get('receiver_barangay') as string)?.trim() || null,
    receiver_city: (formData.get('receiver_city') as string)?.trim() || null,
    receiver_province: (formData.get('receiver_province') as string)?.trim() || null,
    receiver_postal_code: (formData.get('receiver_postal_code') as string)?.trim() || null,
  }
}

export async function createQuoteWithItems(formData: FormData): Promise<CreateResult> {
  const customer_id = (formData.get('customer_id') as string) || null
  const note = (formData.get('note') as string)?.trim() || null
  const receiverFields = readReceiverFields(formData)

  if (!receiverFields.same_as_customer && !receiverFields.receiver_name) {
    return { success: false, error: 'Receiver name is required when shipping to someone other than the customer.' }
  }

  let items: NewOrderItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.variant_id && i.quantity > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  const subtotal = validItems.reduce((sum, i) => sum + (i.quantity * i.unit_price - i.line_discount), 0)
  const total_discount = validItems.reduce((sum, i) => sum + i.line_discount, 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id,
      created_by: user?.id ?? null,
      note,
      subtotal,
      total_discount,
      total_tax: 0,
      total_money: subtotal,
      ...receiverFields,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const { error: itemsError } = await supabase.from('order_items').insert(
    validItems.map((item) => ({
      order_id: order.id,
      variant_id: item.variant_id,
      item_name_snapshot: item.item_name_snapshot,
      sku_snapshot: item.sku_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_discount: item.line_discount,
    }))
  )

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id)
    return { success: false, error: itemsError.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true, id: order.id }
}

export async function updateQuoteWithItems(orderId: string, formData: FormData): Promise<ActionResult> {
  const customer_id = (formData.get('customer_id') as string) || null
  const note = (formData.get('note') as string)?.trim() || null
  const receiverFields = readReceiverFields(formData)

  if (!receiverFields.same_as_customer && !receiverFields.receiver_name) {
    return { success: false, error: 'Receiver name is required when shipping to someone other than the customer.' }
  }

  let items: NewOrderItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.variant_id && i.quantity > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  const subtotal = validItems.reduce((sum, i) => sum + (i.quantity * i.unit_price - i.line_discount), 0)
  const total_discount = validItems.reduce((sum, i) => sum + i.line_discount, 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Snapshot the pre-edit order + items to activity_logs, so what was originally quoted
  // stays visible even after the edit overwrites order_items below.
  const { data: previousOrder } = await supabase
    .from('orders')
    .select('customer_id, note, subtotal, total_discount, total_money')
    .eq('id', orderId)
    .single()
  const { data: previousItems } = await supabase
    .from('order_items')
    .select('id, item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount')
    .eq('order_id', orderId)

  await supabase.from('activity_logs').insert({
    user_id: user?.id ?? null,
    action: 'quote_edited',
    entity_type: 'order',
    entity_id: orderId,
    description: 'Quote edited — snapshot of what was quoted before this change',
    metadata: {
      previous_order: previousOrder,
      previous_items: (previousItems ?? []).map(({ id: _id, ...rest }) => rest),
    },
  })

  const previousItemIds = (previousItems ?? []).map((item) => item.id)

  // Insert the new items before deleting the old ones, so a failed insert doesn't lose data.
  const { error: insertError } = await supabase.from('order_items').insert(
    validItems.map((item) => ({
      order_id: orderId,
      variant_id: item.variant_id,
      item_name_snapshot: item.item_name_snapshot,
      sku_snapshot: item.sku_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_discount: item.line_discount,
    }))
  )

  if (insertError) return { success: false, error: insertError.message }

  if (previousItemIds.length > 0) {
    const { error: deleteError } = await supabase.from('order_items').delete().in('id', previousItemIds)
    if (deleteError) return { success: false, error: deleteError.message }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ customer_id, note, subtotal, total_discount, total_money: subtotal, ...receiverFields })
    .eq('id', orderId)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function confirmQuote(orderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(ORDER_LIST_PATH)
  revalidatePath('/dashboard/inventory/stock-movement')
  return { success: true }
}

export async function cancelQuote(orderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function deleteQuote(orderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').delete().eq('id', orderId)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}
