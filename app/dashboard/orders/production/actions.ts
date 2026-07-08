'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/orders/production'

export async function completeProductionOrder(productionOrderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_production_order', {
    p_production_order_id: productionOrderId,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/orders/active-orders')
  return { success: true }
}

export async function startProductionOrder(productionOrderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('start_production_order', {
    p_production_order_id: productionOrderId,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function addProductionCompletedQty(
  productionOrderId: string,
  qty: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('add_production_completed_qty', {
    p_production_order_id: productionOrderId,
    p_qty: qty,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function cancelProductionOrder(productionOrderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_production_order', {
    p_production_order_id: productionOrderId,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/orders/active-orders')
  return { success: true }
}
