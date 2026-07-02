'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export type ActionResult = { success: true } | { success: false; error: string }

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { success: false, error: 'Not authenticated.' }

  const full_name = (formData.get('full_name') as string).trim() || null
  const contact_number = (formData.get('contact_number') as string).trim() || null
  const birthday = (formData.get('birthday') as string) || null

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, contact_number, birthday })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/account/profile')
  return { success: true }
}

export async function requestPasswordReset(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user || !user.email) return { success: false, error: 'Not authenticated.' }

  const headersList = await headers()
  const origin = headersList.get('origin') ?? `http://${headersList.get('host')}`

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/update-password`,
  })

  if (error) return { success: false, error: error.message }

  return { success: true }
}
