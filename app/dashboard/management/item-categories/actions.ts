'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/management/item-categories'
const CATEGORY_TYPES = ['product', 'packaging'] as const

function readCategoryFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const category_type = (formData.get('category_type') as string)?.trim()
  const color = (formData.get('color') as string)?.trim() || null
  return { name, category_type, color }
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const { name, category_type, color } = readCategoryFields(formData)
  if (!name) return { success: false, error: 'Category name is required.' }
  if (!CATEGORY_TYPES.includes(category_type as (typeof CATEGORY_TYPES)[number])) {
    return { success: false, error: 'Category type must be Product or Packaging.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('categories').insert({ name, category_type, color })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  const { name, category_type, color } = readCategoryFields(formData)
  if (!name) return { success: false, error: 'Category name is required.' }
  if (!CATEGORY_TYPES.includes(category_type as (typeof CATEGORY_TYPES)[number])) {
    return { success: false, error: 'Category type must be Product or Packaging.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ name, category_type, color })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function restoreCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}
