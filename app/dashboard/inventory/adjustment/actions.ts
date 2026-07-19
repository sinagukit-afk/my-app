'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function adjustStock(formData: FormData): Promise<ActionResult> {
  const variantId = formData.get('variant_id') as string
  const qtyDelta = Number(formData.get('qty_delta'))
  const reason = (formData.get('reason') as string)?.trim() || null
  const note = (formData.get('note') as string)?.trim() || null

  if (!variantId) return { success: false, error: 'Select an item to adjust.' }
  if (!qtyDelta || Number.isNaN(qtyDelta)) {
    return { success: false, error: 'Enter a non-zero adjustment quantity.' }
  }
  if (!reason) return { success: false, error: 'Select a reason for this adjustment.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('adjust_stock', {
    p_variant_id: variantId,
    p_qty_delta: qtyDelta,
    p_reason: reason,
    p_note: note,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/inventory/adjustment')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function bulkAdjustStock(
  items: { variant_id: string; qty_delta: number }[],
  note: string | null
): Promise<ActionResult> {
  if (!items.length) return { success: false, error: 'No counted quantities differ from current stock.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bulk_adjust_stock', {
    p_items: items,
    p_reason: 'physical_count',
    p_note: note,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/inventory/adjustment')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}
