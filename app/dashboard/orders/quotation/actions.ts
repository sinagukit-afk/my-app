'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ResolvedQuoteLine } from './quote-line-items'

export type ActionResult = { success: true } | { success: false; error: string }
export type CreateResult = { success: true; id: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/orders/quotation'
const ORDER_LIST_PATH = '/dashboard/orders/active-orders'

function readQuoteFields(formData: FormData) {
  const customer_id = (formData.get('customer_id') as string) || null
  const note = (formData.get('note') as string)?.trim() || null
  const quote_date = (formData.get('quote_date') as string) || new Date().toISOString().slice(0, 10)
  const valid_until = (formData.get('valid_until') as string) || null
  return { customer_id, note, quote_date, valid_until }
}

function readItems(formData: FormData): ResolvedQuoteLine[] {
  try {
    return JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return []
  }
}

function computeTotals(items: ResolvedQuoteLine[]) {
  // Mirrors quote-line-items.tsx's lineTotal(): qty * (unit price + per-unit modifier total) - line discount.
  const subtotal = items.reduce((sum, i) => {
    const modifierTotal = i.modifiers.reduce((s, m) => s + m.price_snapshot, 0)
    return sum + Math.max(0, i.quantity * (i.unit_price + modifierTotal) - i.line_discount)
  }, 0)
  const total_discount = items.reduce((sum, i) => sum + i.line_discount, 0)
  return { subtotal, total_discount }
}

async function insertItemsAndModifiers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
  items: ResolvedQuoteLine[]
): Promise<string | null> {
  const { data: insertedItems, error: itemsError } = await supabase
    .from('quote_items')
    .insert(
      items.map((item) => ({
        quote_id: quoteId,
        variant_id: item.variant_id,
        item_name_snapshot: item.item_name_snapshot,
        sku_snapshot: item.sku_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_id: item.discount_id,
        line_discount: item.line_discount,
      }))
    )
    .select('id')

  if (itemsError) return itemsError.message
  if (!insertedItems) return null

  const modifierRows = items.flatMap((item, idx) =>
    item.modifiers.map((m) => ({
      quote_item_id: insertedItems[idx].id,
      modifier_id: m.modifier_id,
      modifier_option_id: m.modifier_option_id,
      name_snapshot: m.name_snapshot,
      price_snapshot: m.price_snapshot,
    }))
  )

  if (modifierRows.length > 0) {
    const { error: modifiersError } = await supabase.from('quote_item_modifiers').insert(modifierRows)
    if (modifiersError) return modifiersError.message
  }

  return null
}

export async function createQuoteWithItems(formData: FormData): Promise<CreateResult> {
  const { customer_id, note, quote_date, valid_until } = readQuoteFields(formData)
  const items = readItems(formData)

  if (items.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }
  if (!valid_until) {
    return { success: false, error: 'Valid Until date is required.' }
  }

  const { subtotal, total_discount } = computeTotals(items)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      customer_id,
      created_by: user?.id ?? null,
      note,
      quote_date,
      valid_until,
      subtotal,
      total_discount,
      total_tax: 0,
      total_money: subtotal,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const itemsError = await insertItemsAndModifiers(supabase, quote.id, items)
  if (itemsError) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return { success: false, error: itemsError }
  }

  await supabase.from('activity_logs').insert({
    user_id: user?.id ?? null,
    action: 'quote_created',
    entity_type: 'quote',
    entity_id: quote.id,
    description: 'Quote created',
  })

  revalidatePath(LIST_PATH)
  return { success: true, id: quote.id }
}

export async function updateQuoteWithItems(quoteId: string, formData: FormData): Promise<ActionResult> {
  const { customer_id, note, quote_date, valid_until } = readQuoteFields(formData)
  const items = readItems(formData)

  if (items.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }
  if (!valid_until) {
    return { success: false, error: 'Valid Until date is required.' }
  }

  const { subtotal, total_discount } = computeTotals(items)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existingQuote } = await supabase
    .from('quotes')
    .select('status, valid_until')
    .eq('id', quoteId)
    .single()

  if (!existingQuote || existingQuote.status !== 'open') {
    return { success: false, error: 'Only open quotes can be edited.' }
  }
  if (existingQuote.valid_until < new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'This quote has expired and can no longer be edited.' }
  }

  // Snapshot the pre-edit quote + items to activity_logs, so what was originally quoted
  // stays visible even after the edit overwrites quote_items below.
  const { data: previousQuote } = await supabase
    .from('quotes')
    .select('customer_id, note, quote_date, valid_until, subtotal, total_discount, total_money')
    .eq('id', quoteId)
    .single()
  const { data: previousItems } = await supabase
    .from('quote_items')
    .select('id, item_name_snapshot, sku_snapshot, quantity, unit_price, discount_id, line_discount')
    .eq('quote_id', quoteId)

  await supabase.from('activity_logs').insert({
    user_id: user?.id ?? null,
    action: 'quote_edited',
    entity_type: 'quote',
    entity_id: quoteId,
    description: 'Quote edited — snapshot of what was quoted before this change',
    metadata: {
      previous_quote: previousQuote,
      previous_items: (previousItems ?? []).map(({ id: _id, ...rest }) => rest),
    },
  })

  const previousItemIds = (previousItems ?? []).map((item) => item.id)

  const itemsError = await insertItemsAndModifiers(supabase, quoteId, items)
  if (itemsError) return { success: false, error: itemsError }

  if (previousItemIds.length > 0) {
    const { error: deleteError } = await supabase.from('quote_items').delete().in('id', previousItemIds)
    if (deleteError) return { success: false, error: deleteError.message }
  }

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ customer_id, note, quote_date, valid_until, subtotal, total_discount, total_money: subtotal, updated_at: new Date().toISOString() })
    .eq('id', quoteId)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath(LIST_PATH)
  revalidatePath(LIST_PATH, 'layout')
  return { success: true }
}

export async function convertQuote(quoteId: string, targetDate: string): Promise<ActionResult> {
  if (!targetDate) {
    return { success: false, error: 'Target date is required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('convert_quote_to_order', { p_quote_id: quoteId, p_target_date: targetDate })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(LIST_PATH, 'layout')
  revalidatePath(ORDER_LIST_PATH)
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function cancelQuote(quoteId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existingQuote } = await supabase.from('quotes').select('status, valid_until').eq('id', quoteId).single()
  if (!existingQuote || existingQuote.status !== 'open') {
    return { success: false, error: 'Only open quotes can be cancelled.' }
  }
  if (existingQuote.valid_until < new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'This quote has expired and can no longer be cancelled.' }
  }

  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'cancelled',
      cancellation_reason: reason.trim() || null,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id ?? null,
    })
    .eq('id', quoteId)

  if (error) return { success: false, error: error.message }

  await supabase.from('activity_logs').insert({
    user_id: user?.id ?? null,
    action: 'quote_cancelled',
    entity_type: 'quote',
    entity_id: quoteId,
    description: reason.trim() ? `Quote cancelled — ${reason.trim()}` : 'Quote cancelled',
  })

  revalidatePath(LIST_PATH)
  revalidatePath(LIST_PATH, 'layout')
  return { success: true }
}
