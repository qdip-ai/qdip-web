import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/routing-config', () => ({
  isSurfaceHost: () => true,
}))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: vi.fn(() => ({
    issuer: 'https://zitadel.example.test',
    sub: '12345678901',
    roles: [],
  })),
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({
    base: 'https://core.qdip.test',
    key: 'PRIVATE-CORE-ADMIN-KEY',
  }),
}))
vi.mock('@/lib/zitadel-owned-organizations', () => ({
  ZitadelOwnerLookupError: class ZitadelOwnerLookupError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message)
    }
  },
  listOwnedZitadelOrganizations: vi.fn(async () => [{ id: '11111111111', name: 'QDIP' }]),
  verifyZitadelOrganizationOwner: vi.fn(async (_session: unknown, id: string) => {
    if (id !== '11111111111') throw Object.assign(new Error('Not org owner'), { status: 403 })
    return { id: '11111111111', name: 'QDIP' }
  }),
}))
import { GET, POST } from './route'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { verifyZitadelOrganizationOwner } from '@/lib/zitadel-owned-organizations'

function request(body?: Record<string, unknown>, origin = 'https://observatory.qdip.ai') {
  return new NextRequest('https://observatory.qdip.ai/api/observatory/organizations', {
    method: body ? 'POST' : 'GET',
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
    issuer: 'https://zitadel.example.test',
    sub: '12345678901',
    roles: [],
  } as ReturnType<typeof sessionFromRequest>)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Zitadel organization owner-only API', () => {
  it('returns only owner organization names without credentials', async () => {
    const result = await GET(request())
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ organizations: [{ id: '11111111111', name: 'QDIP' }] })
    expect(result.headers.get('cache-control')).toContain('no-store')
  })

  it('enforces live owner proof before writing any Core projection', async () => {
    const core = vi.fn(async (_input: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      expect(body).toEqual({
        issuer: 'https://zitadel.example.test',
        organization_id: '11111111111',
        name: 'QDIP',
      })
      expect((options.headers as Record<string, string>)['x-api-key']).toBe('PRIVATE-CORE-ADMIN-KEY')
      return Response.json({
        id: '12345678-1234-4234-8234-123456789abc',
        name: 'QDIP',
        status: 'active',
        zitadel_issuer: 'https://zitadel.example.test',
        zitadel_organization_id: '11111111111',
      })
    })
    vi.stubGlobal('fetch', core)
    const result = await POST(request({ organizationId: '11111111111' }))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({
      organization: {
        id: '11111111111',
        name: 'QDIP',
        coreTenantId: '12345678-1234-4234-8234-123456789abc',
      },
    })
    expect(vi.mocked(verifyZitadelOrganizationOwner)).toHaveBeenCalledWith(
      { issuer: 'https://zitadel.example.test', sub: '12345678901' },
      '11111111111'
    )
    expect(core).toHaveBeenCalledTimes(1)
  })

  it('does not let the browser claim an arbitrary organization', async () => {
    const core = vi.fn()
    vi.stubGlobal('fetch', core)
    const result = await POST(request({ organizationId: '22222222222' }))
    expect(result.status).not.toBe(200)
    expect(core).not.toHaveBeenCalled()
  })

  it('blocks CSRF, anonymous requests, and unapproved payload keys', async () => {
    expect((await POST(request({ organizationId: '11111111111' }, 'https://evil.example'))).status).toBe(403)
    expect((await POST(request({ organizationId: '11111111111', coreTenantId: 'fake' }))).status).toBe(422)
    vi.mocked(sessionFromRequest).mockReturnValue(null)
    expect((await POST(request({ organizationId: '11111111111' }))).status).toBe(401)
  })

  it('fails closed when Core returns a different tenant identity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          id: '12345678-1234-4234-8234-123456789abc',
          status: 'active',
          zitadel_issuer: 'https://zitadel.example.test',
          zitadel_organization_id: '99999999999',
        })
      )
    )
    const result = await POST(request({ organizationId: '11111111111' }))
    expect(result.status).toBe(502)
  })
})
