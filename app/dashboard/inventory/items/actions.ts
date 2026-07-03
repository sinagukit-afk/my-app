'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { triggerWorkflow } from '@/lib/integrations/n8n'

export type UpsertItemResult =
  | { success: true; itemId: string }
  | { success: false; error: string }

const LIST_PATH = '/dashboard/inventory/items'

export type VariantInput = {
  id?: string
  sku: string
  barcode?: string
  option1_value?: string
  option2_value?: string
  option3_value?: string
  cost: number | null
  default_price: number | null
  pricing_type: 'FIXED' | 'VARIABLE'
  initial_stock?: number
}

export type ComponentInput = {
  composite_sku: string
  component_variant_id: string
  quantity: number
}

export async function upsertItem(formData: FormData): Promise<UpsertItemResult> {
  const item_id = (formData.get('item_id') as string) || null
  const name = (formData.get('name') as string)?.trim()
  const category_id = (formData.get('category_id') as string) || null
  const description = (formData.get('description') as string)?.trim() || null
  const item_type = formData.get('item_type') as string
  const sold_by = formData.get('sold_by') as string
  const is_available_for_sale = formData.get('is_available_for_sale') === 'true'
  const track_stock = formData.get('track_stock') === 'true'
  const primary_supplier_id = (formData.get('primary_supplier_id') as string) || null
  const option1_name = (formData.get('option1_name') as string)?.trim() || null
  const option2_name = (formData.get('option2_name') as string)?.trim() || null
  const option3_name = (formData.get('option3_name') as string)?.trim() || null

  if (!name) return { success: false, error: 'Item name is required.' }
  if (!category_id) return { success: false, error: 'Category is required.' }

  let variants: VariantInput[] = []
  let components: ComponentInput[] = []
  let modifierIds: string[] = []
  try {
    variants = JSON.parse((formData.get('variants_json') as string) || '[]')
    components = JSON.parse((formData.get('components_json') as string) || '[]')
    modifierIds = JSON.parse((formData.get('modifier_ids_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid form data.' }
  }

  if (variants.length === 0) {
    return { success: false, error: 'At least one variant is required.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('upsert_item', {
    p_item_id: item_id,
    p_name: name,
    p_category_id: category_id,
    p_description: description,
    p_item_type: item_type,
    p_sold_by: sold_by,
    p_is_available_for_sale: is_available_for_sale,
    p_track_stock: track_stock,
    p_primary_supplier_id: primary_supplier_id,
    p_option1_name: option1_name,
    p_option2_name: option2_name,
    p_option3_name: option3_name,
    p_variants: variants,
    p_components: components,
    p_store_id: null,
    p_modifier_ids: modifierIds,
  })

  if (error) return { success: false, error: error.message }

  await triggerWorkflow('loyverse-item-push', { item_id: data.id })

  revalidatePath(LIST_PATH)
  return { success: true, itemId: data.id }
}
