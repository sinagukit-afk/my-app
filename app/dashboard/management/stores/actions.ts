'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/management/stores'

function readStoreFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  return { name, address, phone, email }
}

export async function createStore(formData: FormData): Promise<ActionResult> {
  const { name, ...rest } = readStoreFields(formData)
  if (!name) return { success: false, error: 'Store name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('stores').insert({ name, ...rest })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateStore(id: string, formData: FormData): Promise<ActionResult> {
  const { name, ...rest } = readStoreFields(formData)
  if (!name) return { success: false, error: 'Store name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('stores').update({ name, ...rest }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function setStoreActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('stores').update({ is_active: isActive }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function deleteStore(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('stores').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Cannot delete: this store has existing receipts or orders. Deactivate it instead.',
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath(LIST_PATH)
  return { success: true }
}
