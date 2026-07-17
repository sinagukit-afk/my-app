'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }
export type CreateResult = { success: true; reference: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/purchasing/inventory-po'

function detailPath(reference: string) {
  return `${LIST_PATH}/${reference}`
}

export type NewItemInput = {
  variant_id: string
  item_name_snapshot: string
  quantity_ordered: number
  unit_cost: number
  discount_amount: number
  line_total: number
}

export async function createPurchaseOrderWithItems(formData: FormData): Promise<CreateResult> {
  const supplier_id = formData.get('supplier_id') as string
  const order_date = (formData.get('order_date') as string) || new Date().toISOString().slice(0, 10)
  const expected_date = (formData.get('expected_date') as string)?.trim() || null
  const shipping_fee = Number(formData.get('shipping_fee') ?? 0) || 0
  const note = (formData.get('note') as string)?.trim() || null

  if (!supplier_id) return { success: false, error: 'Select a supplier.' }

  let items: NewItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.variant_id && i.quantity_ordered > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({ supplier_id, order_date, expected_date, shipping_fee, note, created_by: user?.id ?? null })
    .select('id, reference')
    .single()

  if (error) return { success: false, error: error.message }

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(
    validItems.map((item) => ({
      purchase_order_id: po.id,
      variant_id: item.variant_id,
      item_name_snapshot: item.item_name_snapshot,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
      discount_amount: item.discount_amount,
      line_total: item.line_total,
    }))
  )

  if (itemsError) {
    await supabase.from('purchase_orders').delete().eq('id', po.id)
    return { success: false, error: itemsError.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true, reference: po.reference }
}

export async function updatePurchaseOrderHeader(
  id: string,
  reference: string,
  formData: FormData
): Promise<ActionResult> {
  const supplier_id = formData.get('supplier_id') as string
  const order_date = (formData.get('order_date') as string) || new Date().toISOString().slice(0, 10)
  const expected_date = (formData.get('expected_date') as string)?.trim() || null
  const shipping_fee = Number(formData.get('shipping_fee') ?? 0) || 0
  const note = (formData.get('note') as string)?.trim() || null

  if (!supplier_id) return { success: false, error: 'Select a supplier.' }

  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('subtotal')
    .eq('id', id)
    .single()

  if (fetchError) return { success: false, error: fetchError.message }

  const total = Number(current.subtotal) + shipping_fee

  const { error } = await supabase
    .from('purchase_orders')
    .update({ supplier_id, order_date, expected_date, shipping_fee, total, note })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(detailPath(reference))
  revalidatePath(LIST_PATH)
  return { success: true }
}

const NEXT_STATUS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['cancelled'],
  partial: [],
  received: ['closed'],
  closed: [],
  cancelled: [],
}

export async function setPurchaseOrderStatus(
  id: string,
  reference: string,
  nextStatus: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) return { success: false, error: fetchError.message }

  const allowed = NEXT_STATUS[current.status] ?? []
  if (!allowed.includes(nextStatus)) {
    return { success: false, error: `Cannot move from "${current.status}" to "${nextStatus}".` }
  }

  const { error } = await supabase.from('purchase_orders').update({ status: nextStatus }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(detailPath(reference))
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/purchasing/receiving')
  return { success: true }
}

export async function deletePurchaseOrder(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Cannot delete: this purchase order has related records. Cancel it instead.',
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function addPurchaseOrderItem(
  purchaseOrderId: string,
  reference: string,
  formData: FormData
): Promise<ActionResult> {
  const variant_id = formData.get('variant_id') as string
  const item_name_snapshot = (formData.get('item_name_snapshot') as string) || null
  const quantity_ordered = Number(formData.get('quantity_ordered'))
  const unit_cost = Number(formData.get('unit_cost') ?? 0) || 0
  const discount_amount = Number(formData.get('discount_amount') ?? 0) || 0
  const line_total = Number(formData.get('line_total') ?? 0) || 0

  if (!variant_id) return { success: false, error: 'Select an item.' }
  if (!quantity_ordered || quantity_ordered <= 0) {
    return { success: false, error: 'Enter a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('purchase_order_items').insert({
    purchase_order_id: purchaseOrderId,
    variant_id,
    item_name_snapshot,
    quantity_ordered,
    unit_cost,
    discount_amount,
    line_total,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(detailPath(reference))
  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function removePurchaseOrderItem(
  purchaseOrderId: string,
  reference: string,
  itemId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('purchase_order_items').delete().eq('id', itemId)

  if (error) return { success: false, error: error.message }

  revalidatePath(detailPath(reference))
  revalidatePath(LIST_PATH)
  return { success: true }
}
