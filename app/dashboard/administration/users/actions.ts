'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

const USER_ROLES = ['admin', 'manager', 'encoder', 'cashier', 'viewer'] as const
const BAN_DURATION = '87600h' // ~10 years, effectively indefinite until reactivated

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false as const, error: 'Only admins can manage users.' }

  return { ok: true as const, userId: user.id }
}

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin.ok) return { success: false, error: admin.error }

  const email = (formData.get('email') as string)?.trim()
  const full_name = (formData.get('full_name') as string)?.trim() || null
  const role = formData.get('role') as string

  if (!email) return { success: false, error: 'Email is required.' }
  if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
    return { success: false, error: 'Invalid role.' }
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email)
  if (error) return { success: false, error: error.message }

  const newUserId = data.user.id
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ full_name, role })
    .eq('id', newUserId)
  if (profileError) return { success: false, error: profileError.message }

  revalidatePath('/dashboard/administration/users')
  return { success: true }
}

export async function updateUserProfile(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin.ok) return { success: false, error: admin.error }

  const full_name = (formData.get('full_name') as string)?.trim() || null
  const role = formData.get('role') as string
  if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
    return { success: false, error: 'Invalid role.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ full_name, role }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/administration/users')
  return { success: true }
}

export async function setUserActive(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin.ok) return { success: false, error: admin.error }
  if (id === admin.userId && !isActive) {
    return { success: false, error: 'You cannot deactivate your own account.' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(id, {
    ban_duration: isActive ? 'none' : BAN_DURATION,
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/administration/users')
  return { success: true }
}
