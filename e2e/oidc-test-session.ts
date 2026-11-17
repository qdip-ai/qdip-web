import { createHmac } from 'node:crypto'
import type { Cookie } from '@playwright/test'

export const oidcTestConfig = {
  issuer: 'https://identity.example.test',
  clientId: 'qdip-browser-e2e-client',
  projectId: '123456789',
  organizationId: '987654321',
  signingSecret: 'e2e-only-qdip-session-signing-key-not-for-production',
}

export function oidcTestCookies(roles: Array<'studio' | 'observatory_admin'>): Cookie[] {
  const expiresAt = Math.floor(Date.now() / 1000) + 1800
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'local-e2e-account',
      issuer: oidcTestConfig.issuer,
      clientId: oidcTestConfig.clientId,
      projectId: oidcTestConfig.projectId,
      organizationId: oidcTestConfig.organizationId,
      expiresAt,
      roles,
    })
  ).toString('base64url')
  const signature = createHmac('sha256', oidcTestConfig.signingSecret)
    .update('session-v1:' + payload)
    .digest('base64url')
  const value = payload + '.' + signature

  return ['studio.localhost', 'observatory.localhost', 'qdip.localhost'].map((domain) => ({
    name: 'qdip_oidc_session',
    value,
    domain,
    path: '/',
    expires: expiresAt,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }))
}
