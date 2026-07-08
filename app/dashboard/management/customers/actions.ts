'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }
export type CreateResult = { success: true; id: string } | { success: false; error: string }

const LIST_PATH = '/dashboard/management/customers'

function readCustomerFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const phone_number = (formData.get('phone_number') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const address_line1 = (formData.get('address_line1') as string)?.trim() || null
  const barangay = (formData.get('barangay') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const province = (formData.get('province') as string)?.trim() || null
  const postal_code = (formData.get('postal_code') as string)?.trim() || null
  const note = (formData.get('note') as string)?.trim() || null
  return { name, phone_number, email, address_line1, barangay, city, province, postal_code, note }
}

export async function createCustomer(formData: FormData): Promise<CreateResult> {
  const { name, ...rest } = readCustomerFields(formData)
  if (!name) return { success: false, error: 'Customer name is required.' }

  const supabase = await createClient()
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({ name, ...rest })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const { error: sourceError } = await supabase.from('customer_sources').insert({
    customer_id: customer.id,
    source: 'manual',
  })

  if (sourceError) return { success: false, error: sourceError.message }

  revalidatePath(LIST_PATH)
  return { success: true, id: customer.id }
}

export async function updateCustomer(id: string, formData: FormData): Promise<ActionResult> {
  const { name, ...rest } = readCustomerFields(formData)
  if (!name) return { success: false, error: 'Customer name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('customers').update({ name, ...rest }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${id}`)
  return { success: true }
}
