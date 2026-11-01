import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const auth = vi.hoisted(() => ({ active: true, admin: true }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: () => auth.active ? { sub: 'verified-admin' } : null,
  canAdministerObservatory: () => auth.admin,
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.private.example.org', key: 'server-only-test-key' }),
}))
import { GET } from './route'

const request = () => new NextRequest(
  'https://observatory.qdip.ai/api/observatory/admin/plugin-publication-submissions',
  { headers: { host: 'observatory.qdip.ai' } },
)

beforeEach(() => {
  vi.restoreAllMocks()
  auth.active = true
  auth.admin = true
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, json: async () => ({ items: [{
      plugin_name: 'remote-test', expected_revision: 2,
      status: 'PENDING_SECURITY_REVIEW',
      catalog: { display_name: 'Test', launch_url_verified: true },
    }] }),
  })))
})
describe('SDK developer review queue BFF', () => {
  it('returns a no-store authenticated queue without leaking server secrets', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    const payload = await response.json()
    expect(payload.items).toHaveLength(1)
    expect(JSON.stringify(payload)).not.toContain('server-only-test-key')
    expect(fetch).toHaveBeenCalledWith(
      'https://core.private.example.org/api/v1/admin/plugin-publication-submissions',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'server-only-test-key' }) }),
    )
  })
  it('denies anonymous and roleless requests before contacting Core', async () => {
    auth.active = false
    expect((await GET(request())).status).toBe(401)
    auth.active = true
    auth.admin = false
    expect((await GET(request())).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
})
