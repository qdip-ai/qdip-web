import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.qdip.test', key: 'PRIVATE-CORE-SERVICE-KEY' }),
}))
vi.mock('@/lib/zitadel-org-link-assertion', () => ({
  signZitadelOwnerList: () => ({ issued_at: 1792400000, nonce: 'a'.repeat(32), assertion: 'b'.repeat(64) }),
  signZitadelOwnerLink: () => ({ issued_at: 1792400000, nonce: 'c'.repeat(32), assertion: 'd'.repeat(64) }),
}))

import { listOwnedZitadelOrganizations, verifyOwnedZitadelOrganization } from './zitadel-owner-organizations'

const ISSUER = 'https://zitadel.example.test'
const SUBJECT = '98765432109876543210'
const ORG_A = '12345678901234567890'
const ORG_B = '12345678901234567891'

function setup(options: { denial?: number; response?: unknown; route?: string } = {}) {
  vi.stubEnv('ZITADEL_ISSUER', ISSUER)
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, request: RequestInit) => {
      expect(url.startsWith('https://core.qdip.test/api/v1/organizations/')).toBe(true)
      expect(request.method).toBe('POST')
      expect(request.redirect).toBe('error')
      expect(request.cache).toBe('no-store')
      expect((request.headers as Record<string, string>)['x-api-key']).toBe('PRIVATE-CORE-SERVICE-KEY')
      const body = JSON.parse(String(request.body)) as Record<string, unknown>
      calls.push({ url, body })
      if (options.denial) return Response.json({ detail: 'redacted' }, { status: options.denial })
      if (url.endsWith('/zitadel-owned')) {
        return Response.json(
          options.response ?? {
            organizations: [{ id: ORG_A, name: 'My QDIP', state: 'active' }],
          }
        )
      }
      if (url.endsWith('/zitadel-owner-proof')) {
        return Response.json(options.response ?? { id: ORG_A, name: 'My QDIP', state: 'active' })
      }
      throw new Error('Unexpected Core API')
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Core-backed Zitadel organization ownership', () => {
  it('lists only what authenticated Core owner proof returns, never calls Zitadel from Vercel', async () => {
    const calls = setup()
    expect(await listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).toEqual([
      { id: ORG_A, name: 'My QDIP', state: 'active' },
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://core.qdip.test/api/v1/organizations/zitadel-owned')
    expect(calls[0].body.authenticated_subject).toBe(SUBJECT)
    expect(calls[0].body.assertion).toBe('b'.repeat(64))
    expect(calls[0].body).not.toHaveProperty('ZITADEL_AGENT_KEY_JSON')
    expect(calls[0].body).not.toHaveProperty('ZITADEL_ORG_READ_TOKEN')
  })

  it('requires a separately signed proof for exact selected org on every key operation', async () => {
    const calls = setup()
    expect(await verifyOwnedZitadelOrganization({ issuer: ISSUER, sub: SUBJECT }, ORG_A)).toEqual({
      id: ORG_A,
      name: 'My QDIP',
      state: 'active',
    })
    expect(calls[0].url).toBe('https://core.qdip.test/api/v1/organizations/zitadel-owner-proof')
    expect(calls[0].body.organization_id).toBe(ORG_A)
    expect(calls[0].body.authenticated_subject).toBe(SUBJECT)
    expect(calls[0].body.assertion).toBe('d'.repeat(64))
  })

  it('rejects an owner proof of a different organization rather than leaking its keys', async () => {
    setup({ response: { id: ORG_B, name: 'Other tenant', state: 'active' } })
    await expect(verifyOwnedZitadelOrganization({ issuer: ISSUER, sub: SUBJECT }, ORG_A)).rejects.toMatchObject({
      status: 503,
    })
  })

  it('never falls back to an arbitrary Core UUID when Zitadel denies a principal', async () => {
    setup({ denial: 403 })
    await expect(verifyOwnedZitadelOrganization({ issuer: ISSUER, sub: SUBJECT }, ORG_A)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('fails closed if Core cannot check the machine account permissions', async () => {
    setup({ denial: 503 })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
  })

  it('rejects incomplete, duplicated and untrusted organization projections', async () => {
    setup({
      response: {
        organizations: [
          { id: ORG_A, name: 'My QDIP', state: 'active' },
          { id: ORG_A, name: 'My QDIP', state: 'active' },
        ],
      },
    })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
  })

  it('denies a forged issuer or malformed OIDC subject before any network access', async () => {
    const calls = setup()
    await expect(listOwnedZitadelOrganizations({ issuer: 'https://evil.test', sub: SUBJECT })).rejects.toMatchObject({
      status: 503,
    })
    await expect(listOwnedZitadelOrganizations({ issuer: ISSUER, sub: '../owner' })).rejects.toMatchObject({
      status: 503,
    })
    expect(calls).toHaveLength(0)
  })
})
