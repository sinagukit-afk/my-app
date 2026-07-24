'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canManageMarketing, MARKETING_DENIED } from '../access'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/marketing/products'

/** Lowercase words separated by single hyphens — this is the public URL segment. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** No `updated_at` trigger exists on the web_* tables, so every update stamps it here. */
function stamped<T extends object>(fields: T) {
  return { ...fields, updated_at: new Date().toISOString() }
}

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null
}

function readProductFields(formData: FormData) {
  return {
    name: text(formData, 'name'),
    slug: text(formData, 'slug').toLowerCase(),
    category: optionalText(formData, 'category'),
    description: optionalText(formData, 'description'),
    starting_price: Number(text(formData, 'starting_price')),
    moq: Number(text(formData, 'moq')),
    lead_time_standard: text(formData, 'lead_time_standard'),
    rush_option: optionalText(formData, 'rush_option'),
    pricing_notes: optionalText(formData, 'pricing_notes'),
    sort_order: Number(text(formData, 'sort_order') || '0'),
    published: text(formData, 'published') === 'true',
  }
}

function validateProduct(fields: ReturnType<typeof readProductFields>): string | null {
  if (!fields.name) return 'Product name is required.'
  if (!fields.slug) return 'Slug is required — it becomes the product URL on the website.'
  if (!SLUG_PATTERN.test(fields.slug)) {
    return 'Slug must be lowercase letters, numbers, and single hyphens (e.g. "engraved-wooden-plaque").'
  }
  if (!fields.lead_time_standard) return 'Standard lead time is required.'
  if (!Number.isFinite(fields.starting_price) || fields.starting_price < 0) {
    return 'Starting price must be zero or more.'
  }
  if (!Number.isInteger(fields.moq) || fields.moq < 1) {
    return 'Minimum order quantity must be a whole number of 1 or more.'
  }
  if (!Number.isInteger(fields.sort_order)) return 'Sort order must be a whole number.'
  return null
}

/** Postgres 23505 on the slug unique index — surfaced as a field-level message. */
function friendlyError(message: string, code?: string): string {
  if (code === '23505') return 'That slug is already used by another product. Slugs must be unique.'
  return message
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readProductFields(formData)
  const invalid = validateProduct(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_products').insert(fields)
  if (error) return { success: false, error: friendlyError(error.message, error.code) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readProductFields(formData)
  const invalid = validateProduct(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_products').update(stamped(fields)).eq('id', id)
  if (error) return { success: false, error: friendlyError(error.message, error.code) }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${id}`)
  return { success: true }
}

export async function setProductPublished(id: string, published: boolean): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase.from('web_products').update(stamped({ published })).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${id}`)
  return { success: true }
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_products')
    .update(stamped({ deleted_at: new Date().toISOString() }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function restoreProduct(id: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_products')
    .update(stamped({ deleted_at: null }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

/* ── Product modifiers (design/customization add-ons) ─────────────── */

function readModifierFields(formData: FormData) {
  return {
    modifier_name: text(formData, 'modifier_name'),
    description: optionalText(formData, 'description'),
    price_modifier: Number(text(formData, 'price_modifier') || '0'),
    sort_order: Number(text(formData, 'sort_order') || '0'),
    published: text(formData, 'published') === 'true',
  }
}

function validateModifier(fields: ReturnType<typeof readModifierFields>): string | null {
  if (!fields.modifier_name) return 'Modifier name is required.'
  if (!Number.isFinite(fields.price_modifier)) return 'Price add-on must be a number.'
  if (!Number.isInteger(fields.sort_order)) return 'Sort order must be a whole number.'
  return null
}

export async function createModifier(productId: string, formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readModifierFields(formData)
  const invalid = validateModifier(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_productmodifier')
    .insert({ ...fields, product_id: productId })
  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${productId}`)
  return { success: true }
}

export async function updateModifier(
  id: string,
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readModifierFields(formData)
  const invalid = validateModifier(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_productmodifier').update(stamped(fields)).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${productId}`)
  return { success: true }
}

export async function setModifierPublished(
  id: string,
  productId: string,
  published: boolean
): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_productmodifier')
    .update(stamped({ published }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${productId}`)
  return { success: true }
}

export async function archiveModifier(id: string, productId: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_productmodifier')
    .update(stamped({ deleted_at: new Date().toISOString() }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${productId}`)
  return { success: true }
}

export async function restoreModifier(id: string, productId: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_productmodifier')
    .update(stamped({ deleted_at: null }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${productId}`)
  return { success: true }
}
