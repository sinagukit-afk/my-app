'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function releaseOnHoldStock(formData: FormData): Promise<ActionResult> {
  const variantId = formData.get('variant_id') as string
  const storeId = formData.get('store_id') as string
  const destination = formData.get('destination') as string
  const quantity = Number(formData.get('quantity'))
  const note = (formData.get('note') as string)?.trim() || null

  if (!variantId || !storeId) return { success: false, error: 'Missing item/store reference.' }
  if (destination !== 'available' && destination !== 'scrap') {
    return { success: false, error: 'Select where the stock should be released to.' }
  }
  if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
    return { success: false, error: 'Enter a positive quantity to release.' }
  }

  const supabase = await createClient()

  const { error } =
    destination === 'scrap'
      ? await supabase.rpc('release_to_scrap', {
          p_variant_id: variantId,
          p_store_id: storeId,
          p_quantity: quantity,
          p_note: note,
        })
      : await supabase.rpc('transfer_stock_status', {
          p_variant_id: variantId,
          p_store_id: storeId,
          p_from_status: 'on_hold',
          p_to_status: destination,
          p_quantity: quantity,
          p_note: note,
        })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/inventory/items-for-review')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}
