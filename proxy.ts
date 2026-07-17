import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVITY_COOKIE, IDLE_LIMIT_MS, activityCookieOptions } from '@/lib/auth/activity-cookie'

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
    // Clear with the same attributes it was set with (not .delete(), which omits
    // secure/sameSite) -- a mismatched clear cookie can fail to overwrite the
    // original in some browsers/proxies, leaving a stale timestamp that re-trips
    // this branch on every subsequent request, including right after a fresh login.
    redirectResponse.cookies.set(ACTIVITY_COOKIE, '', { ...activityCookieOptions(), maxAge: 0 })
    return redirectResponse
  }

  response.cookies.set(ACTIVITY_COOKIE, String(now), activityCookieOptions())

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
