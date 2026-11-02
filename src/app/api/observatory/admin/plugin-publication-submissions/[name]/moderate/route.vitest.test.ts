import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const auth = vi.hoisted(() => ({ active: true, admin: true }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: () => (auth.active ? { sub: 'verified-admin' } : null),
  canAdministerObservatory: () => auth.admin,
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.private.example.org', key: 'server-only-test-key' }),
}))
import { POST } from './route'

const context = { params: Promise.resolve({ name: 'remote-worker' }) }
const request = (data: object, origin = 'https://observatory.qdip.ai') =>
  new NextRequest(
    'https://observatory.qdip.ai/api/observatory/admin/plugin-publication-submissions/remote-worker/moderate',
    {
      method: 'POST',
      headers: { host: 'observatory.qdip.ai', origin, 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
const decision = { expected_revision: 2, action: 'suspend', reason: 'Confirmed unsafe plugin source' }
beforeEach(() => {
  vi.restoreAllMocks()
  auth.active = true
  auth.admin = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        plugin_name: 'remote-worker',
        expected_revision: 3,
        status: 'SUSPENDED',
      }),
    }))
  )
})

describe('SDK publication moderation BFF', () => {
  it('forwards reviewed action only with server-held admin key and real actor', async () => {
    const response = await POST(request(decision), context)
    expect(response.status).toBe(200)
    const [[url, options]] = vi.mocked(fetch).mock.calls
    expect(url).toContain('/api/v1/admin/plugin-publication-submissions/remote-worker/moderate')
    expect(options?.headers).toEqual(
      expect.objectContaining({
        'x-api-key': 'server-only-test-key',
        'x-qdip-actor': 'verified-admin',
      })
    )
    expect(JSON.stringify(await response.json())).not.toContain('server-only-test-key')
  })
  it('denies anonymous, wrong role and cross-origin without Core calls', async () => {
    auth.active = false
    expect((await POST(request(decision), context)).status).toBe(401)
    auth.active = true
    auth.admin = false
    expect((await POST(request(decision), context)).status).toBe(403)
    auth.admin = true
    expect((await POST(request(decision, 'https://evil.invalid'), context)).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('denies approval escalation, invalid revision, insufficient audit reason', async () => {
    expect((await POST(request({ ...decision, action: 'approve' }), context)).status).toBe(422)
    expect((await POST(request({ ...decision, expected_revision: -1 }), context)).status).toBe(422)
    expect((await POST(request({ ...decision, reason: 'a' }), context)).status).toBe(422)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('denies forged Core acceptance response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ plugin_name: 'remote-worker', expected_revision: 3, status: 'APPROVED' }),
      }))
    )
    expect((await POST(request(decision), context)).status).toBe(502)
  })
})
