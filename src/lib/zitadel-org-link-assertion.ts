import 'server-only'

import { createHmac, randomBytes } from 'node:crypto'

/**
 * Not an API key, nor an OIDC token: a short-lived server-to-server binding
 * of a signed Zitadel browser session to one explicitly selected org.
 * The signing secret is distinct from the Core platform API key and remains
 * server-side on both Observatory and Core.
 */
export function signZitadelOwnerLink(session: { issuer: string; sub: string; organizationId: string }): {
  issued_at: number
  nonce: string
  assertion: string
} {
  return signOwnerAction('qdip-core-org-link/v1', session.issuer, session.organizationId, session.sub)
}

/** Read-only listing cannot be replayed as an organization-link assertion. */
export function signZitadelOwnerList(session: { issuer: string; sub: string }): {
  issued_at: number
  nonce: string
  assertion: string
} {
  return signOwnerAction('qdip-core-org-list/v1', session.issuer, '', session.sub)
}

function signOwnerAction(audience: string, issuer: string, organizationId: string, sub: string) {
  const secret = process.env.QDIP_ORG_LINK_ASSERTION_SECRET ?? ''
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('Zitadel owner assertion not configured')
  const issued_at = Math.floor(Date.now() / 1000)
  const nonce = randomBytes(16).toString('hex')
  const payload = [audience, issuer, organizationId, sub, String(issued_at), nonce].join('\n')
  return {
    issued_at,
    nonce,
    assertion: createHmac('sha256', secret).update(payload, 'utf8').digest('hex'),
  }
}
