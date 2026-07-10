import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ACTIVITY_COOKIE = 'last_activity'
const IDLE_LIMIT_MS = 5 * 60 * 60 * 1000 // 5 hours

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth flow pages (password recovery, etc.) establish their own short-lived
  // session independent of any pre-existing idle dashboard session in the same
  // browser -- forcing an idle-logout here would redirect away mid-flow and
  // discard the recovery link's session before the page can use it.
  if (!user || request.nextUrl.pathname.startsWith('/auth/')) {
    return response
  }

  const lastActivity = request.cookies.get(ACTIVITY_COOKIE)?.value
  const now = Date.now()

  if (lastActivity && now - Number(lastActivity) > IDLE_LIMIT_MS) {
    await supabase.auth.signOut()

    const redirectResponse = NextResponse.redirect(
      new URL('/login?error=Signed out due to inactivity. Please sign in again.', request.url)
    )
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    redirectResponse.cookies.delete(ACTIVITY_COOKIE)
    return redirectResponse
  }

  response.cookies.set(ACTIVITY_COOKIE, String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}