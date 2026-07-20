'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { triggerWorkflow } from '@/lib/integrations/n8n'

export type UpdateComponentsResult = { success: true } | { success: false; error: string }

export type ComponentInput = {
  component_variant_id: string
  quantity: number
}

export type VariantComponentsInput = {
  variant_id: string
  components: ComponentInput[]
}

export async function updateComponents(
  itemId: string,
  variantComponents: VariantComponentsInput[]
): Promise<UpdateComponentsResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('update_composite_components', {
    p_item_id: itemId,
    p_variant_components: variantComponents,
  })

  if (error) return { success: false, error: error.message }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: item } = await supabase.from('items').select('name').eq('id', itemId).single()

  await supabase.from('activity_logs').insert({
    user_id: user?.id ?? null,
    action: 'update_item_components',
    entity_type: 'item',
    entity_id: itemId,
    description: item?.name ? `Product BOM for "${item.name}" updated` : 'Product BOM updated',
  })

  await triggerWorkflow('loyverse-item-push', { item_id: itemId })

  revalidatePath('/dashboard/management/product-bom')
  revalidatePath(`/dashboard/management/product-bom/${itemId}`)
  revalidatePath('/dashboard/management/items')
  revalidatePath(`/dashboard/management/items/${itemId}`)

  return { success: true }
}
