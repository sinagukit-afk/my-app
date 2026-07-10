'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  redirect('/dashboard')
}