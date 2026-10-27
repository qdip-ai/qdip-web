import 'server-only'

/**
 * RR is currently a single-organization operator BFF. Use its own Core
 * organization credential, independently of Studio/Observatory platform keys.
 *
 * DIP_API_KEY remains a migration/isolated-E2E fallback only. Production
 * qualification requires RR_ORG_API_KEY provisioned for the authorized
 * existing Core organization; a platform key is rejected by Core RBAC.
 */
export function rrCoreApiKey(): string {
  return process.env.RR_ORG_API_KEY?.trim() || process.env.DIP_API_KEY?.trim() || ''
}
