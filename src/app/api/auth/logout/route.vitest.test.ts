import { describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
import { POST } from './route'

const make = (host: string, origin: string, forwardedProto?: string) =>
  ({
    nextUrl: new URL('http://127.0.0.1:3000/api/auth/logout'),
    headers: new Headers({
      host,
      origin,
      ...(forwardedProto ? { 'x-forwarded-proto': forwardedProto } : {}),
    }),
  }) as unknown as NextRequest

describe('OIDC logout reverse proxy host/origin security', () => {
  it('clears the signed session for an exact same-origin localhost request', () => {
    const response = POST(make('observatory.localhost:3000', 'http://observatory.localhost:3000'))
    expect(response.status).toBe(200)
    expect(response.cookies.get('qdip_oidc_session')?.value).toBe('')
  })

  it('rejects cross-origin requests even on a known QDIP surface host', () => {
    expect(POST(make('observatory.localhost:3000', 'http://attacker.localhost:3000')).status).toBe(403)
    expect(POST(make('attacker.localhost:3000', 'http://attacker.localhost:3000')).status).toBe(403)
  })

  it('accepts HTTPS behind a trusted proxy, not insecure production HTTP', () => {
    expect(POST(make('observatory.qdip.ai', 'https://observatory.qdip.ai', 'https')).status).toBe(200)
    expect(POST(make('observatory.qdip.ai', 'http://observatory.qdip.ai')).status).toBe(403)
    expect(POST(make('observatory.qdip.ai', 'https://observatory.qdip.ai', 'http')).status).toBe(403)
  })

  it('clears local session and returns a trusted Zitadel SSO end-session URL', async () => {
    vi.stubEnv('ZITADEL_ISSUER', 'https://auth.qdip.ai')
    vi.stubEnv('ZITADEL_CLIENT_ID', 'oidc-client-01')
    try {
      const response = POST(make('observatory.qdip.ai', 'https://observatory.qdip.ai', 'https'))
      expect(response.status).toBe(200)
      expect(response.cookies.get('qdip_oidc_session')?.value).toBe('')
      const body = await response.json()
      expect(body.authenticated).toBe(false)
      expect(body.logoutUrl).toBe(
        'https://auth.qdip.ai/oidc/v1/end_session?client_id=oidc-client-01&post_logout_redirect_uri=https%3A%2F%2Fobservatory.qdip.ai%2F'
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not add an Observatory return URI on unrelated or local surfaces', async () => {
    vi.stubEnv('ZITADEL_ISSUER', 'https://auth.qdip.ai')
    vi.stubEnv('ZITADEL_CLIENT_ID', 'oidc-client-01')
    try {
      const site = POST(make('qdip.ai', 'https://qdip.ai', 'https'))
      const local = POST(make('observatory.localhost:3000', 'http://observatory.localhost:3000'))
      expect((await site.json()).logoutUrl).toBe('https://auth.qdip.ai/oidc/v1/end_session?client_id=oidc-client-01')
      expect((await local.json()).logoutUrl).toBe('https://auth.qdip.ai/oidc/v1/end_session?client_id=oidc-client-01')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('clears local session without redirecting to an invalid issuer', async () => {
    vi.stubEnv('ZITADEL_ISSUER', 'http://untrusted.example.test')
    vi.stubEnv('ZITADEL_CLIENT_ID', 'oidc-client-01')
    try {
      const response = POST(make('observatory.qdip.ai', 'https://observatory.qdip.ai', 'https'))
      expect(response.status).toBe(200)
      expect(response.cookies.get('qdip_oidc_session')?.value).toBe('')
      expect(await response.json()).toEqual({ authenticated: false, logoutUrl: null })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
