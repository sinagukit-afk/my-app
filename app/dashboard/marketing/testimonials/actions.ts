'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canManageMarketing, MARKETING_DENIED } from '../access'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/marketing/testimonials'

/** No `updated_at` trigger exists on the web_* tables, so every update stamps it here. */
function stamped<T extends object>(fields: T) {
  return { ...fields, updated_at: new Date().toISOString() }
}

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

function readTestimonialFields(formData: FormData) {
  const rating = text(formData, 'rating')
  return {
    author_name: text(formData, 'author_name'),
    author_role: text(formData, 'author_role') || null,
    quote: text(formData, 'quote'),
    // Rating is optional on the website — an empty select means "don't show stars".
    rating: rating ? Number(rating) : null,
    avatar_url: text(formData, 'avatar_url') || null,
    sort_order: Number(text(formData, 'sort_order') || '0'),
    published: text(formData, 'published') === 'true',
  }
}

function validateTestimonial(fields: ReturnType<typeof readTestimonialFields>): string | null {
  if (!fields.author_name) return 'Author name is required.'
  if (!fields.quote) return 'Quote is required.'
  if (fields.rating !== null && (!Number.isInteger(fields.rating) || fields.rating < 1 || fields.rating > 5)) {
    return 'Rating must be a whole number from 1 to 5.'
  }
  if (fields.avatar_url && !/^https?:\/\//i.test(fields.avatar_url)) {
    return 'Avatar URL must start with http:// or https://.'
  }
  if (!Number.isInteger(fields.sort_order)) return 'Sort order must be a whole number.'
  return null
}

export async function createTestimonial(formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readTestimonialFields(formData)
  const invalid = validateTestimonial(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_testimonials').insert(fields)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateTestimonial(id: string, formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readTestimonialFields(formData)
  const invalid = validateTestimonial(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_testimonials').update(stamped(fields)).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function setTestimonialPublished(
  id: string,
  published: boolean
): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_testimonials')
    .update(stamped({ published }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function archiveTestimonial(id: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_testimonials')
    .update(stamped({ deleted_at: new Date().toISOString() }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function restoreTestimonial(id: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_testimonials')
    .update(stamped({ deleted_at: null }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}
