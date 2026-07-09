'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/management/product-modifiers'

type OptionInput = { id?: string; name: string; price: number }

function readOptions(formData: FormData): OptionInput[] {
  const raw = formData.get('options_json') as string | null
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((o) => ({
      id: typeof o.id === 'string' ? o.id : undefined,
      name: typeof o.name === 'string' ? o.name.trim() : '',
      price: Number(o.price) || 0,
    }))
    .filter((o) => o.name.length > 0)
}

export async function createModifier(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { success: false, error: 'Modifier name is required.' }
  const options = readOptions(formData)

  const supabase = await createClient()
  const { data: modifier, error } = await supabase
    .from('modifiers')
    .insert({ name })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  if (options.length > 0) {
    const { error: optionsError } = await supabase
      .from('modifier_options')
      .insert(options.map((o) => ({ modifier_id: modifier.id, name: o.name, price: o.price })))

    if (optionsError) return { success: false, error: optionsError.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateModifier(id: string, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { success: false, error: 'Modifier name is required.' }
  const options = readOptions(formData)

  const supabase = await createClient()
  const { error } = await supabase.from('modifiers').update({ name }).eq('id', id)
  if (error) return { success: false, error: error.message }

  const { data: existing, error: existingError } = await supabase
    .from('modifier_options')
    .select('id')
    .eq('modifier_id', id)
    .is('deleted_at', null)

  if (existingError) return { success: false, error: existingError.message }

  const existingIds = new Set((existing ?? []).map((o) => o.id as string))
  const keptIds = new Set(options.filter((o) => o.id).map((o) => o.id as string))

  const toUpdate = options.filter((o) => o.id && existingIds.has(o.id))
  const toInsert = options.filter((o) => !o.id)
  const toArchive = [...existingIds].filter((existingId) => !keptIds.has(existingId))

  for (const o of toUpdate) {
    const { error: updateError } = await supabase
      .from('modifier_options')
      .update({ name: o.name, price: o.price })
      .eq('id', o.id!)
    if (updateError) return { success: false, error: updateError.message }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('modifier_options')
      .insert(toInsert.map((o) => ({ modifier_id: id, name: o.name, price: o.price })))
    if (insertError) return { success: false, error: insertError.message }
  }

  if (toArchive.length > 0) {
    const { error: archiveError } = await supabase
      .from('modifier_options')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', toArchive)
    if (archiveError) return { success: false, error: archiveError.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function archiveModifier(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('modifiers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function restoreModifier(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('modifiers')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}
