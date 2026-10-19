import 'server-only'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import type { NextRequest } from 'next/server'

const CAPABILITY_ID = /^[a-zA-Z0-9_.-]{1,128}$/

/**
 * Observatory is user-based. Core's Gateway service tenant is an internal
 * execution boundary, never an Observatory organization or user identity.
 *
 * Per-subject capability grants are explicit, server-side and fail closed.
 * Example: {"zitadel-sub-1":["route.optimize"],"zitadel-sub-2":[]}
 * An empty array means no access; wildcards are intentionally unsupported.
 */
export function observatoryCapabilityGrants(request: NextRequest): ReadonlySet<string> | null {
  const subject = sessionFromRequest(request)?.sub
  if (!subject || typeof subject !== 'string') return null

  // Preserve the existing rollout allowlist as an additional restriction.
  const allowed = (process.env.QDIP_OBSERVATORY_ALLOWED_SUBJECTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!allowed.includes(subject)) return null

  try {
    const raw = process.env.QDIP_OBSERVATORY_USER_CAPABILITIES
    if (!raw || raw.length > 65536) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(record, subject)) return null
    const entries = record[subject]
    if (!Array.isArray(entries) || entries.length > 100 ||
        !entries.every((item) => typeof item === 'string' && CAPABILITY_ID.test(item))) return null
    return new Set(entries as string[])
  } catch {
    return null
  }
}

export function authorizedObservatoryUser(request: NextRequest): boolean {
  return observatoryCapabilityGrants(request) !== null
}
