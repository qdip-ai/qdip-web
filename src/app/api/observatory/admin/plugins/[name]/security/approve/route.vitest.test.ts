import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const auth = vi.hoisted(() => ({ authenticated: true, admin: true }))
const source = vi.hoisted(() => ({ read: vi.fn(), resolveOrg: vi.fn() }))
const ownership = vi.hoisted(() => ({ check: vi.fn() }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: () => (auth.authenticated ? { issuer: 'https://issuer.test', sub: 'verified-admin' } : null),
  canAdministerObservatory: () => auth.admin,
}))
vi.mock('@/lib/zitadel-owner-organizations', () => ({
  OwnerOrganizationError: class OwnerOrganizationError extends Error {
    constructor(public readonly status: number) {
      super('Owner verification rejected')
    }
  },
  verifyOwnedZitadelOrganization: ownership.check,
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  readCorePublications: source.read,
  readRemoteReviewOrganization: source.resolveOrg,
  corePluginConnection: () => ({ base: 'https://core.qdip.test', key: 'server-only-test-admin-key' }),
}))

import { OwnerOrganizationError } from '@/lib/zitadel-owner-organizations'
import { POST } from './route'

const pluginName = 'remote-6d3611cf8065ac8e-secretary'
const context = { params: Promise.resolve({ name: pluginName }) }
const record = { name: pluginName, version: '0.1.0', source: 'remote', revision: 1 }
const review = {
  expected_revision: 1,
  plugin_version: '0.1.0',
  reason: 'Reviewed deployed first-party Worker manifest and risk.',
  review_reference: 'SECURITY-YARA-REVIEW-01',
  risk_acknowledged: true,
}
const request = (payload: unknown, origin = 'https://observatory.qdip.ai') =>
  new NextRequest('https://observatory.qdip.ai/api/observatory/admin/plugins/' + pluginName + '/security/approve', {
    method: 'POST',
    headers: { host: 'observatory.qdip.ai', origin, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

beforeEach(() => {
  vi.resetAllMocks()
  auth.authenticated = true
  auth.admin = true
  source.read.mockResolvedValue([record])
  source.resolveOrg.mockResolvedValue('368555767923594379')
  ownership.check.mockResolvedValue({ id: '368555767923594379' })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        name: pluginName,
        revision: 2,
        security: { state: 'approved' },
        published: false,
      })
    )
  )
})

describe('remote Worker audited security approval', () => {
  it('requires role, authenticated same-origin session and real registered remote Worker', async () => {
    auth.authenticated = false
    expect((await POST(request(review), context)).status).toBe(401)
    auth.authenticated = true
    auth.admin = false
    expect((await POST(request(review), context)).status).toBe(403)
    auth.admin = true
    expect((await POST(request(review, 'https://evil.example'), context)).status).toBe(403)
    expect(source.read).not.toHaveBeenCalled()
    source.read.mockResolvedValueOnce([{ ...record, source: 'embedded' }])
    expect((await POST(request(review), context)).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects unknown identities and requires live owner verification before Core admission', async () => {
    const foreign = { params: Promise.resolve({ name: 'remote-third-party' }) }
    expect((await POST(request(review), foreign)).status).toBe(404)
    expect(ownership.check).not.toHaveBeenCalled()
    ownership.check.mockRejectedValueOnce(new OwnerOrganizationError(403, 'Ownership denied'))
    expect((await POST(request(review), context)).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    ownership.check.mockRejectedValueOnce(new Error('Zitadel unavailable'))
    expect((await POST(request(review), context)).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
    source.resolveOrg.mockResolvedValueOnce(null)
    expect((await POST(request(review), context)).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reviews a new exact registered identity without a catalog-ID allowlist', async () => {
    const migrated = 'remote-new-tenant-secretary'
    source.read.mockResolvedValueOnce([{ ...record, name: migrated }])
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        name: migrated,
        revision: 2,
        security: { state: 'approved' },
        published: false,
      })
    )
    expect((await POST(request(review), { params: Promise.resolve({ name: migrated }) })).status).toBe(200)
    expect(source.resolveOrg).toHaveBeenCalledWith(migrated, '0.1.0', 1, 'https://issuer.test')
    expect(ownership.check).toHaveBeenCalled()
  })

  it('requires explicit reason, review reference, risk acceptance and CAS revision', async () => {
    for (const invalid of [
      { ...review, risk_acknowledged: false },
      { ...review, review_reference: 'short' },
      { ...review, reason: 'ok' },
      { ...review, expected_revision: -1 },
      { ...review, unintended: true },
    ]) {
      expect((await POST(request(invalid), context)).status).toBe(422)
    }
    source.read.mockResolvedValueOnce([{ ...record, revision: 3 }])
    expect((await POST(request(review), context)).status).toBe(409)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('forwards only the audited review contract to Core using server-only credentials', async () => {
    const response = await POST(request(review), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      name: pluginName,
      revision: 2,
      security: { state: 'approved' },
      published: false,
    })
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(ownership.check).toHaveBeenCalledWith(
      { issuer: 'https://issuer.test', sub: 'verified-admin' },
      '368555767923594379'
    )
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('https://core.qdip.test/api/v1/plugin-publications/' + pluginName + '/security/approve')
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('error')
    const headers = init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('server-only-test-admin-key')
    expect(headers['x-qdip-actor']).toBe('verified-admin')
    expect(JSON.parse(String(init?.body))).toEqual(review)
  })

  it('fails closed for missing allowlist, concurrent revision and unexpected Core response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: { code: 'http_error', message: 'secret' } }, { status: 403 })
    )
    const denied = await POST(request(review), context)
    expect(denied.status).toBe(403)
    expect(JSON.stringify(await denied.json())).not.toContain('secret')
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: { code: 'http_error', message: 'revision race' } }, { status: 409 })
    )
    const conflict = await POST(request(review), context)
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'Security state changed; reload before review' })
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        { error: { code: 'http_error', message: 'Plugin revision changed; reload before reviewing' } },
        { status: 409 }
      )
    )
    const known = await POST(request(review), context)
    expect(await known.json()).toEqual({ error: 'Plugin revision changed; reload before reviewing' })
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        name: pluginName,
        revision: 2,
        security: { state: 'pending_review' },
        published: false,
      })
    )
    expect((await POST(request(review), context)).status).toBe(502)
  })
})
