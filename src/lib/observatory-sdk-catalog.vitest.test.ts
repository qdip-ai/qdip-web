import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { readAdminCorePublications, readCorePublications, readRemoteReviewOrganization } from './observatory-plugin-catalog'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Observatory delegates catalog reads through @qdip/client', () => {
  it('uses the existing server-only platform key when an admin alias is absent', async () => {
    vi.stubEnv('DIP_API_BASE_URL', 'https://core.example.test')
    vi.stubEnv('DIP_ADMIN_API_KEY', '')
    vi.stubEnv('DIP_API_KEY', 'existing-platform-key')
    const fetcher = vi.fn(
      async () =>
        new Response('[]', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetcher)
    await expect(readCorePublications()).resolves.toEqual([])
    expect(fetcher).toHaveBeenCalledWith(
      'https://core.example.test/api/v1/plugin-publications',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'existing-platform-key' }),
      })
    )
  })

  it('preserves Core security state only in the authenticated admin projection', async () => {
    vi.stubEnv('DIP_API_BASE_URL', 'https://core.example.test')
    vi.stubEnv('DIP_ADMIN_API_KEY', 'test-platform-admin-not-real')
    const worker = {
      name: 'remote-example-secretary',
      plugin_id: 'secretary',
      source: 'remote',
      version: '0.1.0',
      description: 'Yara planner',
      enabled: true,
      capabilities: ['secretary.plan'],
      capability_versions: { 'secretary.plan': '1' },
      ui: { label: 'Yara' },
      published: false,
      revision: 1,
      capability_id: null,
      published_version: null,
      security: { state: 'pending_review', reason: 'Manifest changed', critical_block: true },
    }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([worker])))
    const [admin] = await readAdminCorePublications()
    expect(admin.enabled).toBe(true)
    expect(admin.published).toBe(false)
    expect(admin.security).toEqual({
      state: 'pending_review',
      reason: 'Manifest changed',
      criticalBlock: true,
    })
    const [publicRecord] = await readCorePublications()
    expect(publicRecord).not.toHaveProperty('security')
  })

  it('derives review ownership from the exact current Core registration and active linked organization', async () => {
    vi.stubEnv('DIP_API_BASE_URL', 'https://core.example.test')
    vi.stubEnv('DIP_ADMIN_API_KEY', 'test-admin')
    const name = 'remote-new-tenant-secretary'
    const issuer = 'https://id.example'
    const items = [{ name, plugin_version: '0.1.0', revision: 2, tenant_id: 'current' }]
    const organizations = [
      { id: 'legacy', status: 'active', identity_provider: 'zitadel', zitadel_issuer: issuer, zitadel_organization_id: '111' },
      { id: 'current', status: 'active', identity_provider: 'zitadel', zitadel_issuer: issuer, zitadel_organization_id: '222' },
    ]
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      Response.json(url.endsWith('/organizations') ? organizations : { items })))
    await expect(readRemoteReviewOrganization(name, '0.1.0', 2, issuer)).resolves.toBe('222')
    await expect(readRemoteReviewOrganization(name, '0.1.0', 1, issuer)).resolves.toBeNull()
    await expect(readRemoteReviewOrganization(name, '0.1.0', 2, 'https://foreign.example')).resolves.toBeNull()
    await expect(readRemoteReviewOrganization('remote-unknown', '0.1.0', 2, issuer)).resolves.toBeNull()
  })

  it('rejects a missing platform key rather than running anonymous catalog access', async () => {
    vi.stubEnv('DIP_API_BASE_URL', 'https://core.example.test')
    vi.stubEnv('DIP_ADMIN_API_KEY', '')
    vi.stubEnv('DIP_API_KEY', '')
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(readCorePublications()).rejects.toThrow('QDIP Core admin connection is not configured')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('requests the single QDIP registry using only the server admin SDK credential', async () => {
    vi.stubEnv('DIP_API_BASE_URL', 'https://core.example.test')
    vi.stubEnv('DIP_ADMIN_API_KEY', 'test-platform-admin-not-real')
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          {
            name: 'remote-secretary',
            version: '0.1.0',
            description: 'Yara planner',
            enabled: true,
            capabilities: ['secretary.plan'],
            capability_versions: { 'secretary.plan': '1' },
            ui: { label: 'Yara', category: 'Productivity' },
            published: false,
            revision: 0,
            capability_id: null,
            published_version: null,
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetcher)
    const result = await readCorePublications()
    expect(result[0].ui.label).toBe('Yara')
    expect(result[0].capabilities).toContain('secretary.plan')
    expect(fetcher).toHaveBeenCalledWith(
      'https://core.example.test/api/v1/plugin-publications',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-api-key': 'test-platform-admin-not-real' }),
      })
    )
  })
})
