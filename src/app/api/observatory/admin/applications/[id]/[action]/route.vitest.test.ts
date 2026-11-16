import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ authenticated: true, admin: true }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: () => (state.authenticated ? { issuer: 'https://issuer.test', sub: 'verified-admin' } : null),
  canAdministerObservatory: () => state.admin,
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.qdip.test', key: 'server-only-admin-key' }),
}))

import { POST } from './route'

const id = 'readiness-recovery'
const context = (action = 'publish', app = id) => ({ params: Promise.resolve({ id: app, action }) })
const request = (payload: unknown, origin = 'https://observatory.qdip.ai') =>
  new NextRequest('https://observatory.qdip.ai/api/observatory/admin/applications/readiness-recovery/publish', {
    method: 'POST',
    headers: { host: 'observatory.qdip.ai', origin, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

beforeEach(() => {
  vi.resetAllMocks()
  state.authenticated = true
  state.admin = true
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        application_id: id,
        status: 'published',
        revision: 2,
        visible: true,
      })
    )
  )
})

describe('independent admin application lifecycle proxy', () => {
  it('denies unauthenticated, ordinary-user and cross-site requests before Core access', async () => {
    state.authenticated = false
    expect((await POST(request({ expected_revision: 1 }), context())).status).toBe(401)
    state.authenticated = true
    state.admin = false
    expect((await POST(request({ expected_revision: 1 }), context())).status).toBe(403)
    state.admin = true
    expect((await POST(request({ expected_revision: 1 }, 'https://evil.example'), context())).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('validates exact RR identity, operation and revision', async () => {
    expect((await POST(request({ expected_revision: 1 }), context('publish', 'untrusted'))).status).toBe(404)
    expect((await POST(request({ expected_revision: 1 }), context('reset'))).status).toBe(404)
    for (const payload of [
      { expected_revision: -1 },
      { expected_revision: 1.5 },
      { expected_revision: '1' },
      { expected_revision: 0, arbitrary: true },
      {},
    ])
      expect((await POST(request(payload), context())).status).toBe(422)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('forwards only verified server-side admin authority to Core', async () => {
    const response = await POST(request({ expected_revision: 1 }), context())
    expect(response.status).toBe(200)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('https://core.qdip.test/api/v1/applications/readiness-recovery/publish')
    expect(init?.redirect).toBe('error')
    expect(init?.cache).toBe('no-store')
    expect(init?.headers).toEqual(
      expect.objectContaining({
        'x-api-key': 'server-only-admin-key',
        'x-qdip-actor': 'verified-admin',
      })
    )
    expect(init?.body).toBe(JSON.stringify({ expected_revision: 1 }))
  })

  it('does not report success on runtime admission denial or malformed Core response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          detail: { code: 'runtime_admission_denied', reasons: ['RR_SCHEDULING_WORKER_UNAVAILABLE'] },
        },
        { status: 409 }
      )
    )
    const denied = await POST(request({ expected_revision: 1 }), context())
    expect(denied.status).toBe(409)
    expect((await denied.json()).reasons).toEqual(['RR_SCHEDULING_WORKER_UNAVAILABLE'])

    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        application_id: id,
        status: 'draft',
        revision: 2,
      })
    )
    expect((await POST(request({ expected_revision: 1 }), context())).status).toBe(502)
  })

  it('unpublish returns only a verified status transition', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        application_id: id,
        status: 'unpublished',
        revision: 3,
        visible: false,
      })
    )
    expect((await POST(request({ expected_revision: 2 }), context('unpublish'))).status).toBe(200)
  })
})
