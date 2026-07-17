'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }
export type CreateResult = { success: true; reference: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/purchasing/asset-po'

function detailPath(reference: string) {
  return `${LIST_PATH}/${reference}`
}

export type NewItemInput = {
  asset_category_id: string
  description: string
  quantity_ordered: number
  unit_cost: number
  discount_amount: number
}

export async function createAssetPurchaseOrder(formData: FormData): Promise<CreateResult> {
  const supplier_id = (formData.get('supplier_id') as string) || null
  const order_date = (formData.get('order_date') as string) || new Date().toISOString().slice(0, 10)
  const expected_date = (formData.get('expected_date') as string)?.trim() || null
  const shipping_fee = Number(formData.get('shipping_fee') ?? 0) || 0
  const note = (formData.get('note') as string)?.trim() || null

  let items: NewItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.asset_category_id && i.description && i.quantity_ordered > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a category, description, and quantity greater than zero.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({ po_type: 'asset', supplier_id, order_date, expected_date, shipping_fee, note, created_by: user?.id ?? null })
    .select('id, reference')
    .single()

  if (error) return { success: false, error: error.message }

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(
    validItems.map((item) => ({
      purchase_order_id: po.id,
      asset_category_id: item.asset_category_id,
      description: item.description,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
      discount_amount: item.discount_amount,
      line_total: item.quantity_ordered * item.unit_cost - item.discount_amount,
    }))
  )

  if (itemsError) {
    await supabase.from('purchase_orders').delete().eq('id', po.id)
    return { success: false, error: itemsError.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true, reference: po.reference }
}

export async function updateAssetPurchaseOrderHeader(
  id: string,
  reference: string,
  formData: FormData
): Promise<ActionResult> {
  const supplier_id = (formData.get('supplier_id') as string) || null
  const order_date = (formData.get('order_date') as string) || new Date().toISOString().slice(0, 10)
  const expected_date = (formData.get('expected_date') as string)?.trim() || null
  const shipping_fee = Number(formData.get('shipping_fee') ?? 0) || 0
  const note = (formData.get('note') as string)?.trim() || null

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
  received: [],
  cancelled: [],
}

export async function setAssetPurchaseOrderStatus(
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
  return { success: true }
}

export async function deleteAssetPurchaseOrder(id: string): Promise<ActionResult> {
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

export async function addAssetPurchaseOrderItem(
  purchaseOrderId: string,
  reference: string,
  formData: FormData
): Promise<ActionResult> {
  const asset_category_id = formData.get('asset_category_id') as string
  const description = (formData.get('description') as string)?.trim()
  const quantity_ordered = Number(formData.get('quantity_ordered'))
  const unit_cost = Number(formData.get('unit_cost') ?? 0) || 0
  const discount_amount = Number(formData.get('discount_amount') ?? 0) || 0

  if (!asset_category_id) return { success: false, error: 'Select an asset category.' }
  if (!description) return { success: false, error: 'Enter a description.' }
  if (!quantity_ordered || quantity_ordered <= 0) {
    return { success: false, error: 'Enter a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('purchase_order_items').insert({
    purchase_order_id: purchaseOrderId,
    asset_category_id,
    description,
    quantity_ordered,
    unit_cost,
    discount_amount,
    line_total: quantity_ordered * unit_cost - discount_amount,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(detailPath(reference))
  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function removeAssetPurchaseOrderItem(
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

export type ReceiveLine = { po_item_id: string; quantity: number; useful_life_months?: number; salvage_value?: number }

export async function receiveAssetPurchaseOrder(
  purchaseOrderId: string,
  reference: string,
  lines: ReceiveLine[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('receive_asset_purchase_order', {
    p_purchase_order_id: purchaseOrderId,
    p_lines: lines,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(detailPath(reference))
  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/finance/fixed-assets')
  return { success: true }
}
