import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { listOwnedZitadelOrganizations, verifyZitadelOrganizationOwner } from './zitadel-owned-organizations'

const issuer = 'https://zitadel.example.test'
const owner = { issuer, sub: '12345678901' }
const qa = { issuer, sub: '98765432101' }
const organizations = [
  { id: '11111111111', name: 'QDIP', state: 'ORGANIZATION_STATE_ACTIVE' },
  { id: '22222222222', name: 'External Developer', state: 'ORGANIZATION_STATE_ACTIVE' },
]
type Call = { path: string; body: Record<string, unknown> }

beforeEach(() => {
  vi.stubEnv('ZITADEL_ISSUER', issuer)
  vi.stubEnv('ZITADEL_ORG_READER_TOKEN', 'test-service-token-never-logged')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function stubZitadel(admins: Record<string, unknown[]>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      const url = new URL(input)
      const body = JSON.parse(String(options.body))
      calls.push({ path: url.pathname, body })
      expect(url.origin).toBe(issuer)
      expect(options.method).toBe('POST')
      expect(options.redirect).toBe('error')
      expect((options.headers as Record<string, string>).authorization).toBe('Bearer test-service-token-never-logged')
      if (url.pathname === '/v2/organizations/_search') {
        return Response.json({ details: { totalResult: 2 }, result: organizations })
      }
      if (url.pathname.endsWith('/ListAdministrators')) {
        expect((options.headers as Record<string, string>)['connect-protocol-version']).toBe('1')
        const id = (body.filters as Array<{ resource: { organizationId: string } }>)[0].resource.organizationId
        return Response.json({
          pagination: { totalResult: (admins[id] || []).length },
          administrators: admins[id] || [],
        })
      }
      throw Error('Unexpected endpoint')
    })
  )
  return calls
}

describe('Zitadel existing organization ownership', () => {
  it('returns only an actual ORG_OWNER of the authenticated subject', async () => {
    const calls = stubZitadel({
      '11111111111': [
        { user: { id: owner.sub, organizationId: '99999999999' }, roles: ['ORG_OWNER'] },
        { user: { id: qa.sub }, roles: ['ORG_USER_MANAGER'] },
      ],
      '22222222222': [{ user: { id: qa.sub }, roles: ['ORG_OWNER'] }],
    })
    expect(await listOwnedZitadelOrganizations(owner)).toEqual([{ id: '11111111111', name: 'QDIP' }])
    expect(await verifyZitadelOrganizationOwner(owner, '11111111111')).toEqual({
      id: '11111111111',
      name: 'QDIP',
    })
    await expect(verifyZitadelOrganizationOwner(owner, '22222222222')).rejects.toMatchObject({ status: 403 })
    expect(calls.filter((c) => c.path.endsWith('/ListAdministrators'))).toHaveLength(6)
  })

  it('never grants owner rights to qa through an Observatory admin or project role', async () => {
    stubZitadel({
      '11111111111': [
        { user: { id: qa.sub }, roles: ['ORG_USER_MANAGER', 'observatory_admin'] },
        { user: { id: owner.sub }, roles: ['ORG_OWNER'] },
      ],
      '22222222222': [{ user: { id: owner.sub }, roles: ['ORG_OWNER'] }],
    })
    expect(await listOwnedZitadelOrganizations(qa)).toEqual([])
  })

  it('fails closed if the server-side Zitadel reader token is missing', async () => {
    vi.stubEnv('ZITADEL_ORG_READER_TOKEN', '')
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(listOwnedZitadelOrganizations(owner)).rejects.toMatchObject({ status: 503 })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('fails closed for a session with the wrong issuer or an untrusted subject', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(
      listOwnedZitadelOrganizations({ issuer: 'https://evil.example', sub: owner.sub })
    ).rejects.toMatchObject({ status: 503 })
    await expect(listOwnedZitadelOrganizations({ issuer, sub: '../../other' })).rejects.toMatchObject({ status: 503 })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('does not treat another Zitadel organization ID or home org as owner proof', async () => {
    stubZitadel({
      '11111111111': [{ user: { id: owner.sub, organizationId: '11111111111' }, roles: ['ORG_USER_MANAGER'] }],
      '22222222222': [],
    })
    expect(await listOwnedZitadelOrganizations(owner)).toEqual([])
  })

  it('fails closed for truncated organization catalog or incomplete admin list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = new URL(input).pathname
        if (path.endsWith('/_search')) return Response.json({ details: { totalResult: 300 }, result: organizations })
        throw Error('No second request expected')
      })
    )
    await expect(listOwnedZitadelOrganizations(owner)).rejects.toMatchObject({ status: 503 })
  })

  it('never allows a plugin ID or arbitrary text to become a Zitadel org ID', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(verifyZitadelOrganizationOwner(owner, 'qdip-sdk-plugin:vhv')).rejects.toMatchObject({ status: 422 })
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
