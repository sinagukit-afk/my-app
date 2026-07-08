'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

function readSupplierFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const contact_name = (formData.get('contact_name') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const note = (formData.get('note') as string)?.trim() || null
  return { name, contact_name, phone, email, address, note }
}

export async function createSupplier(formData: FormData): Promise<ActionResult> {
  const { name, ...rest } = readSupplierFields(formData)
  if (!name) return { success: false, error: 'Supplier name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').insert({ name, ...rest })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/management/suppliers')
  return { success: true }
}

export async function updateSupplier(id: string, formData: FormData): Promise<ActionResult> {
  const { name, ...rest } = readSupplierFields(formData)
  if (!name) return { success: false, error: 'Supplier name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').update({ name, ...rest }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/management/suppliers')
  return { success: true }
}

export async function setSupplierActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').update({ is_active: isActive }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/management/suppliers')
  return { success: true }
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Cannot delete: this supplier has existing purchase orders or incoming items. Deactivate it instead.',
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/management/suppliers')
  return { success: true }
}
