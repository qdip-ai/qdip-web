import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { listOwnedZitadelOrganizations } from './zitadel-owner-organizations'

const ORG_A = '12345678901234567890'
const ORG_B = '12345678901234567891'
const SUBJECT = '98765432109876543210'
const ISSUER = 'https://zitadel.example.test'

function setup(
  overrides: {
    list?: unknown
    adminsA?: unknown
    adminsB?: unknown
    orgError?: number
    adminError?: number
  } = {}
) {
  vi.stubEnv('ZITADEL_ISSUER', ISSUER)
  vi.stubEnv('ZITADEL_ORG_READ_TOKEN', 'TEST_SCOPED_SERVER_TOKEN_ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  const calls: Array<{ url: string; options: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      calls.push({ url: input, options })
      expect(input.startsWith(ISSUER + '/')).toBe(true)
      expect(options.method).toBe('POST')
      expect(options.redirect).toBe('error')
      expect((options.headers as Record<string, string>).authorization).toBe(
        'Bearer TEST_SCOPED_SERVER_TOKEN_ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      )
      if (input.endsWith('/v2/organizations/_search')) {
        if (overrides.orgError) return Response.json({}, { status: overrides.orgError })
        return Response.json(
          overrides.list ?? {
            details: { totalResult: 2 },
            result: [
              { id: ORG_A, name: 'My QDIP', state: 'ORGANIZATION_STATE_ACTIVE' },
              { id: ORG_B, name: 'Other tenant', state: 'ORGANIZATION_STATE_ACTIVE' },
            ],
          }
        )
      }
      if (input.endsWith('/ListAdministrators')) {
        expect((options.headers as Record<string, string>)['connect-protocol-version']).toBe('1')
        if (overrides.adminError) return Response.json({}, { status: overrides.adminError })
        const body = JSON.parse(String(options.body))
        const id = body.filters?.[0]?.resource?.organizationId
        if (id === ORG_A) {
          return Response.json(
            overrides.adminsA ?? {
              pagination: { totalResult: 1 },
              administrators: [
                { user: { id: SUBJECT }, roles: ['ORG_OWNER'], organization: { organizationId: ORG_A } },
              ],
            }
          )
        }
        if (id === ORG_B) {
          return Response.json(
            overrides.adminsB ?? {
              pagination: { totalResult: 1 },
              administrators: [
                { user: { id: SUBJECT }, roles: ['ORG_OWNER_VIEWER'], organization: { organizationId: ORG_B } },
              ],
            }
          )
        }
      }
      throw Error('Unexpected Zitadel API operation')
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Zitadel-owned QDIP tenant discovery', () => {
  it('lists only current ORG_OWNER organizations for exactly the authenticated subject', async () => {
    const calls = setup()
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).resolves.toEqual([
      { id: ORG_A, name: 'My QDIP', state: 'active' },
    ])
    expect(calls).toHaveLength(3)
    expect(calls.every((call) => call.options.method === 'POST')).toBe(true)
  })

  it('cannot use email or a different Zitadel subject to claim the owner organization', async () => {
    setup()
    await expect(
      listOwnedZitadelOrganizations({ issuer: ISSUER, sub: '98765432109876543211' })
    ).resolves.toEqual([])
  })

  it('denies an instance owner, viewer, and wrong-organization administrative role', async () => {
    setup({
      adminsA: {
        pagination: { totalResult: 3 },
        administrators: [
          { user: { id: SUBJECT }, roles: ['IAM_OWNER'], instance: true },
          { user: { id: SUBJECT }, roles: ['ORG_OWNER_VIEWER'], organization: { organizationId: ORG_A } },
          { user: { id: SUBJECT }, roles: ['ORG_OWNER'], organization: { organizationId: ORG_B } },
        ],
      },
    })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).resolves.toEqual([])
  })

  it('fails closed without the server-side ZITADEL organization read token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('ZITADEL_ISSUER', ISSUER)
    vi.stubEnv('ZITADEL_ORG_READ_TOKEN', '')
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects issuer mismatch, malformed subject and untrusted issuer host', async () => {
    const calls = setup()
    await expect(listOwnedZitadelOrganizations({ issuer: 'https://other.example', sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: '../fake' })).rejects.toMatchObject({
      status: 503,
    })
    vi.stubEnv('ZITADEL_ISSUER', 'http://localhost')
    await expect(listOwnedZitadelOrganizations({ issuer: 'http://localhost', sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
    expect(calls).toHaveLength(0)
  })

  it('rejects incomplete pagination rather than silently omitting organizations', async () => {
    setup({ list: {
      details: { totalResult: 3 },
      result: [{ id: ORG_A, name: 'My QDIP', state: 'ORGANIZATION_STATE_ACTIVE' }],
    } })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
  })

  it('rejects incomplete administrator records and inaccessible Zitadel permissions', async () => {
    setup({ adminsA: { pagination: { totalResult: 5 }, administrators: [] } })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
  })

  it('never falls back to guessable QDIP org IDs when Zitadel denies access', async () => {
    setup({ adminError: 403 })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
  })
})
