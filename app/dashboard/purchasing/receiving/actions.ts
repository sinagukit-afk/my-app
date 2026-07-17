'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export type NewIncomingItemInput = {
  item_id: string
  variant_id: string | null
  item_name_snapshot: string
  quantity: number
  unit_price: number
  discount_amount: number
  line_total: number
}

export async function createManualIncomingWithItems(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  const supplier_id = (formData.get('supplier_id') as string)?.trim() || null
  const date_received = (formData.get('date_received') as string)?.trim()
  const notes = (formData.get('notes') as string)?.trim() || null
  const shipping_fee = Number(formData.get('shipping_fee') ?? 0) || 0

  if (!date_received) return { success: false, error: 'Date received is required.' }

  let items: NewIncomingItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.item_id && i.quantity > 0 && i.line_total >= 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  // Resolve supplier text snapshot for movement note
  let supplierText: string | null = null
  if (supplier_id) {
    const { data: sup } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', supplier_id)
      .single()
    supplierText = sup?.name ?? null
  }

  const { error } = await supabase.from('incoming_items').insert(
    validItems.map((item, index) => ({
      item_id: item.item_id,
      variant_id: item.variant_id,
      item_name_snapshot: item.item_name_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.line_total,
      date_received,
      supplier_id,
      supplier: supplierText,
      source: 'manual',
      received_by: user.id,
      received_by_email: user.email ?? null,
      notes,
      purchase_order_id: null,
      shipping_fee: index === 0 ? shipping_fee : 0,
      discount_amount: item.discount_amount,
    }))
  )

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/purchasing/receiving')
  return { success: true }
}
