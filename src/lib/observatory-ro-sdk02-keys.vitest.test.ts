import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({
    base: 'https://core.qdip.test',
    key: 'PRIVATE-PLATFORM-ADMIN',
  }),
}))
import { createDeveloperCredentials, RO_SDK02_CAPABILITY } from './observatory-developer-keys'

const ORG = '12345678-1234-4234-8234-123456789abc'
const APP = '12345678-1234-4234-8234-123456789abd'
const WORKER = '12345678-1234-4234-8234-123456789abe'
const expiresAt = () => new Date(Date.now() + 30 * 86_400_000).toISOString()

afterEach(() => vi.unstubAllGlobals())

describe('RO SDK-02 first-party Worker bootstrap', () => {
  it('issues two least-privilege capability-scoped keys in distinct RO-SDK02 organization', async () => {
    const created: Array<Record<string, unknown>> = []
    const issued: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        const path = new URL(url).pathname
        const body = options.body ? JSON.parse(String(options.body)) : null
        const method = options.method ?? 'GET'
        if (method === 'GET' && path.endsWith('/organizations'))
          return Response.json([{ id: ORG, name: 'qdip-sdk-app:ro-sdk02' }])
        if (method === 'POST' && path.endsWith('/keys')) {
          const idx = issued.length
          created.push(body)
          const row = {
            id: idx === 0 ? APP : WORKER,
            org_id: ORG,
            name: body.name,
            key: 'dip-' + (idx === 0 ? 'a' : 'b').repeat(32),
            environment: 'production',
            scopes: body.scopes,
            allowed_capabilities: body.allowed_capabilities,
            expires_at: body.expires_at,
            revoked_at: null,
          }
          issued.push(row)
          return Response.json(row, { status: 201 })
        }
        if (method === 'GET' && path.endsWith('/keys'))
          return Response.json(issued.map(({ key: _raw, ...row }) => row))
        throw Error('Unexpected Core request')
      })
    )
    const pair = await createDeveloperCredentials('RO-SDK02', RO_SDK02_CAPABILITY)
    expect(pair.application).toBe('RO-SDK02')
    expect(pair.capability).toBe('route-optimizer.select-routes.v1')
    expect(pair.worker.key).toMatch(/^dip-[a-f0-9]{32}$/)
    expect(pair.app.key).toMatch(/^dip-[a-f0-9]{32}$/)
    expect(pair.worker.key).not.toBe(pair.app.key)
    expect(created).toHaveLength(2)
    expect(created.map(x => x.scopes)).toEqual([
      ['plugins:read', 'plugins:execute'], ['plugins:register'],
    ])
    expect(created.map(x => x.allowed_capabilities)).toEqual([
      ['route-optimizer.select-routes.v1'], ['route-optimizer.select-routes.v1'],
    ])
  })

  it('does not allow RO SDK-02 to request VHV or private customer VRP capability', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createDeveloperCredentials('RO-SDK02', 'secretary.plan')).rejects.toMatchObject({ status: 422 })
    await expect(
      createDeveloperCredentials('RO-SDK02', 'route-optimizer.customer-coordinate-vrp.v1')
    ).rejects.toMatchObject({ status: 422 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects and revokes both keys when Worker attestation mismatches capability', async () => {
    const issued: Array<Record<string, unknown>> = []
    const revoked: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        const path = new URL(url).pathname
        const method = options.method ?? 'GET'
        const body = options.body ? JSON.parse(String(options.body)) : null
        if (method === 'GET' && path.endsWith('/organizations'))
          return Response.json([{ id: ORG, name: 'qdip-sdk-app:ro-sdk02' }])
        if (method === 'POST' && path.endsWith('/keys')) {
          const idx = issued.length
          const record = {
            id: idx === 0 ? APP : WORKER, key: 'dip-' + (idx === 0 ? 'a' : 'b').repeat(32),
            org_id: ORG, name: body.name, environment: 'production',
            scopes: body.scopes,
            allowed_capabilities: idx === 0 ? body.allowed_capabilities : ['secretary.plan'],
            expires_at: expiresAt(), revoked_at: null,
          }
          issued.push(record)
          return Response.json(record, { status: 201 })
        }
        if (method === 'GET' && path.endsWith('/keys'))
          return Response.json(issued.map(({ key: _raw, ...row }) => row))
        if (method === 'POST' && path.endsWith('/revoke')) {
          revoked.push(path)
          return Response.json({})
        }
        throw Error('Unexpected test request')
      })
    )
    await expect(createDeveloperCredentials('RO-SDK02', RO_SDK02_CAPABILITY)).rejects.toMatchObject({ status: 503 })
    expect(revoked).toHaveLength(2)
  })
})
