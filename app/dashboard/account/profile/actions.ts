'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { success: false, error: 'Not authenticated.' }

  const contact_number = (formData.get('contact_number') as string).trim() || null
  const birthday = (formData.get('birthday') as string) || null

  const { error } = await supabase
    .from('profiles')
    .update({ contact_number, birthday })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/account/profile')
  return { success: true }
}

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user || !user.email) return { success: false, error: 'Not authenticated.' }

  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'New passwords do not match.' }
  }

  // Verify current password before allowing the change
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (verifyError) return { success: false, error: 'Current password is incorrect.' }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) return { success: false, error: error.message }

  return { success: true }
}
