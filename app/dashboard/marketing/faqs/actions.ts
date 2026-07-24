'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canManageMarketing, MARKETING_DENIED } from '../access'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/marketing/faqs'

/** No `updated_at` trigger exists on the web_* tables, so every update stamps it here. */
function stamped<T extends object>(fields: T) {
  return { ...fields, updated_at: new Date().toISOString() }
}

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

function readFaqFields(formData: FormData) {
  return {
    question: text(formData, 'question'),
    answer: text(formData, 'answer'),
    category: text(formData, 'category') || null,
    sort_order: Number(text(formData, 'sort_order') || '0'),
    published: text(formData, 'published') === 'true',
  }
}

function validateFaq(fields: ReturnType<typeof readFaqFields>): string | null {
  if (!fields.question) return 'Question is required.'
  if (!fields.answer) return 'Answer is required.'
  if (!Number.isInteger(fields.sort_order)) return 'Sort order must be a whole number.'
  return null
}

export async function createFaq(formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readFaqFields(formData)
  const invalid = validateFaq(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_faqs').insert(fields)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateFaq(id: string, formData: FormData): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const fields = readFaqFields(formData)
  const invalid = validateFaq(fields)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('web_faqs').update(stamped(fields)).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function setFaqPublished(id: string, published: boolean): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase.from('web_faqs').update(stamped({ published })).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function archiveFaq(id: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('web_faqs')
    .update(stamped({ deleted_at: new Date().toISOString() }))
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function restoreFaq(id: string): Promise<ActionResult> {
  if (!(await canManageMarketing())) return { success: false, error: MARKETING_DENIED }

  const supabase = await createClient()
  const { error } = await supabase.from('web_faqs').update(stamped({ deleted_at: null })).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}
