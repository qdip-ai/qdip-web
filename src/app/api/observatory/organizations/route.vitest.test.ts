import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { ISSUER, ORG, CORE } = vi.hoisted(() => ({
  ISSUER: 'https://zitadel.example.test',
  ORG: '11111111111111111111',
  CORE: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}))

vi.mock('@/routing-config', () => ({ isSurfaceHost: () => true }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: vi.fn(() => ({
    issuer: ISSUER,
    sub: '99999999999999999999',
    clientId: 'test-client',
    projectId: 'test-project',
    organizationId: ORG,
    expiresAt: 1792490000,
    roles: [],
  })),
}))
vi.mock('@/lib/zitadel-owner-organizations', () => {
  class OwnerOrganizationError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message)
    }
  }
  return {
    OwnerOrganizationError,
    listOwnedZitadelOrganizations: vi.fn(async () => [{ id: ORG, name: 'QDIP', state: 'active' }]),
    verifyOwnedZitadelOrganization: vi.fn(async (_principal: unknown, organizationId: string) => {
      if (organizationId !== ORG) throw new OwnerOrganizationError(403, 'Organization owner required')
      return { id: ORG, name: 'QDIP', state: 'active' }
    }),
  }
})
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.qdip.test', key: 'PRIVATE-SERVICE-KEY' }),
}))
vi.mock('@/lib/zitadel-org-link-assertion', () => ({
  signZitadelOwnerLink: () => ({ issued_at: 1792400000, nonce: 'a'.repeat(32), assertion: 'b'.repeat(64) }),
  signZitadelOwnerList: () => ({ issued_at: 1792400000, nonce: 'c'.repeat(32), assertion: 'd'.repeat(64) }),
}))

import { GET, POST } from './route'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { verifyOwnedZitadelOrganization } from '@/lib/zitadel-owner-organizations'

function request(method: 'GET' | 'POST', body?: object, origin = 'https://observatory.qdip.ai') {
  return new NextRequest('https://observatory.qdip.ai/api/observatory/organizations', {
    method,
    headers: {
      host: 'observatory.qdip.ai',
      origin,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.mocked(sessionFromRequest).mockReturnValue({
    issuer: ISSUER,
    sub: '99999999999999999999',
    clientId: 'test-client',
    projectId: 'test-project',
    organizationId: ORG,
    expiresAt: 1792490000,
    roles: [],
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('verified Zitadel ownership link', () => {
  it('lists existing owned orgs without creating anything', async () => {
    const result = await GET(request('GET'))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({
      organizations: [{ id: ORG, name: 'QDIP', state: 'active' }],
    })
    expect(result.headers.get('cache-control')).toContain('no-store')
  })

  it('links to a stable Core UUID, never substitutes the numeric Zitadel ID', async () => {
    const upstream = vi.fn(async (input: string, options: RequestInit) => {
      expect(new URL(input).pathname).toBe('/api/v1/organizations/zitadel-link')
      expect(options.method).toBe('POST')
      expect((options.headers as Record<string, string>)['x-api-key']).toBe('PRIVATE-SERVICE-KEY')
      const body = JSON.parse(String(options.body))
      expect(body.organization_id).toBe(ORG)
      expect(body.authenticated_subject).toBe('99999999999999999999')
      expect(body.assertion).toBe('b'.repeat(64))
      return Response.json(
        {
          id: CORE,
          name: 'QDIP',
          identity_provider: 'zitadel',
          zitadel_issuer: ISSUER,
          zitadel_organization_id: ORG,
        },
        { status: 201 }
      )
    })
    vi.stubGlobal('fetch', upstream)
    const response = await POST(request('POST', { organizationId: ORG }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      organization: { id: ORG, name: 'QDIP', state: 'active' },
      coreTenantId: CORE,
      linked: true,
      pluginMigrationComplete: false,
    })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('denies organization hijacking and CSRF before touching Core', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect((await POST(request('POST', { organizationId: '22222222222222222222' }))).status).toBe(403)
    expect((await POST(request('POST', { organizationId: ORG }, 'https://evil.example'))).status).toBe(403)
    expect(vi.mocked(verifyOwnedZitadelOrganization)).toHaveBeenCalled()
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects any Core identity mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            id: '22222222222222222222',
            identity_provider: 'zitadel',
            zitadel_issuer: ISSUER,
            zitadel_organization_id: ORG,
          },
          { status: 201 }
        )
      )
    )
    expect((await POST(request('POST', { organizationId: ORG }))).status).toBe(503)
  })

  it('requires an authenticated OIDC session', async () => {
    vi.mocked(sessionFromRequest).mockReturnValue(null)
    expect((await GET(request('GET'))).status).toBe(401)
    expect((await POST(request('POST', { organizationId: ORG }))).status).toBe(401)
  })
})

function enableRrQaBridge() {
  vi.stubEnv('RAILWAY_PROJECT_ID', '4665798b-2012-466e-be91-2555d76f36c2')
  vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', 'qa')
  vi.stubEnv('RR_STAGING_OWNER_LINK_URL', 'https://qdip-rr-qa.up.railway.app/qa/rr/owner-link')
  vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', ORG)
}

describe('RR QA owner bridge is scoped to the configured Zitadel organization', () => {
  it('accepts only the single active configured organization from the QA owner list', async () => {
    enableRrQaBridge()
    const fetchQa = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe('https://qdip-rr-qa.up.railway.app/qa/rr/owner-link')
      expect(options.method).toBe('POST')
      const body = JSON.parse(String(options.body))
      expect(body.action).toBe('list')
      expect(body.issuer).toBe(ISSUER)
      return Response.json({ organizations: [{ id: ORG, state: 'active', name: 'QDIP' }] })
    })
    vi.stubGlobal('fetch', fetchQa)
    const result = await GET(request('GET'))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({
      organizations: [{ id: ORG, state: 'active', name: 'QDIP' }],
    })
    expect(fetchQa).toHaveBeenCalledTimes(1)
  })

  it.each([
    { organizations: [] },
    { organizations: [{ id: ORG, state: 'active' }, { id: ORG, state: 'active' }] },
    { organizations: [{ id: '22222222222222222222', state: 'active' }] },
    { organizations: [{ id: ORG, state: 'inactive' }] },
  ])('rejects an incomplete, duplicate or foreign QA owner list: %j', async (payload) => {
    enableRrQaBridge()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload)))
    expect((await GET(request('GET'))).status).toBe(503)
  })

  it('fails closed without the configured QA organization', async () => {
    enableRrQaBridge()
    vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', '')
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ organizations: [{ id: ORG, state: 'active' }] })))
    expect((await GET(request('GET'))).status).toBe(503)
    expect((await POST(request('POST', { organizationId: ORG }))).status).toBe(503)
  })

  it('rejects a foreign QA link without calling the bridge', async () => {
    enableRrQaBridge()
    const fetchQa = vi.fn()
    vi.stubGlobal('fetch', fetchQa)
    expect((await POST(request('POST', { organizationId: '22222222222222222222' }))).status).toBe(403)
    expect(fetchQa).not.toHaveBeenCalled()
  })

  it('accepts a verified QA link only for the configured organization', async () => {
    enableRrQaBridge()
    const fetchQa = vi.fn(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      expect(body.action).toBe('link')
      expect(body.organization_id).toBe(ORG)
      return Response.json({
        linked: true,
        coreTenantId: CORE,
        organization: { id: ORG, name: 'QDIP', state: 'active' },
      })
    })
    vi.stubGlobal('fetch', fetchQa)
    const result = await POST(request('POST', { organizationId: ORG }))
    expect(result.status).toBe(200)
    expect((await result.json()).coreTenantId).toBe(CORE)
    expect(fetchQa).toHaveBeenCalledTimes(1)
  })
})
