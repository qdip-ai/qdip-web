import 'server-only'

/**
 * RR is currently a single-organization operator BFF. Use its own Core
 * organization credential, independently of Studio/Observatory platform keys.
 *
 * DIP_API_KEY remains a migration/isolated-E2E fallback only outside Vercel
 * production. A missing dedicated credential must fail closed in production
 * instead of forwarding the shared platform key to org-scoped Core routes.
 */
export function rrCoreApiKey(): string {
  const dedicated = process.env.RR_ORG_API_KEY?.trim()
  if (dedicated) return dedicated
  if (process.env.VERCEL_ENV === 'production') return ''
  return process.env.DIP_API_KEY?.trim() || ''
}
