'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const PATH = '/dashboard/management/couriers'

function readCourierFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const contact_number = (formData.get('contact_number') as string)?.trim() || null
  return { name, contact_number }
}

export async function createCourier(formData: FormData): Promise<ActionResult> {
  const { name, contact_number } = readCourierFields(formData)
  if (!name) return { success: false, error: 'Courier name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('couriers').insert({ name, contact_number })

  if (error) return { success: false, error: error.message }

  revalidatePath(PATH)
  return { success: true }
}

export async function updateCourier(id: string, formData: FormData): Promise<ActionResult> {
  const { name, contact_number } = readCourierFields(formData)
  if (!name) return { success: false, error: 'Courier name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('couriers').update({ name, contact_number }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(PATH)
  return { success: true }
}

export async function setCourierActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('couriers').update({ is_active: isActive }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(PATH)
  return { success: true }
}
