export const ACTIVITY_COOKIE = 'last_activity'
export const IDLE_LIMIT_MS = 5 * 60 * 60 * 1000 // 5 hours

export function activityCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}
