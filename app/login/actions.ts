'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVITY_COOKIE, activityCookieOptions } from '@/lib/auth/activity-cookie'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const identifier = (formData.get('identifier') as string).trim()
  const password = formData.get('password') as string

  let email = identifier
  if (!identifier.includes('@')) {
    const { data: resolvedEmail } = await supabase.rpc('get_email_for_username', {
      p_username: identifier.toLowerCase(),
    })

    if (!resolvedEmail) {
      redirect('/login?error=Invalid login credentials')
    }
    email = resolvedEmail
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // Stamp a fresh timestamp so a leftover/stale cookie from a prior session can
  // never immediately re-trigger proxy.ts's idle-timeout on the very next request.
  const cookieStore = await cookies()
  cookieStore.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions())

  redirect('/dashboard')
}