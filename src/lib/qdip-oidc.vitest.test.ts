import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
import {
  authorizationUrl,
  exchangeCode,
  discoverOidc,
  canAccessStudio,
  canAdministerObservatory,
  isAllowedSession,
  oidcConfigured,
  onSiteOrigin,
  safeReturnTo,
  verifyIdToken,
} from './qdip-oidc'

const issuer = 'https://identity.example.test'
const clientId = '394566248211424533'
const projectId = '123456789'
const organizationId = '987654321'
const roleClaim = `urn:zitadel:iam:org:project:${projectId}:roles`
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'kid-1', use: 'sig', alg: 'RS256' }
const flow = {
  state: 'a'.repeat(40),
  nonce: 'nonce-123',
  verifier: 'verifier-123',
  returnTo: 'https://qdip.ai/en',
  issuedAt: Date.now(),
}
const config = {
  issuer,
  authorization_endpoint: issuer + '/oauth/v2/authorize',
  token_endpoint: issuer + '/oauth/v2/token',
  jwks_uri: issuer + '/oauth/v2/keys',
  userinfo_endpoint: issuer + '/oidc/v1/userinfo',
}
function token(changes: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-1' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuer,
      aud: clientId,
      sub: 'user-1',
      nonce: flow.nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 1200,
      [roleClaim]: { studio: { [organizationId]: 'qdip.example.test' } },
      ...changes,
    })
  ).toString('base64url')
  const input = header + '.' + payload
  const sign = createSign('RSA-SHA256')
  sign.update(input)
  return input + '.' + sign.sign(privateKey).toString('base64url')
}
function stubExchange(idToken: string, userinfo: Record<string, unknown> = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const payload =
      url === config.token_endpoint
        ? { id_token: idToken, access_token: 'zitadel-test-access-token' }
        : url === config.userinfo_endpoint
          ? userinfo
          : { keys: [jwk] }
    return { ok: true, text: async () => JSON.stringify(payload) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.stubEnv('ZITADEL_ISSUER', issuer)
  vi.stubEnv('ZITADEL_CLIENT_ID', clientId)
  vi.stubEnv('QDIP_AUTH_COOKIE_SECRET', 'long-cookie-secret-with-a-minimum-of-32-characters')
  vi.stubEnv('ZITADEL_QDIP_PROJECT_ID', projectId)
  vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', organizationId)
  vi.stubEnv('QDIP_STUDIO_ZITADEL_ROLE_KEY', 'studio')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      text: async () => JSON.stringify(String(url).endsWith('openid-configuration') ? config : { keys: [jwk] }),
    }))
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('QDIP Zitadel OIDC PKCE', () => {
  it('requires a trustworthy issuer, client, project, organization and signing secret', () => {
    expect(oidcConfigured()).toBe(true)
    vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', '')
    expect(oidcConfigured()).toBe(false)
    vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', organizationId)
    vi.stubEnv('ZITADEL_QDIP_PROJECT_ID', '')
    expect(oidcConfigured()).toBe(false)
    vi.stubEnv('ZITADEL_QDIP_PROJECT_ID', projectId)
    vi.stubEnv('QDIP_OBSERVATORY_ADMIN_ZITADEL_ROLE_KEY', 'studio')
    expect(oidcConfigured()).toBe(false)
  })

  it('uses only verified project and organization roles, never the subject or a generic roles claim', async () => {
    const studio = await verifyIdToken(token(), flow, config)
    expect(isAllowedSession(studio)).toBe(true)
    expect(canAccessStudio(studio)).toBe(true)
    expect(studio.projectId).toBe(projectId)
    expect(studio.organizationId).toBe(organizationId)

    // A role QDIP Web does not define (e.g. a product role of an independent
    // plugin service) never grants a QDIP Web surface.
    const foreignRole = await verifyIdToken(
      token({ sub: 'user-1', [roleClaim]: { rr_operator: { [organizationId]: 'qdip.example.test' } } }),
      flow,
      config
    )
    expect(foreignRole.roles).toEqual([])
    expect(canAccessStudio(foreignRole)).toBe(false)

    const both = await verifyIdToken(
      token({
        [roleClaim]: {
          studio: { [organizationId]: 'qdip.example.test' },
          observatory_admin: { [organizationId]: 'qdip.example.test' },
        },
      }),
      flow,
      config
    )
    expect(both.roles).toEqual(['studio', 'observatory_admin'])

    const admin = await verifyIdToken(
      token({ [roleClaim]: { observatory_admin: { [organizationId]: 'qdip.example.test' } } }),
      flow,
      config
    )
    expect(canAdministerObservatory(admin)).toBe(true)
    expect(canAccessStudio(admin)).toBe(false)
    const adminOtherOrg = await verifyIdToken(
      token({ [roleClaim]: { observatory_admin: { '111111111': 'foreign.example.test' } } }),
      flow,
      config
    )
    expect(canAdministerObservatory(adminOtherOrg)).toBe(false)

    const otherOrg = await verifyIdToken(
      token({
        [roleClaim]: { studio: { '111111111': 'external.example.test' } },
      }),
      flow,
      config
    )
    expect(otherOrg.roles).toEqual([])
    expect(isAllowedSession(otherOrg)).toBe(true)

    const otherProject = await verifyIdToken(
      token({
        [roleClaim]: undefined,
        'urn:zitadel:iam:org:project:999999999:roles': {
          studio: { [organizationId]: 'qdip.example.test' },
        },
        'urn:zitadel:iam:org:project:roles': {
          studio: { [organizationId]: 'qdip.example.test' },
        },
      }),
      flow,
      config
    )
    expect(otherProject.roles).toEqual([])
    expect(isAllowedSession(otherProject)).toBe(true)

    await expect(verifyIdToken(token({ [roleClaim]: ['studio'] }), flow, config)).rejects.toThrow()
  })

  it('constructs an exact callback and S256 PKCE authorization request', async () => {
    const discovered = await discoverOidc()
    const url = authorizationUrl(discovered, flow)
    expect(url.searchParams.get('redirect_uri')).toBe('https://qdip.ai/api/auth/callback/zitadel')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe(flow.state)
    expect(url.searchParams.get('nonce')).toBe(flow.nonce)
    expect(url.searchParams.get('scope')).toContain(`urn:zitadel:iam:org:project:id:${projectId}:aud`)
    expect(url.searchParams.get('scope')).toContain('urn:zitadel:iam:org:projects:roles')
    expect(url.searchParams.get('scope')).toContain('urn:iam:org:project:roles')
    expect(url.searchParams.get('scope')).not.toContain('urn:zitadel:iam:org:roles:id:')
  })
  it('resolves expected project/org roles from verified Zitadel Userinfo if ID Token has no role grant', async () => {
    const fetchMock = stubExchange(token({ [roleClaim]: undefined }), {
      sub: 'user-1',
      [roleClaim]: {
        studio: { [organizationId]: 'qdip.example.test' },
        observatory_admin: { [organizationId]: 'qdip.example.test' },
      },
    })
    const session = await exchangeCode('zitadel-test-auth-code', flow, config)
    expect(session.roles).toEqual(['studio', 'observatory_admin'])
    expect(fetchMock).toHaveBeenCalledWith(
      config.userinfo_endpoint,
      expect.objectContaining({ headers: { Authorization: 'Bearer zitadel-test-access-token' } })
    )
  })

  it('does not accept Userinfo roles belonging to another project or grant organization', async () => {
    stubExchange(token({ [roleClaim]: undefined }), {
      sub: 'user-1',
      [roleClaim]: { studio: { '111111111': 'other.example.test' } },
      'urn:zitadel:iam:org:project:222222222:roles': {
        studio: { [organizationId]: 'qdip.example.test' },
      },
    })
    const session = await exchangeCode('zitadel-test-auth-code', flow, config)
    expect(session.roles).toEqual([])
    expect(isAllowedSession(session)).toBe(true)
  })

  it('rejects Userinfo belonging to a different subject even when it has valid grants', async () => {
    stubExchange(token({ [roleClaim]: undefined }), {
      sub: 'another-user',
      [roleClaim]: { studio: { [organizationId]: 'qdip.example.test' } },
    })
    await expect(exchangeCode('zitadel-test-auth-code', flow, config)).rejects.toThrow('subject mismatch')
  })

  it('uses verified identity from the ID token without a Userinfo roundtrip', async () => {
    const fetchMock = stubExchange(token({ name: 'QA Tester', email: 'qa@qdip.ai' }))
    const session = await exchangeCode('zitadel-test-auth-code', flow, config)
    expect(session.roles).toEqual(['studio'])
    expect(session.displayName).toBe('QA Tester')
    expect(session.email).toBe('qa@qdip.ai')
    expect(fetchMock.mock.calls.some(([url]) => url === config.userinfo_endpoint)).toBe(false)
  })

  it('fills a missing display identity from verified Userinfo without replacing ID token roles', async () => {
    const fetchMock = stubExchange(token(), {
      sub: 'user-1',
      name: 'QA Tester',
      email: 'qa@qdip.ai',
      [roleClaim]: { observatory_admin: { [organizationId]: 'qdip.example.test' } },
    })
    const session = await exchangeCode('zitadel-test-auth-code', flow, config)
    expect(session.roles).toEqual(['studio'])
    expect(session.displayName).toBe('QA Tester')
    expect(session.email).toBe('qa@qdip.ai')
    expect(fetchMock.mock.calls.some(([url]) => url === config.userinfo_endpoint)).toBe(true)
  })

  it('ignores malformed identity labels in verified tokens', async () => {
    const session = await verifyIdToken(
      token({ name: 'QA\nInvalid', email: 'not-an-address', preferred_username: 'tester' }),
      flow,
      config
    )
    expect(session.displayName).toBe('tester')
    expect(session.email).toBeUndefined()
  })

  it('verifies Zitadel ID token signature, nonce, issuer and audience', async () => {
    await expect(verifyIdToken(token(), flow, config)).resolves.toMatchObject({ sub: 'user-1', roles: ['studio'] })
    await expect(verifyIdToken(token({ aud: 'another-app' }), flow, config)).rejects.toThrow()
    await expect(verifyIdToken(token({ nonce: 'wrong' }), flow, config)).rejects.toThrow()
    await expect(verifyIdToken(token({ iss: 'https://evil.example' }), flow, config)).rejects.toThrow()
    await expect(verifyIdToken(token({ exp: Math.floor(Date.now() / 1000) - 10 }), flow, config)).rejects.toThrow()
    const signed = token()
    await expect(verifyIdToken(signed.slice(0, -4) + 'ABCD', flow, config)).rejects.toThrow()
  })
  it('accepts canonical site Host behind TLS-terminating reverse proxy, not internal listener', () => {
    const request = new NextRequest('http://127.0.0.1:3000/api/auth/login', {
      headers: { host: 'qdip.ai', 'x-forwarded-proto': 'https' },
    })
    expect(onSiteOrigin(request)).toBe(true)

    const canonical = new NextRequest('https://qdip.ai/api/auth/login', {
      headers: { host: 'qdip.ai' },
    })
    expect(onSiteOrigin(canonical)).toBe(true)
  })

  it('rejects untrusted Host, spoofed forwarding host and HTTPS downgrade', () => {
    const make = (host: string, forwardedProto: string, forwardedHost?: string) =>
      new NextRequest('http://127.0.0.1:3000/api/auth/login', {
        headers: {
          host,
          'x-forwarded-proto': forwardedProto,
          ...(forwardedHost ? { 'x-forwarded-host': forwardedHost } : {}),
        },
      })
    expect(onSiteOrigin(make('evil.example', 'https', 'qdip.ai'))).toBe(false)
    expect(onSiteOrigin(make('qdip.ai, evil.example', 'https'))).toBe(false)
    expect(onSiteOrigin(make('qdip.ai', 'http'))).toBe(false)
    expect(onSiteOrigin(make('www.qdip.ai', 'https'))).toBe(false)
    expect(onSiteOrigin(make('qdip.ai:3000', 'https'))).toBe(false)
  })

  it('disallows external return_to redirect targets', () => {
    expect(safeReturnTo('//evil.example')).toBe('https://qdip.ai/en')
    expect(safeReturnTo('https://evil.example')).toBe('https://qdip.ai/en')
  })
})
