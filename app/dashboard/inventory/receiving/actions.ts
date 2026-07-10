'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function createManualIncoming(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  const item_id = (formData.get('item_id') as string)?.trim()
  const variant_id = (formData.get('variant_id') as string)?.trim() || null
  const supplier_id = (formData.get('supplier_id') as string)?.trim() || null
  const quantity = parseFloat(formData.get('quantity') as string)
  const unit_price = parseFloat(formData.get('unit_price') as string)
  const date_received = (formData.get('date_received') as string)?.trim()
  const notes = (formData.get('notes') as string)?.trim() || null
  const payment_type_id = (formData.get('payment_type_id') as string)?.trim() || null
  const is_credit_card = formData.get('is_credit_card') === 'true'

  if (!item_id) return { success: false, error: 'Item is required.' }
  if (!date_received) return { success: false, error: 'Date received is required.' }
  if (isNaN(quantity) || quantity <= 0) return { success: false, error: 'Quantity must be a positive number.' }
  if (isNaN(unit_price) || unit_price < 0) return { success: false, error: 'Unit price must be zero or more.' }

  // Resolve item name snapshot
  const { data: item } = await supabase
    .from('items')
    .select('name')
    .eq('id', item_id)
    .single()

  if (!item) return { success: false, error: 'Selected item not found.' }

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

  const { error } = await supabase.from('incoming_items').insert({
    item_id,
    variant_id,
    item_name_snapshot: item.name,
    quantity,
    unit_price,
    total_price: quantity * unit_price,
    date_received,
    supplier_id,
    supplier: supplierText,
    source: 'manual',
    received_by: user.id,
    received_by_email: user.email ?? null,
    notes,
    purchase_order_id: null,
    shipping_fee: 0,
    discount_amount: 0,
    payment_type_id,
    is_credit_card,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/inventory/receiving')
  return { success: true }
}
