/**
 * Resolves the app's own origin for building absolute URLs (auth redirects, etc).
 * Prefers NEXT_PUBLIC_SITE_URL (set this in prod) so we don't trust a
 * spoofable/rewritten Host header behind a proxy or CDN. Falls back to the
 * request's origin/host headers (server) or window.location (client) for
 * local dev and preview deploys where the env var isn't set.
 */
export function resolveSiteUrl(originHeader?: string | null, hostHeader?: string | null): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  if (originHeader) return originHeader
  if (hostHeader) return `http://${hostHeader}`

  if (typeof window !== 'undefined') return window.location.origin

  throw new Error('Unable to resolve site URL: set NEXT_PUBLIC_SITE_URL.')
}
